// ─── HenrikDev Valorant API Helper ─────────────────────────────────
// Unofficial Valorant API (api.henrikdev.xyz). Riot doesn't grant
// production API access for match history/MMR to third-party apps
// like this one, so this community-run API is the standard source
// for it. Requires config.henrikApiKey — get one at
// https://api.henrikdev.xyz/dashboard/ ("API Keys" in the sidebar).

const BASE_URL = 'https://api.henrikdev.xyz';

async function henrikGet(config, path) {
  if (!config.henrikApiKey) {
    throw new Error('Missing henrikApiKey in config.json — required for Valorant API calls.');
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: config.henrikApiKey,
    },
  });

  // 404 means "no such account/no data" rather than a real failure —
  // callers check for null instead of catching an error for this case.
  if (res.status === 404) return null;

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Valorant API request to "${path}" failed: ${res.status} ${detail}`);
  }

  return res.json();
}

// Resolves a Riot ID (name#tag) to a puuid + region — both required
// by the by-puuid endpoints below. Returns null if no such account.
async function getAccount(config, name, tag) {
  const data = await henrikGet(
    config,
    `/valorant/v2/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`
  );
  return data?.data ?? null;
}

// Current rank tier + RR. Returns null if no data.
async function getCurrentMmr(config, region, platform, puuid) {
  const data = await henrikGet(config, `/valorant/v3/by-puuid/mmr/${region}/${platform}/${puuid}`);
  return data?.data?.current ?? null;
}

// Per-match RR history. Each entry's last_change is the RR delta for
// that one match (positive = gained RR, negative = lost RR) — there's
// no separate win/loss flag on this endpoint, and cross-referencing
// full match details for every entry just to get that flag would cost
// one extra API call per match for no real gain here. Returns null if
// no data.
async function getMmrHistory(config, region, platform, puuid) {
  const data = await henrikGet(
    config,
    `/valorant/v2/by-puuid/mmr-history/${region}/${platform}/${puuid}`
  );
  return data?.data?.history ?? null;
}

// Current + peak rank directly by Riot ID, no account/puuid lookup
// needed. Unlike the by-puuid helpers above (which assume you already
// know the account's region, e.g. from your own config), this is for
// looking up an arbitrary player, so the caller supplies the region
// explicitly — Henrik can't reliably guess it for an account it hasn't
// already cached. Returns null if no such account/rank data.
async function getMmrByRiotId(config, region, name, tag) {
  const data = await henrikGet(
    config,
    `/valorant/v3/mmr/${region}/pc/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`
  );
  return data?.data ?? null;
}

// Recent match history by puuid, filtered by mode (e.g. "competitive")
// and capped at `size` matches — used to compute win rate / headshot %
// over a sample of games. v4 specifically (not v3): v3 still returns
// Henrik's legacy shape (players.all_players as an object, "team"
// instead of "team_id"), while v4 gives a flat players array with the
// nested stats.headshots/bodyshots/legshots this relies on. Returns
// null if no data.
async function getMatchesByPuuid(config, region, puuid, { mode, size } = {}) {
  const params = new URLSearchParams();
  if (mode) params.set('mode', mode);
  if (size) params.set('size', String(size));
  const query = params.toString() ? `?${params.toString()}` : '';

  const data = await henrikGet(config, `/valorant/v4/by-puuid/matches/${region}/pc/${puuid}${query}`);
  return data?.data ?? null;
}

export { getAccount, getCurrentMmr, getMmrHistory, getMmrByRiotId, getMatchesByPuuid };