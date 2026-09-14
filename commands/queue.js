export default {
  name: 'queue',
  description: 'Shows the next 5 songs in the queue.',
  adminOnly: false,

  async execute({ channelName, botState }) {
    if (!botState.songRequests.hasConnectedClients()) {
      await botState.client.me(channelName, `✘ song requests aren't connected right now.`);
      return;
    }

    const result = await botState.songRequests.requestAndWait({ type: 'queue' });

    if (!result || !result.success) {
      await botState.client.me(channelName, `✘ couldn't read the queue right now.`);
      return;
    }

    if (!result.tracks || result.tracks.length === 0) {
      await botState.client.me(channelName, `📃 queue is empty.`);
      return;
    }

    const list = result.tracks
      .map((t, i) => `${i + 1}: ${t.label}${t.requestedBy ? ` by ${t.requestedBy}` : ''}`)
      .join(' ');
    await botState.client.me(channelName, list);
  },
};
