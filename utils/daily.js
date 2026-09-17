// ─── Daily Claim ───────────────────────────────────────────────────
// Backs the "daily" channel point reward: a per-user counter that can
// only go up once per stream, so the total doubles as a rough measure
// of how many streams someone has shown up for.
//
// Reuses songLimits' stream key (the stream's Helix started_at, or
// "offline") to decide what "this stream" means — same mechanism that
// resets free song requests.

import { getStreamKey } from './streamSession.js';

// { claimed: true, total } on a fresh claim, { claimed: false, total }
// if they already claimed this stream. Twitch's own reward setting
// ("limit redemptions per user per stream") should normally stop a
// second redeem ever reaching this — the check here is a safety net
// in case that setting isn't enabled.
async function claimDaily(botState, msg, channelName) {
  const { config, db } = botState;
  const streamKey = await getStreamKey(config, channelName);
  const userId = msg.senderUserID;
  const username = msg.senderUsername;

  const row = await new Promise((resolve, reject) => {
    db.get(
      `SELECT total, stream_key FROM daily_claims WHERE user_id = ?`,
      [userId],
      (err, r) => (err ? reject(err) : resolve(r))
    );
  });

  if (row && row.stream_key === streamKey) {
    return { claimed: false, total: row.total };
  }

  const total = (row?.total ?? 0) + 1;

  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO daily_claims (user_id, username, stream_key, total)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         total = excluded.total,
         stream_key = excluded.stream_key,
         username = excluded.username`,
      [userId, username, streamKey, total],
      (err) => (err ? reject(err) : resolve())
    );
  });

  return { claimed: true, total };
}

export { claimDaily };