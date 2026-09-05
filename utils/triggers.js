// ─── Prefix-less keyword triggers ──────────────────────────────────
// Unlike normal commands (which need the bot's prefix), these fire on
// a bare word appearing anywhere in a message. Checked on every
// PRIVMSG in index.js, before the prefix check.
//
// Each trigger has its own count (persisted in the stats table, same
// place commands_used lives) and its own 10s cooldown. Cooldowns are
// global per trigger (not per-user) and independent of each other —
// "nt" going on cooldown doesn't touch "ns" or "lol".

const COOLDOWN_MS = 10_000;

// Matched case-insensitively as a whole word anywhere in the message
// (\b...\b), so "nt" matches "nt" and "gg nt" but not "cant". Each
// response gets the trigger's new total count appended automatically
// via {count} — edit the text freely, just keep the {count} in there.
const TRIGGERS = [
  {
    key: 'nt',
    regex: /\bnt\b/i,
    response: (count) => `nt happens to the best of us #${count}`, // customize me
  },
  {
    key: 'ns',
    regex: /\bns\b/i,
    response: (count) => `ns! #${count}`, // customize me
  },
  {
    key: 'lol',
    regex: /\blol\b/i,
    response: (count) => `lol #${count}`, // customize me
  },
];

const lastTriggered = new Map(); // trigger key -> timestamp of last fire

function isOnCooldown(key) {
  const last = lastTriggered.get(key);
  if (last === undefined) return false;

  if (Date.now() - last >= COOLDOWN_MS) {
    lastTriggered.delete(key);
    return false;
  }
  return true;
}

// Checks `text` against every trigger, firing (and counting) any whole
// match that isn't on cooldown. Multiple triggers can fire off a
// single message (e.g. "lol nt") — each is independent.
async function handleTriggers({ text, channelName, botState }) {
  for (const trigger of TRIGGERS) {
    if (!trigger.regex.test(text)) continue;
    if (isOnCooldown(trigger.key)) continue;

    lastTriggered.set(trigger.key, Date.now());

    const dbKey = `trigger_${trigger.key}`;

    // Same upsert pattern as star.js: 1 on first fire, +1 after.
    await new Promise((resolve, reject) => {
      botState.db.run(
        `INSERT INTO stats (key, value) VALUES (?, 1)
         ON CONFLICT(key) DO UPDATE SET value = value + 1`,
        [dbKey],
        (err) => (err ? reject(err) : resolve())
      );
    });

    const count = await new Promise((resolve, reject) => {
      botState.db.get(
        `SELECT value FROM stats WHERE key = ?`,
        [dbKey],
        (err, row) => (err ? reject(err) : resolve(row ? row.value : 1))
      );
    });

    await botState.client.me(channelName, trigger.response(count));
  }
}

export { handleTriggers };
