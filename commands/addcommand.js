export default {
  name: 'addcommand',
  description: 'Creates a basic custom command that replies with fixed text. (Admin only)',
  adminOnly: true,

  async execute({ channelName, args, botState }) {
    if (args.length < 2) {
      await botState.client.me(
        channelName,
        `Usage: ${botState.getPrefix()}addcommand <name> <response text> [-mod]`
      );
      return;
    }

    let permission = 'everyone';
    const filtered = args.filter((a) => {
      if (a.toLowerCase() === '-mod') {
        permission = 'mod';
        return false;
      }
      return true;
    });

    const name = filtered[0]?.toLowerCase();
    const response = filtered.slice(1).join(' ');

    if (!name || !response) {
      await botState.client.me(channelName, `✘ Need both a name and response text.`);
      return;
    }

    if (botState.commands.has(name)) {
      await botState.client.me(channelName, `✘ "${name}" is already a built-in command.`);
      return;
    }

    const created = await botState.createCustomCommand({ name, type: 'basic', response, permission });

    if (created === false) {
      await botState.client.me(channelName, `✘ Command names can't end in "+".`);
      return;
    }
    if (!created) {
      await botState.client.me(channelName, `✘ "${name}" already exists — delete it first.`);
      return;
    }

    await botState.client.me(channelName, `✓ Added command ${botState.getPrefix()}${name}`);
  },
};
