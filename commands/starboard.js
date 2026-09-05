export default {
  name: 'starboard',
  description: 'Shows the top 5 users with the most stars.',
  adminOnly: false,

  async execute({ channelName, botState }) {
    const rows = await new Promise((resolve, reject) => {
      botState.db.all(
        `SELECT username, stars FROM stars ORDER BY stars DESC LIMIT 5`,
        (err, rows) => (err ? reject(err) : resolve(rows))
      );
    });

    if (!rows || rows.length === 0) {
      await botState.client.me(channelName, `no stars caught yet ♡`); // customize me
      return;
    }

    const board = rows
      .map((row, i) => `${i + 1}. ${row.username} (${row.stars})`)
      .join('  ');

    const response = `☆ ${board}`; // customize me

    await botState.client.me(channelName, response);
  },
};
