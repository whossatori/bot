import { getAccount, getMmrByRiotId, getMatchesByPuuid } from '../utils/valorantApi.js';

const VALID_REGIONS = ['ap', 'br', 'eu', 'kr', 'latam', 'na'];
const MATCH_SAMPLE_SIZE = 10; // recent competitive matches used for win rate / hs%

export default {
  name: 'find',
  description: "Looks up any Valorant player's rank, peak rank, win rate and headshot %. Usage: !find <name#tag> -<region>",
  adminOnly: false,

  async execute({ channelName, args, botState }) {
    const { config } = botState;
    const prefix = botState.getPrefix();

    const riotId = args[0];
    const regionArg = args[1];

    if (!riotId || !riotId.includes('#') || !regionArg || !regionArg.startsWith('-')) {
      await botState.client.me(
        channelName,
        `Usage: ${prefix}find <name#tag> -<region> (ap/br/eu/kr/latam/na)`
      );
      return;
    }

    const [name, tag] = riotId.split('#');
    const region = regionArg.slice(1).toLowerCase();

    if (!VALID_REGIONS.includes(region)) {
      await botState.client.me(
        channelName,
        `✘ invalid region "${region}". Use one of: ${VALID_REGIONS.join(', ')}`
      );
      return;
    }

    let account, mmr, matches;
    try {
      // Only used to resolve a puuid for the match-history lookup below.
      // Rank/peak use the region YOU gave directly (see getMmrByRiotId) —
      // that's the whole point of taking region as an argument here,
      // unlike record.js/rank.js which already know their own account's.
      account = await getAccount(config, name, tag);
      if (!account) {
        await botState.client.me(channelName, `No Valorant account found for ${name}#${tag}`);
        return;
      }

      mmr = await getMmrByRiotId(config, region, name, tag);
      if (!mmr) {
        await botState.client.me(
          channelName,
          `No rank data found for ${name}#${tag} in ${region} — check the region is right.`
        );
        return;
      }

      matches = await getMatchesByPuuid(config, region, account.puuid, {
        mode: 'competitive',
        size: MATCH_SAMPLE_SIZE,
      });
    } catch (err) {
      console.error('find: failed to fetch Valorant data:', err.message);
      await botState.client.me(channelName, `Couldn't reach the Valorant API right now.`);
      return;
    }

    if (!mmr.current?.tier) {
      await botState.client.me(channelName, `${name}#${tag} is unranked in ${region}.`);
      return;
    }

    const currentLine = `${mmr.current.tier.name} ${mmr.current.rr}RR`;
    const peakLine = mmr.peak?.tier?.name ? ` (peak ${mmr.peak.tier.name})` : '';

    let statsLine = ' — no competitive match history';
    if (matches && matches.length > 0) {
      let wins = 0;
      let headshots = 0;
      let bodyshots = 0;
      let legshots = 0;

      for (const match of matches) {
        // Matched by puuid (not name#tag) — reliable even across a
        // display-name change between matches.
        const player = match.players?.find((p) => p.puuid === account.puuid);
        if (!player) continue;

        headshots += player.stats?.headshots ?? 0;
        bodyshots += player.stats?.bodyshots ?? 0;
        legshots += player.stats?.legshots ?? 0;

        const teamResult = match.teams?.[player.team_id?.toLowerCase()];
        if (teamResult?.has_won) wins++;
      }

      const totalShots = headshots + bodyshots + legshots;
      const hsPercent = totalShots > 0 ? ((headshots / totalShots) * 100).toFixed(1) : '0.0';
      const winRate = ((wins / matches.length) * 100).toFixed(1);

      statsLine = ` — ${winRate}% wr, ${hsPercent}% hs (last ${matches.length} comp)`;
    }

    const response = `${name}#${tag} is ${currentLine}${peakLine}${statsLine}`;

    await botState.client.me(channelName, response);
  },
};
