import { getUserByLogin, getStreamByUserId, getIvrUser } from '../utils/twitchApi.js';
import { formatDuration } from '../utils/duration.js';

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

    let stream;
    try {
      stream = await getStreamByUserId(config, user.id);
    } catch (err) {
      console.error('up: failed to fetch stream data:', err.message);
      await botState.client.me(channelName, `❌ Couldn't reach Twitch's API right now.`);
      return;
    }

    if (stream) {
      const duration = formatDuration(Date.now() - new Date(stream.started_at).getTime());
      await botState.client.me(
        channelName,
        `${user.display_name} has been live for ${duration}`
      );
      return;
    }

    // Offline — Helix has nothing further to say here, so this leans on
    // IVR's lastBroadcast data instead (see twitchApi.js).
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

    // "Offline for X" here means time since the last stream STARTED, not
    // ended — Twitch doesn't expose a reliable stream-end timestamp, so
    // this mirrors how the reference bot (and most Twitch bots) compute it.
    const duration = formatDuration(Date.now() - new Date(lastBroadcast.startedAt).getTime());

    await botState.client.me(
      channelName,
      `${user.display_name} has been offline for ${duration}`
    );
  },
};