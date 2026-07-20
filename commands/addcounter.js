export default {
  name: 'addcounter',
  description:
    'Creates a counter — saying the word in chat +1s it, the command displays it, and name+ manually bumps it. (Admin only)',
  adminOnly: true,

  async execute({ channelName, args, botState }) {
    if (!args[0]) {
      await botState.client.me(channelName, `Usage: ${botState.getPrefix()}addcounter <name> [-mod]`);
      return;
    }

    const name = args[0].toLowerCase();
    const permission = args.slice(1).some((a) => a.toLowerCase() === '-mod') ? 'mod' : 'everyone';

    if (botState.commands.has(name)) {
      await botState.client.me(channelName, `✘ "${name}" is already a built-in command.`);
      return;
    }

    const created = await botState.createCustomCommand({ name, type: 'counter', permission });

    if (created === false) {
      await botState.client.me(channelName, `✘ Counter names can't end in "+".`);
      return;
    }
    if (!created) {
      await botState.client.me(channelName, `✘ "${name}" already exists — delete it first.`);
      return;
    }

    const prefix = botState.getPrefix();
    await botState.client.me(
      channelName,
      `✓ Added counter "${name}" — say it in chat to +1 it, ${prefix}${name} to check it, ${prefix}${name}+ to bump it manually`
    );
  },
};
