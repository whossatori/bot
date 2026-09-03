import { getUserByLogin, getStreamByUserId } from '../utils/twitchApi.js';
import { getAccount, getCurrentMmr, getMmrHistory } from '../utils/valorantApi.js';

// Same flourish valo.satos.cc's /valo/ranked uses by default, so the
// chat output matches the overlay text byte-for-byte.
const DEFAULT_FLOURISH = 'ʢᴗ.ᴗʡᶻ';

export default {
  name: 'record',
  aliases: ['rec'],
  description: "Shows the streamer's Valorant win/loss record and RR change since going live.",
  adminOnly: false,

  async execute({ channelName, botState }) {
    const { config } = botState;

    if (!config.valorantRiotId || !config.valorantRiotId.includes('#')) {
      console.error('record: valorantRiotId is missing or malformed in config.json (expected "name#tag")');
      await botState.client.me(channelName, `✘ valo acc not added.`);
      return;
    }
    const [riotName, riotTag] = config.valorantRiotId.split('#');

    // The match-history window is "since the stream went live", so this
    // needs the stream's live status (and the Twitch user, for its
    // display name) before asking Henrik for anything.
    let twitchUser, stream;
    try {
      twitchUser = await getUserByLogin(config, channelName);
      stream = twitchUser ? await getStreamByUserId(config, twitchUser.id) : null;
    } catch (err) {
      console.error('record: failed to check stream status:', err.message);
      await botState.client.me(channelName, `Couldn't reach Twitch or the Valorant API right now.`);
      return;
    }

    if (!twitchUser) {
      console.error(`record: no Twitch user found for channel "${channelName}"`);
      await botState.client.me(channelName, `Couldn't reach Twitch or the Valorant API right now.`);
      return;
    }

    if (!stream) {
      await botState.client.me(channelName, `${twitchUser.display_name} is offline`);
      return;
    }

    const streamStart = new Date(stream.started_at).getTime();

    let account, history, current;
    try {
      account = await getAccount(config, riotName, riotTag);
      if (!account) {
        await botState.client.me(channelName, `No Valorant account found for ${riotName}#${riotTag}`);
        return;
      }

      [history, current] = await Promise.all([
        getMmrHistory(config, account.region, 'pc', account.puuid),
        getCurrentMmr(config, account.region, 'pc', account.puuid),
      ]);

      if (!history || !current) {
        await botState.client.me(channelName, `No Valorant account found for ${riotName}#${riotTag}`);
        return;
      }
    } catch (err) {
      console.error('record: failed to fetch Valorant data:', err.message);
      await botState.client.me(channelName, `Couldn't reach Twitch or the Valorant API right now.`);
      return;
    }

    const sessionMatches = history.filter((m) => new Date(m.date).getTime() >= streamStart);

    // Inferred from RR change per match: gained RR = win, lost RR = loss.
    // A match with exactly 0 change (e.g. a fully derank-protected loss)
    // isn't counted either way — rare, but worth knowing about.
    const wins = sessionMatches.filter((m) => m.last_change > 0).length;
    const losses = sessionMatches.filter((m) => m.last_change < 0).length;
    const netRr = sessionMatches.reduce((sum, m) => sum + m.last_change, 0);
    const winRate = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(2) : '0.00';
    const direction = netRr > 0 ? 'up' : netRr < 0 ? 'down' : 'even';
    const signedRr = netRr > 0 ? `+${netRr}` : `${netRr}`;

    const response =
      `${twitchUser.display_name} is ${direction} ${signedRr}RR  ` +
      `${wins}W - ${losses}L, ${winRate}% wr ` +
      `currently: ${current.tier.name} ${current.rr}RR  ${DEFAULT_FLOURISH}`;

    await botState.client.me(channelName, response);
  },
};