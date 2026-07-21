export default {
  name: 'stars',
  description: "Shows how many stars you (or someone else) have caught.",
  adminOnly: false,

  async execute({ args, channelName, senderUsername, msg, botState }) {
    const targetArg = args[0]?.replace(/^@/, '');

    if (!targetArg) {
      // Self-lookup by user_id — authoritative, doesn't depend on the
      // cached username column being up to date for the caller.
      const row = await new Promise((resolve, reject) => {
        botState.db.get(
          `SELECT stars FROM stars WHERE user_id = ?`,
          [msg.sender.id],
          (err, row) => (err ? reject(err) : resolve(row))
        );
      });

      const count = row ? row.stars : 0;
      const response =
        count > 0
          ? `@${senderUsername} you have ${count} star${count === 1 ? '' : 's'} ☆` // customize me
          : `@${senderUsername} you haven't caught any stars yet ♡`; // customize me

      await botState.client.me(channelName, response);
      return;
    }

    // Looking up someone else — no Twitch API call, just matches against
    // whatever username was last recorded the last time they caught one.
    const row = await new Promise((resolve, reject) => {
      botState.db.get(
        `SELECT stars, username FROM stars WHERE LOWER(username) = LOWER(?)`,
        [targetArg],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    });

    const displayName = row ? row.username : targetArg;
    const count = row ? row.stars : 0;
    const response =
      count > 0
        ? `${displayName} has ${count} star${count === 1 ? '' : 's'} ☆` // customize me
        : `${displayName} hasn't caught any stars yet ♡`; // customize me

    await botState.client.me(channelName, response);
  },
};
