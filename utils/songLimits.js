// ─── Song Request Limits ───────────────────────────────────────────
// Every non-privileged user gets a set number of free song requests
// per stream (config.songRequestFreeLimit, default 5). Mods, VIPs, the
// broadcaster and the configured admin are exempt entirely. Once a
// user is out, they can still request via the channel point reward
// (see the custom-reward-id routing in index.js), which never counts
// against the free allowance.
//
// "Per stream" comes from utils/streamSession.js's getStreamKey — this
// file only handles the limit/usage side, nothing stream-session
// related lives here anymore.

const DEFAULT_FREE_LIMIT = 5;

function getFreeLimit(config) {
  return Number.isInteger(config.songRequestFreeLimit)
    ? config.songRequestFreeLimit
    : DEFAULT_FREE_LIMIT;
}

// Mods, VIPs, the broadcaster and the admin bypass the limit.
function isPrivileged(msg, config) {
  if (!msg) return false;

  const sender = msg.senderUsername?.toLowerCase();
  if (sender && sender === config.admin?.toLowerCase()) return true;
  if (sender && sender === msg.channelName?.toLowerCase()) return true; // broadcaster
  if (msg.isMod) return true;

  // hasVIP is the documented getter, but fall back to the raw badge
  // string so a library shape change can't silently drop VIP status.
  if (msg.badges?.hasVIP) return true;
  if (typeof msg.badgesRaw === 'string' && /(^|,)vip\//.test(msg.badgesRaw)) return true;

  return false;
}

// How many free requests this user has left this stream.
function getRemaining(db, userId, streamKey, limit) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT used FROM song_request_usage WHERE user_id = ? AND stream_key = ?`,
      [userId, streamKey],
      (err, row) => {
        if (err) return reject(err);
        const used = row ? row.used : 0;
        resolve(Math.max(0, limit - used));
      }
    );
  });
}

// Records one used request. The CASE resets the counter to 1 whenever
// the stored row belongs to a previous stream, so old counts expire on
// their own with no cleanup pass needed.
function consume(db, userId, username, streamKey) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO song_request_usage (user_id, username, stream_key, used)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(user_id) DO UPDATE SET
         used = CASE WHEN stream_key = excluded.stream_key THEN used + 1 ELSE 1 END,
         stream_key = excluded.stream_key,
         username = excluded.username`,
      [userId, username, streamKey],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

export { getFreeLimit, isPrivileged, getRemaining, consume };