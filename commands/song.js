export default {
  name: 'song',
  description: 'Shows the currently playing song, and who requested it if it was a request.',
  adminOnly: false,

  async execute({ channelName, botState }) {
    if (!botState.songRequests.hasConnectedClients()) {
      await botState.client.me(channelName, `✘ song requests aren't connected right now.`);
      return;
    }

    const result = await botState.songRequests.requestAndWait({ type: 'song' });

    if (!result || !result.success) {
      await botState.client.me(
        channelName,
        `✘ ${result?.error || `couldn't read the current song right now.`}`
      );
      return;
    }

    const by = result.requestedBy ? ` by ${result.requestedBy}` : '';
    await botState.client.me(channelName, `♪♫ now playing: ${result.label}${by}`);
  },
};
