export default {
  name: 'skip',
  description: 'Skips the current song. (Admin only)',
  adminOnly: true,

  async execute({ channelName, senderUsername, botState }) {
    if (!botState.songRequests.hasConnectedClients()) {
      await botState.client.me(channelName, `✘ song requests aren't connected right now.`);
      return;
    }

    const result = await botState.songRequests.requestAndWait({
      type: 'skip',
      requestedBy: senderUsername,
    });

    if (!result) {
      await botState.client.me(channelName, `➜ skip sent (by ${senderUsername})`);
      return;
    }

    if (!result.success) {
      await botState.client.me(channelName, `✘ ${result.error || 'failed to skip'}`);
      return;
    }

    if (!result.label) {
      await botState.client.me(channelName, `➜ song skipped`);
      return;
    }

    const by = result.requestedBy ? ` by ${result.requestedBy}` : '';
    await botState.client.me(channelName, `➜ song skipped now playing: ${result.label}${by}`);
  },
};
