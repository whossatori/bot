// 5 separate lines so each can be edited independently — @user prefix is
// applied automatically below, just change the text on each line.
const MISS_MESSAGES = [
  `no ✶✰｡`,
  `u suck ✰⭒`,
  `stop trying ✶.✰`,
  `give up ✰.`,
  `lol... ✰˚࿔`,
];

export default {
  name: 'star',
  description: '25% chance to catch a star.',
  adminOnly: false,

  async execute({ channelName, senderUsername, msg, botState }) {
    const caught = Math.random() < 0.40;

    if (!caught) {
      const missText = MISS_MESSAGES[Math.floor(Math.random() * MISS_MESSAGES.length)];
      const response = `@${senderUsername} ${missText}`;
      await botState.client.me(channelName, response);
      return;
    }

    const userId = msg.sender.id; // Twitch numeric user ID — stable across username changes

    // Upsert: new user starts at 1 star, existing user gets +1. Keyed on
    // user_id (not username) so renames don't split someone's total.
    await new Promise((resolve, reject) => {
      botState.db.run(
        `INSERT INTO stars (user_id, username, stars) VALUES (?, ?, 1)
         ON CONFLICT(user_id) DO UPDATE SET stars = stars + 1, username = excluded.username`,
        [userId, senderUsername],
        (err) => (err ? reject(err) : resolve())
      );
    });

    const total = await new Promise((resolve, reject) => {
      botState.db.get(
        `SELECT stars FROM stars WHERE user_id = ?`,
        [userId],
        (err, row) => (err ? reject(err) : resolve(row ? row.stars : 1))
      );
    });

    const response = `@${senderUsername} caught a  ☆ u have ${total} stars ꕥ`; // customize me
    await botState.client.me(channelName, response);
  },
};
