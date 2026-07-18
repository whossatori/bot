import { getUserByLogin, getStreamByUserId, getLatestVod, getIvrUser } from '../utils/twitchApi.js';
import { formatDuration } from '../utils/duration.js';

// Twitch VOD durations come back as e.g. "3h8m33s" or "45m2s" or "58s"
function parseVodDurationToSeconds(durationStr) {
  const match = durationStr.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  const hours = parseInt(match?.[1] || '0', 10);
  const minutes = parseInt(match?.[2] || '0', 10);
  const seconds = parseInt(match?.[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

export default {
  name: 'up',
  aliases: ['uptime', 'down', 'downtime', 'si', 'streaminfo'],
  description: "Shows how long a channel has been live, or how long it's been offline. Defaults to the current channel; optionally take another channel as an argument.",
  adminOnly: false,

  async execute({ channelName, args, botState }) {
    const { config } = botState;
    const targetLogin = (args[0] || channelName).toLowerCase().replace('#', '').trim();

    let user;
    try {
      user = await getUserByLogin(config, targetLogin);
    } catch (err) {
      console.error('up: failed to resolve user:', err.message);
      await botState.client.me(channelName, `❌ Couldn't reach Twitch's API right now.`);
      return;
    }

    if (!user) {
      await botState.client.me(channelName, `❌ No Twitch channel called "${targetLogin}".`);
      return;
    }

    let stream, latestVod;
    try {
      [stream, latestVod] = await Promise.all([
        getStreamByUserId(config, user.id),
        getLatestVod(config, user.id),
      ]);
    } catch (err) {
      console.error('up: failed to fetch stream/vod data:', err.message);
      await botState.client.me(channelName, `❌ Couldn't reach Twitch's API right now.`);
      return;
    }

    // If there's a recent VOD, work out roughly when it ended, and build a
    // link — pointing near the live edge if the VOD is still being written.
    let vodUrl = '';
    let vodEnd = null;
    if (latestVod) {
      const vodDurationSeconds = parseVodDurationToSeconds(latestVod.duration);
      vodEnd = new Date(new Date(latestVod.created_at).getTime() + vodDurationSeconds * 1000);

      if (stream) {
        const offset = 90; // land a little before the live edge
        const clamped = Math.max(vodDurationSeconds - offset, 0);
        vodUrl = `${latestVod.url}?t=${clamped}s`;
      } else {
        vodUrl = latestVod.url;
      }
    }

    if (stream) {
      const duration = formatDuration(Date.now() - new Date(stream.started_at).getTime());
      const game = stream.game_name || 'no category';
      const title = stream.title || '(no title)';
      const viewers = stream.viewer_count.toLocaleString();
      const viewerWord = stream.viewer_count === 1 ? 'viewer' : 'viewers';

      const response =
        `${user.display_name} has been live for ${duration}` +
        ` ♡ playing ${game}` +
        ` ♡ ${viewers} ${viewerWord}` +
        ` ♡ title: ${title}` +
        (vodUrl ? ` ${vodUrl}` : '');

      await botState.client.me(channelName, response);
      return;
    }

    // Offline — Helix has nothing further to say here, so this part
    // leans on IVR's lastBroadcast data instead (see twitchApi.js).
    let ivrUser;
    try {
      ivrUser = await getIvrUser(user.id);
    } catch (err) {
      console.error('up: failed to fetch IVR data:', err.message);
      ivrUser = null;
    }

    const lastBroadcast = ivrUser?.lastBroadcast;

    if (!lastBroadcast?.startedAt) {
      const status = ivrUser?.banned ? 'unavailable' : 'offline';
      const response = ivrUser?.banned
        ? `${user.display_name} is ${status} — never streamed before.`
        : `${user.display_name} is ${status} — never streamed before (or Twitch isn't showing the date). Check https://www.twitch.tv/${targetLogin}/schedule`;

      await botState.client.me(channelName, response);
      return;
    }

    const lastStart = new Date(lastBroadcast.startedAt);

    // If the VOD's computed end time is way off from when the last
    // broadcast actually started, it's probably a stale/unrelated VOD —
    // drop the link rather than risk showing the wrong one.
    if (vodEnd && Math.abs(lastStart.getTime() - vodEnd.getTime()) > 3_600_000) {
      vodUrl = '';
    }

    // "Offline for X" here means time since the last stream STARTED, not
    // ended — Twitch doesn't expose a reliable stream-end timestamp, so
    // this mirrors how the reference bot (and most Twitch bots) compute it.
    const duration = formatDuration(Date.now() - lastStart.getTime());
    const title = latestVod?.title || lastBroadcast.title || '(no title)';

    const response =
      `${user.display_name} has been offline for ${duration}` +
      ` ♡ last title: ${title}` +
      (vodUrl ? ` ${vodUrl}` : '');

    await botState.client.me(channelName, response);
  },
};
