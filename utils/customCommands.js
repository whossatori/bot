// ─── Custom Commands ────────────────────────────────────────────────
// Runtime-creatable commands (like StreamElements' custom commands),
// backed by the custom_commands DB table and mirrored in an in-memory
// Map so lookups don't hit the DB on every chat message. Three types:
//
//  - basic:   ^name replies with fixed text
//  - counter: the bare word said in chat (unprefixed) silently +1s it;
//             ^name displays the count; ^name+ manually bumps it and
//             announces the new total
//  - timer:   response is auto-posted to every joined channel on an
//             interval — not triggered by chat at all
//
// permission is 'everyone' (default) or 'mod' — 'mod' means Twitch
// moderator, the broadcaster, or the bot's configured admin. It only
// gates the PREFIXED form of a command — a counter's passive keyword
// trigger always counts everyone, since restricting who chat can
// organically trigger it defeats the point of a counter.

function loadCustomCommands(db) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM custom_commands`, (err, rows) => {
      if (err) return reject(err);
      const map = new Map();
      for (const row of rows) {
        map.set(row.name, row);
      }
      resolve(map);
    });
  });
}

function hasPermission(msg, config, permission) {
  if (permission !== 'mod') return true;
  const isAdmin = msg.senderUsername.toLowerCase() === config.admin.toLowerCase();
  const isModOrBroadcaster = msg.sender.isMod || msg.sender.badges.hasBroadcaster;
  return isAdmin || isModOrBroadcaster;
}

// Returns the created row, null if a command with that name already
// exists (caller should ask for a delete first rather than silently
// overwriting — e.g. resetting an existing counter's count to 0), or
// false if the name ends in "+" — the dispatcher always strips a
// trailing "+" before lookup (that's the counter-increment form), so a
// name ending in "+" would never actually be reachable.
async function createCommand(db, customCommands, { name, type, response, permission, intervalMinutes }) {
  const key = name.toLowerCase();
  if (key.endsWith('+')) return false;
  if (customCommands.has(key)) return null;

  const row = {
    name: key,
    type,
    response: response ?? null,
    count: 0,
    permission: permission ?? 'everyone',
    interval_minutes: intervalMinutes ?? null,
    last_posted_at: type === 'timer' ? Date.now() : null,
  };

  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO custom_commands (name, type, response, count, permission, interval_minutes, last_posted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [row.name, row.type, row.response, row.count, row.permission, row.interval_minutes, row.last_posted_at],
      (err) => (err ? reject(err) : resolve())
    );
  });

  customCommands.set(key, row);
  return row;
}

async function deleteCommand(db, customCommands, name) {
  const key = name.toLowerCase();
  if (!customCommands.has(key)) return false;

  await new Promise((resolve, reject) => {
    db.run(`DELETE FROM custom_commands WHERE name = ?`, [key], (err) => (err ? reject(err) : resolve()));
  });

  customCommands.delete(key);
  return true;
}

async function incrementCounter(db, customCommands, name) {
  const key = name.toLowerCase();
  const cmd = customCommands.get(key);
  if (!cmd || cmd.type !== 'counter') return null;

  cmd.count += 1;
  await new Promise((resolve, reject) => {
    db.run(`UPDATE custom_commands SET count = ? WHERE name = ?`, [cmd.count, key], (err) =>
      err ? reject(err) : resolve()
    );
  });

  return cmd.count;
}

// Whole-word match only (splits on whitespace) — "ns" won't match
// inside "insight". Called on every message that ISN'T a command, so
// this stays cheap: a Map iteration plus a split, no DB read per call.
async function checkCounterKeywords(db, customCommands, text) {
  const words = text.toLowerCase().split(/\s+/);
  for (const cmd of customCommands.values()) {
    if (cmd.type === 'counter' && words.includes(cmd.name)) {
      await incrementCounter(db, customCommands, cmd.name);
    }
  }
}

export {
  loadCustomCommands,
  hasPermission,
  createCommand,
  deleteCommand,
  incrementCounter,
  checkCounterKeywords,
};
