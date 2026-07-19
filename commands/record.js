import { getUserByLogin, getStreamByUserId } from '../utils/twitchApi.js';
import { getAccount, getCurrentMmr, getMmrHistory } from '../utils/valorantApi.js';

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
    // needs the stream's actual start time first.
    let stream;
    try {
      const twitchUser = await getUserByLogin(config, channelName);
      stream = twitchUser ? await getStreamByUserId(config, twitchUser.id) : null;
    } catch (err) {
      console.error('record: failed to check stream status:', err.message);
      await botState.client.me(channelName, `✘ cant reach twitch api.`);
      return;
    }

    if (!stream) {
      await botState.client.me(channelName, `✘ not live.`);
      return;
    }

    const streamStart = new Date(stream.started_at).getTime();

    let account, history, current;
    try {
      account = await getAccount(config, riotName, riotTag);
      [history, current] = await Promise.all([
        getMmrHistory(config, account.region, 'pc', account.puuid),
        getCurrentMmr(config, account.region, 'pc', account.puuid),
      ]);
    } catch (err) {
      console.error('record: failed to fetch Valorant data:', err.message);
      await botState.client.me(channelName, `✘ cant reach valo api.`);
      return;
    }

    const sessionMatches = history.filter((m) => new Date(m.date).getTime() >= streamStart);

    if (sessionMatches.length === 0) {
      await botState.client.me(
        channelName,
        `${account.name} hasn't played a competitive match yet this stream. Currently: ${current.tier.name} ${current.rr}RR`
      );
      return;
    }

    // Inferred from RR change per match: gained RR = win, lost RR = loss.
    // A match with exactly 0 change (e.g. a fully derank-protected loss)
    // isn't counted either way — rare, but worth knowing about.
    const wins = sessionMatches.filter((m) => m.last_change > 0).length;
    const losses = sessionMatches.filter((m) => m.last_change < 0).length;
    const netRr = sessionMatches.reduce((sum, m) => sum + m.last_change, 0);

    let rrLine;
    if (netRr > 0) rrLine = `is up ${netRr}RR`;
    else if (netRr < 0) rrLine = `is down ${Math.abs(netRr)}RR`;
    else rrLine = `is even`;

    const response =
      `${account.name} is down ${rrLine} ( ${wins}W ♡ ${losses}L ) Currently: ${current.tier.name} ${current.rr}RR ꕥ`;

    await botState.client.me(channelName, response);
  },
};
