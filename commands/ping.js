import { performance } from 'perf_hooks';

function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts[0]}, ${parts[1]}, and ${parts[2]}`;
}

export default {
  name: 'ping',
  description: 'Shows bot statistics including latency, RAM, uptime, and more.',
  adminOnly: false,

  async execute({ channelName, botState }) {
    const { config, startTime } = botState;

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

    const uptime = formatUptime(Date.now() - startTime);
    const channelCount = botState.getActiveChannelCount();
    const cmdsUsed = botState.getCommandsUsed();

    const response =
      `🏓 latency: ${latency}` +
      ` ♡ RAM usage: ${ramMB}MB` +
      ` ♡ uptime: ${uptime}` +
      ` ♡ channels: ${channelCount}` +
      ` ♡ cmds used: ${cmdsUsed}` +
      ` ♡ prefix: ${config.prefix}`;

    await botState.client.me(channelName, response);
  },
};