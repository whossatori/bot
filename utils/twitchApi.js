// ─── Twitch API Helper ─────────────────────────────────────────────
// Handles the app access token (Client Credentials flow) needed to call
// Twitch's Helix API, and wraps the specific endpoints used by commands.
//
// Requires config.clientId + config.clientSecret from the Twitch Dev
// Console (https://dev.twitch.tv/console/apps) — a DIFFERENT credential
// pair from the bot's chat oauth token, which only logs into IRC.
//
// Helix only tells you if a channel is CURRENTLY live. It has no
// "when did they last stream" endpoint for offline channels, so
// getIvrUser() calls api.ivr.fi (a third-party, unauthenticated,
// community-run API) for that — same source Supibot uses for it.

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAppAccessToken(config) {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      'Missing clientId/clientSecret in config.json — required for Helix API calls.'
    );
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'client_credentials',
  });

  const res = await fetch(`https://id.twitch.tv/oauth2/token?${params}`, {
    method: 'POST',
  });

  if (!res.ok) {
    throw new Error(`Failed to get Twitch app access token: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000; // refresh a minute early
  return cachedToken;
}

async function helixGet(config, endpoint, searchParams, retrying = false) {
  const token = await getAppAccessToken(config);
  const url = `https://api.twitch.tv/helix/${endpoint}?${new URLSearchParams(searchParams)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Client-Id': config.clientId,
    },
  });

  if (res.status === 401 && !retrying) {
    // Token may have expired/been revoked early — force a refresh, retry once
    cachedToken = null;
    return helixGet(config, endpoint, searchParams, true);
  }

  if (!res.ok) {
    throw new Error(`Helix request to "${endpoint}" failed: ${res.status}`);
  }

  return res.json();
}

async function getUserByLogin(config, login) {
  const data = await helixGet(config, 'users', { login });
  return data.data[0] ?? null;
}

async function getStreamByUserId(config, userId) {
  const data = await helixGet(config, 'streams', { user_id: userId });
  return data.data[0] ?? null;
}

async function getLatestVod(config, userId) {
  // type: archive filters out highlights/uploads, which could otherwise
  // be mistaken for the last full broadcast and throw duration off.
  const data = await helixGet(config, 'videos', {
    user_id: userId,
    first: '1',
    type: 'archive',
  });
  return data.data[0] ?? null;
}

async function getIvrUser(userId) {
  const res = await fetch(`https://api.ivr.fi/v2/twitch/user?id=${encodeURIComponent(userId)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data[0] ?? null;
}

export { getUserByLogin, getStreamByUserId, getLatestVod, getIvrUser };
