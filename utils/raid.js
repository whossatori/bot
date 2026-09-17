// ─── Raid Shoutout ─────────────────────────────────────────────────
// Fires instantly when someone raids the channel. Raids arrive as a
// USERNOTICE with msg-id=raid, wired up in index.js.
//
// "Last played" comes from Helix's channels endpoint — game_name is
// whatever the raider's channel is currently set to, which for a
// channel that just stopped streaming is the last thing they played.

import { getUserByLogin, getChannelInfo } from './twitchApi.js';

async function handleRaid({ msg, botState }) {
  const { config } = botState;

  // The @mastondzn fork exposes sender/channel objects, the original
  // exposes senderUsername/channelName — read every shape so a library
  // difference can't silently break the shoutout.
  const raider =
    msg.eventParams?.login ?? msg.sender?.login ?? msg.senderUsername ?? null;
  const channelName = msg.channel?.login ?? msg.channelName ?? null;

  if (!raider || !channelName) {
    console.error('raid: could not read raider/channel from USERNOTICE');
    return;
  }

  let game = null;
  try {
    const user = await getUserByLogin(config, raider);
    const channel = user ? await getChannelInfo(config, user.id) : null;
    game = channel?.game_name || null;
  } catch (err) {
    // Shoutout still goes out without the game rather than not at all.
    console.error('raid: failed to fetch raider channel info:', err.message);
  }

  const response = game
    ? `♡ show some love to twitch.tv/${raider} they last played ${game} 𑣲⋆`
    : `♡ show some love to twitch.tv/${raider} 𑣲⋆`;

  await botState.client.me(channelName, response);
}

export { handleRaid };
