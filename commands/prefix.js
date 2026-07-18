export default {
  name: 'prefix',
  description: "Changes the bot's command prefix. (Admin only)",
  adminOnly: true,

  async execute({ channelName, args, botState }) {
    const oldPrefix = botState.getPrefix();

    if (!args[0]) {
      await botState.client.me(
        channelName,
        `Usage: ${oldPrefix}prefix <newprefix>`
      );
      return;
    }

    const newPrefix = args[0];

    // Upsert into settings so the new prefix survives a restart.
    await new Promise((resolve, reject) => {
      botState.db.run(
        `INSERT INTO settings (key, value) VALUES ('prefix', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [newPrefix],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Only flip the live prefix after the DB write succeeds, so in-memory
    // state and what's persisted never disagree.
    botState.setPrefix(newPrefix);

    await botState.client.me(
      channelName,
      `✅ Prefix changed from ${oldPrefix} to ${newPrefix}`
    );
  },
};
