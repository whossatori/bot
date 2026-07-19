import { ChatClient } from 'dank-twitch-irc';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import url from 'url';
import { loadCommands, countUniqueCommands } from './utils/commandLoader.js';
import { isOnCooldown, setCooldown } from './utils/cooldown.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ─── Database Setup ───────────────────────────────────────────────
const dbPath = path.join(__dirname, config.database || './database/bot.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const db = new sqlite3.Database(dbPath);

// ─── Bot State ────────────────────────────────────────────────────
const startTime = Date.now();
let commandsUsed = 0;
const DEFAULT_PREFIX = '^'; // only used if no prefix is stored in the database yet
let currentPrefix = DEFAULT_PREFIX;
const activeChannels = new Set();

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT UNIQUE NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS stats (
    key TEXT PRIMARY KEY,
    value INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS stars (
    user_id TEXT PRIMARY KEY,
    username TEXT,
    stars INTEGER NOT NULL DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

  db.run(
    `INSERT OR IGNORE INTO stats (key, value) VALUES ('commands_used', 0)`
  );

  db.get(
    `SELECT value FROM stats WHERE key = 'commands_used'`,
    (err, row) => {
      if (!err && row) {
        commandsUsed = row.value;
        console.log(`Loaded commands_used: ${commandsUsed}`);
      }
    }
  );

  // Seeds 'prefix' with DEFAULT_PREFIX only the first time this table is
  // ever populated (INSERT OR IGNORE no-ops if the row already exists),
  // then reads back whatever is actually stored — so a prefix set via the
  // ^prefix command survives restarts.
  db.run(
    `INSERT OR IGNORE INTO settings (key, value) VALUES ('prefix', ?)`,
    [DEFAULT_PREFIX]
  );

  db.get(
    `SELECT value FROM settings WHERE key = 'prefix'`,
    (err, row) => {
      if (!err && row) {
        currentPrefix = row.value;
        console.log(`Loaded prefix: ${currentPrefix}`);
      }
    }
  );
});

// ─── Load Commands ────────────────────────────────────────────────
const commands = await loadCommands(path.join(__dirname, 'commands'));

// ─── Create Twitch Client ────────────────────────────────────────
const client = new ChatClient({
  username: config.username,
  password: config.oauth,
});

// Twitch's IRC server rejects a message outright if it's identical to
// the last one sent in that channel within ~30s (msg_duplicate), and
// dank-twitch-irc surfaces that as a rejected promise. Without this,
// that throws out of whichever command triggered it — and since it's
// about IRC-level message content, not command logic, ANY command
// could hit it. Wrapping here (rather than in each command) covers
// every current and future command that calls botState.client.me/say.
const rawMe = client.me.bind(client);
const rawSay = client.say.bind(client);

client.me = async (channelName, message) => {
  try {
    await rawMe(channelName, message);
  } catch (err) {
    console.error(`Failed to send message to #${channelName}:`, err.message);
  }
};

client.say = async (channelName, message) => {
  try {
    await rawSay(channelName, message);
  } catch (err) {
    console.error(`Failed to send message to #${channelName}:`, err.message);
  }
};

// ─── Channel Management ───────────────────────────────────────────
async function joinChannel(channel) {
  const ch = channel.toLowerCase().replace('#', '').trim();
  if (!ch) return false;
  if (activeChannels.has(ch)) {
    console.log(`Already in channel: ${ch}`);
    return true;
  }
  try {
    await client.join(ch);
    activeChannels.add(ch);
    db.run(`INSERT OR IGNORE INTO channels (channel) VALUES (?)`, [ch]);
    console.log(`Joined channel: ${ch}`);
    return true;
  } catch (err) {
    console.error(`Failed to join ${ch}:`, err.message);
    return false;
  }
}

async function leaveChannel(channel) {
  const ch = channel.toLowerCase().replace('#', '').trim();
  if (!ch) return false;
  try {
    await client.part(ch);
    activeChannels.delete(ch);
    db.run(`DELETE FROM channels WHERE channel = ?`, [ch]);
    console.log(`Left channel: ${ch}`);
    return true;
  } catch (err) {
    console.error(`Failed to leave ${ch}:`, err.message);
    return false;
  }
}

// ─── Bot State Object (shared with commands) ─────────────────────
const botState = {
  db,
  config,
  client,
  commands,
  startTime,
  joinChannel,
  leaveChannel,
  getCommandsUsed: () => commandsUsed,
  getActiveChannelCount: () => activeChannels.size,
  getActiveChannels: () => activeChannels,
  getPrefix: () => currentPrefix,
  setPrefix: (newPrefix) => {
    currentPrefix = newPrefix;
  },
};

// ─── Message Handler ─────────────────────────────────────────────
client.on('PRIVMSG', async (msg) => {
  const text = msg.messageText;
  if (!text.startsWith(currentPrefix)) return;

  const args = text.slice(currentPrefix.length).trim().split(/\s+/);
  const cmdName = args.shift().toLowerCase();

  const command = commands.get(cmdName);
  if (!command) return;

  if (
    command.adminOnly &&
    msg.senderUsername.toLowerCase() !== config.admin.toLowerCase()
  ) {
    return;
  }

  if (isOnCooldown(command.name, msg.senderUsername)) {
    return;
  }
  setCooldown(command.name, msg.senderUsername);

  commandsUsed++;
  db.run(
    `UPDATE stats SET value = value + 1 WHERE key = 'commands_used'`
  );

  try {
    await command.execute({
      msg,
      channelName: msg.channelName,
      senderUsername: msg.senderUsername,
      args,
      botState,
    });
  } catch (err) {
    console.error(`Error executing command "${cmdName}":`, err);
  }
});

// ─── Client Events ───────────────────────────────────────────────
client.on('ready', () => {
  console.log(`✅ Bot connected as: ${config.username}`);
  console.log(`📢 Prefix: ${currentPrefix}`);
  console.log(`👑 Admin: ${config.admin}`);
  console.log(`📦 Commands loaded: ${countUniqueCommands(commands)}`);

  console.log('--- Joining config channels ---');
  for (const ch of config.channels) {
    joinChannel(ch);
  }

  db.all(`SELECT channel FROM channels`, (err, rows) => {
    if (err) {
      console.error('Error loading channels from database:', err);
      return;
    }
    console.log('--- Joining database channels ---');
    for (const row of rows) {
      if (
        !config.channels
          .map((c) => c.toLowerCase().replace('#', ''))
          .includes(row.channel)
      ) {
        joinChannel(row.channel);
      }
    }
  });
});

client.on('error', (err) => {
  console.error('Client error:', err);
});

client.on('close', () => {
  console.log('⚠️ Connection closed');
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down bot...');
  db.close((err) => {
    if (err) console.error('Error closing database:', err);
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  db.close((err) => {
    if (err) console.error('Error closing database:', err);
    process.exit(0);
  });
});

console.log(' Connecting to Twitch IRC...');
client.connect().catch((err) => {
  console.error(' Failed to connect:', err);
  process.exit(1);
});