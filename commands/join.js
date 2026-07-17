export default {
  name: 'join',
  description: 'Makes the bot join a new Twitch channel. (Admin only)',
  adminOnly: true,

  async execute({ channelName, args, botState }) {
    if (!args[0]) {
      await botState.client.me(
        channelName,
        `Usage: ${botState.config.prefix}join <channel>`
      );
      return;
    }

    const targetChannel = args[0].toLowerCase().replace('#', '').trim();

    if (targetChannel === botState.config.username.toLowerCase()) {
      await botState.client.me(channelName, `❌ Cannot join own channel.`);
      return;
    }

    const success = await botState.joinChannel(targetChannel);

    if (success) {
      await botState.client.me(channelName, `✅ Joined #${targetChannel}`);
    } else {
      await botState.client.me(
        channelName,
        `❌ Failed to join #${targetChannel}.`
      );
    }
  },
};