import { getUserByLogin } from '../utils/twitchApi.js';

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
  description: '15% chance to catch a star. Optionally target another user: !star @user',
  adminOnly: false,

  async execute({ channelName, senderUsername, args, msg, botState }) {
    const { config } = botState;
    const targetArg = args[0]?.replace(/^@/, '');

    // No argument: identical to the old behavior, no extra API call —
    // roll for whoever sent the command, using the IRC message's own
    // sender info (id + username) directly.
    let targetId, targetName;
    if (!targetArg) {
      targetId = msg.sender.id;
      targetName = senderUsername;
    } else {
      // Argument given: rolling for someone else instead, so their
      // numeric Twitch id has to be resolved via Helix first — the
      // stars table is keyed on user_id, not username.
      let targetUser;
      try {
        targetUser = await getUserByLogin(config, targetArg);
      } catch (err) {
        console.error('star: failed to resolve target user:', err.message);
        await botState.client.me(channelName, `✘ cant reach twitch.`);
        return;
      }

      if (!targetUser) {
        await botState.client.me(channelName, `✘ no user called "${targetArg}".`);
        return;
      }

      targetId = targetUser.id;
      targetName = targetUser.display_name;
    }

    const caught = Math.random() < 0.15;

    if (!caught) {
      const missText = MISS_MESSAGES[Math.floor(Math.random() * MISS_MESSAGES.length)];
      const response = `@${targetName} ${missText}`;
      await botState.client.me(channelName, response);
      return;
    }

    // Upsert: new user starts at 1 star, existing user gets +1. Keyed on
    // user_id (not username) so renames don't split someone's total.
    await new Promise((resolve, reject) => {
      botState.db.run(
        `INSERT INTO stars (user_id, username, stars) VALUES (?, ?, 1)
         ON CONFLICT(user_id) DO UPDATE SET stars = stars + 1, username = excluded.username`,
        [targetId, targetName],
        (err) => (err ? reject(err) : resolve())
      );
    });

    const total = await new Promise((resolve, reject) => {
      botState.db.get(
        `SELECT stars FROM stars WHERE user_id = ?`,
        [targetId],
        (err, row) => (err ? reject(err) : resolve(row ? row.stars : 1))
      );
    });

    const response = `@${targetName} caught a  ☆ u have ${total} stars ꕥ`; // customize me
    await botState.client.me(channelName, response);
  },
};