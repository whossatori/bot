export default {
  name: 'addtimer',
  description: 'Creates a timer that auto-posts a message to every joined channel on an interval. (Admin only)',
  adminOnly: true,

  async execute({ channelName, args, botState }) {
    const minutes = parseInt(args[1], 10);

    if (!args[0] || !minutes || minutes <= 0 || args.length < 3) {
      await botState.client.me(
        channelName,
        `Usage: ${botState.getPrefix()}addtimer <name> <interval_minutes> <message>`
      );
      return;
    }

    const name = args[0].toLowerCase();
    const response = args.slice(2).join(' ');

    if (botState.commands.has(name)) {
      await botState.client.me(channelName, `✘ "${name}" is already a built-in command.`);
      return;
    }

    const created = await botState.createCustomCommand({
      name,
      type: 'timer',
      response,
      intervalMinutes: minutes,
    });

    if (created === false) {
      await botState.client.me(channelName, `✘ Timer names can't end in "+".`);
      return;
    }
    if (!created) {
      await botState.client.me(channelName, `✘ "${name}" already exists — delete it first.`);
      return;
    }

    await botState.client.me(channelName, `✓ Added timer "${name}" — posts every ${minutes}m`);
  },
};
