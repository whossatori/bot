// ─── Cooldown Utility ──────────────────────────────────────────────
// Per-user, per-command cooldown so nobody can spam a command. Checked
// centrally in index.js's message handler, so every command (existing
// and future) is covered automatically — no per-command wiring needed.

const COOLDOWN_MS = 5000;

const cooldowns = new Map(); // key: "command:username" -> timestamp of last use

function key(commandName, username) {
  return `${commandName.toLowerCase()}:${username.toLowerCase()}`;
}

function isOnCooldown(commandName, username) {
  const last = cooldowns.get(key(commandName, username));
  if (last === undefined) return false;

  if (Date.now() - last >= COOLDOWN_MS) {
    cooldowns.delete(key(commandName, username));
    return false;
  }
  return true;
}

function getRemainingCooldown(commandName, username) {
  const last = cooldowns.get(key(commandName, username));
  if (last === undefined) return 0;

  const remaining = COOLDOWN_MS - (Date.now() - last);
  return remaining > 0 ? remaining : 0;
}

function setCooldown(commandName, username) {
  cooldowns.set(key(commandName, username), Date.now());
}

export { COOLDOWN_MS, isOnCooldown, getRemainingCooldown, setCooldown };
