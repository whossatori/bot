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

    botState.songRequests.broadcast({
      type: 'request',
      query,
      requestedBy: senderUsername,
    });

    await botState.client.me(channelName, `🎵 requested "${query}" (by ${senderUsername})`);
  },
};
