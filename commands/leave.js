export default {
  name: 'leave',
  description: 'Makes the bot leave a Twitch channel. (Admin only)',
  adminOnly: true,

  async execute({ channelName, args, botState }) {
    if (!args[0]) {
      await botState.client.me(
        channelName,
        `Usage: ${botState.getPrefix()}leave <channel>`
      );
      return;
    }

    const targetChannel = args[0].toLowerCase().replace('#', '').trim();

    const success = await botState.leaveChannel(targetChannel);

    if (success) {
      await botState.client.me(channelName, `👋 Left #${targetChannel}`);
    } else {
      await botState.client.me(
        channelName,
        `❌ Failed to leave #${targetChannel}.`
      );
    }
  },
};