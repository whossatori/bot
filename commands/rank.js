import { getAccount, getCurrentMmr } from '../utils/valorantApi.js';

// Matches valo.satos.cc's /valo/rank default flourish (different from
// /valo/ranked's, which record.js uses).
const DEFAULT_RANK_FLOURISH = '૮ ˃̵ ֊ ˂̵ ა';

export default {
  name: 'rank',
  description: "Shows the streamer's current Valorant rank and RR. Works whether they're live or not.",
  adminOnly: false,

  async execute({ channelName, botState }) {
    const { config } = botState;

    if (!config.valorantRiotId || !config.valorantRiotId.includes('#')) {
      console.error('rank: valorantRiotId is missing or malformed in config.json (expected "name#tag")');
      await botState.client.me(channelName, `✘ valo acc not added.`);
      return;
    }
    const [riotName, riotTag] = config.valorantRiotId.split('#');

    // No live check here at all — unlike !record, current rank doesn't
    // depend on stream state, so this never touches the Twitch API.
    let account, current;
    try {
      account = await getAccount(config, riotName, riotTag);
      if (!account) {
        await botState.client.me(channelName, `No Valorant account found for ${riotName}#${riotTag}`);
        return;
      }

      current = await getCurrentMmr(config, account.region, 'pc', account.puuid);
      if (!current) {
        await botState.client.me(channelName, `No Valorant account found for ${riotName}#${riotTag}`);
        return;
      }
    } catch (err) {
      console.error('rank: failed to fetch Valorant data:', err.message);
      await botState.client.me(channelName, `Couldn't reach the Valorant API right now.`);
      return;
    }

    const response = `${channelName} is currently ${current.tier.name} ${current.rr}RR ${DEFAULT_RANK_FLOURISH}`;

    await botState.client.me(channelName, response);
  },
};
