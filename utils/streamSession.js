// ─── Stream Session Key ─────────────────────────────────────────────
// Identifies the current stream session — used by anything that needs
// to reset a per-user counter once per stream (song request limits,
// the daily claim, and anything else added later). Keyed on the
// stream's started_at from Helix, so a new stream means a new key and
// counters reset automatically with no need to detect the exact
// moment a stream ends. While offline, the key is the literal string
// "offline", so the same allowance/claim applies off-stream too and
// resets when the channel next goes live.

import { getUserByLogin, getStreamByUserId } from './twitchApi.js';

const STREAM_CACHE_MS = 60_000; // don't hit Helix on every single check

const streamCache = new Map(); // channel -> { key, checkedAt }

async function getStreamKey(config, channelName) {
  const cached = streamCache.get(channelName);
  if (cached && Date.now() - cached.checkedAt < STREAM_CACHE_MS) {
    return cached.key;
  }

  try {
    const user = await getUserByLogin(config, channelName);
    const stream = user ? await getStreamByUserId(config, user.id) : null;
    const key = stream?.started_at ?? 'offline';
    streamCache.set(channelName, { key, checkedAt: Date.now() });
    return key;
  } catch (err) {
    console.error('streamSession: failed to check stream status:', err.message);
    return cached?.key ?? 'offline';
  }
}

export { getStreamKey };
