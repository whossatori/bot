export default {
  name: 'delcommand',
  description: 'Deletes a custom command, counter, or timer by name. (Admin only)',
  adminOnly: true,

  async execute({ channelName, args, botState }) {
    if (!args[0]) {
      await botState.client.me(channelName, `Usage: ${botState.getPrefix()}delcommand <name>`);
      return;
    }

    const name = args[0].toLowerCase();
    const deleted = await botState.deleteCustomCommand(name);

    await botState.client.me(
      channelName,
      deleted ? `✓ Deleted "${name}"` : `✘ No custom command called "${name}".`
    );
  },
};
