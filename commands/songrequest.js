import {
  getFreeLimit,
  getStreamKey,
  isPrivileged,
  getRemaining,
  consume,
} from '../utils/songLimits.js';

export default {
  name: 'songrequest',
  aliases: ['sr'],
  description: 'Requests a song to be added to the queue. Usage: !songrequest <song name, artist, or Spotify link>',
  adminOnly: false,

  // isRedeem is set by index.js when this was triggered by the channel
  // point reward rather than typed as a command — those never count
  // against the free allowance.
  async execute({ channelName, senderUsername, msg, args, botState, isRedeem = false }) {
    const { config } = botState;
    const prefix = botState.getPrefix();
    const query = args.join(' ').trim();

    if (!query) {
      await botState.client.me(
        channelName,
        `Usage: ${prefix}songrequest <song name, artist, or Spotify link>`
      );
      return;
    }

    if (!botState.songRequests.hasConnectedClients()) {
      await botState.client.me(channelName, `✘ song requests aren't connected right now.`);
      return;
    }

    // Limit check happens before the request, but the count is only
    // consumed after it actually queues — a failed lookup shouldn't
    // burn one of someone's free requests.
    const limited = !isRedeem && !isPrivileged(msg, config);
    const limit = getFreeLimit(config);
    let streamKey;

    if (limited) {
      streamKey = await getStreamKey(config, channelName);

      let remaining;
      try {
        remaining = await getRemaining(botState.db, msg.senderUserID, streamKey, limit);
      } catch (err) {
        console.error('songrequest: failed to read usage:', err.message);
        remaining = limit; // don't lock people out over a DB hiccup
      }

      if (remaining <= 0) {
        await botState.client.me(
          channelName,
          `@${senderUsername} all free song requests used ♪`
        );
        return;
      }
    }

    const result = await botState.songRequests.requestAndWait({
      type: 'request',
      query,
      requestedBy: senderUsername,
    });

    if (!result) {
      // Sent, but no reply came back in time — still tell them it went
      // out rather than leaving them wondering.
      await botState.client.me(channelName, `♪♫ "${query}" requested by ${senderUsername}`);
      return;
    }

    if (!result.success) {
      await botState.client.me(
        channelName,
        `✘ ${result.error || `couldn't queue "${query}"`}`
      );
      return;
    }

    if (limited) {
      try {
        await consume(botState.db, msg.senderUserID, senderUsername, streamKey);
      } catch (err) {
        console.error('songrequest: failed to record usage:', err.message);
      }
    }

    await botState.client.me(
      channelName,
      `♪♫ ${result.label ?? query} added to queue by ${senderUsername}`
    );
  },
};