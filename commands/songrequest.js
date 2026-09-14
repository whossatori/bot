export default {
  name: 'songrequest',
  aliases: ['sr'],
  description: 'Requests a song to be added to the queue. Usage: !songrequest <song name, artist, or Spotify link>',
  adminOnly: false,

  async execute({ channelName, senderUsername, args, botState }) {
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
    }s

    await botState.client.me(
      channelName,
      `♪♫ ${result.label ?? query} added to queue by ${senderUsername}`
    );
  },
};