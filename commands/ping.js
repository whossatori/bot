import { performance } from 'perf_hooks';
import { formatDuration } from '../utils/duration.js';

export default {
  name: 'ping',
  description: 'Shows bot statistics including latency, RAM, uptime, and more.',
  adminOnly: false,

  async execute({ channelName, botState }) {
    const { startTime } = botState;
    const prefix = botState.getPrefix();

    // Round-trip latency to Twitch's IRC server: sends a raw PING and times
    // how long it takes to get the matching PONG back (2s timeout, handled
    // internally by dank-twitch-irc's client.ping()).
    let latency;
    try {
      const t1 = performance.now();
      await botState.client.ping();
      const t2 = performance.now();
      const Latency = (t2 - t1).toFixed(0);
      latency = `${Latency}ms`;
    } catch (err) {
      latency = 'timeout';
    }

    const memoryUsage = process.memoryUsage();
    const ramMB = (memoryUsage.rss / (1024 * 1024)).toFixed(2);

    const uptime = formatDuration(Date.now() - startTime);
    const channelCount = botState.getActiveChannelCount();
    const cmdsUsed = botState.getCommandsUsed();

    const response =
      `🏓 latency: ${latency}` +
      ` ♡ RAM usage: ${ramMB}MB` +
      ` ♡ uptime: ${uptime}` +
      ` ♡ channels: ${channelCount}` +
      ` ♡ cmds used: ${cmdsUsed}` +
      ` ♡ prefix: ${prefix}`;

    await botState.client.me(channelName, response);
  },
};