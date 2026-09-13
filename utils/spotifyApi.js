// ─── Spotify Web API Helper ─────────────────────────────────────────
// Client Credentials flow — app-only access token, no user login
// involved. Used only for catalog data (search, track lookup), which
// doesn't need any user-specific scope, so this is all this needs.
//
// This exists specifically because Spicetify's CosmosAsync, when used
// against api.spotify.com from inside the Spotify client itself, sits
// on a heavily and unpredictably rate-limited shared path — a known,
// current issue (other Spicetify extensions have hit the same wall).
// A registered app's own Client Credentials token gets its own
// separate quota, unaffected by that.
//
// Requires config.spotifyClientId + config.spotifyClientSecret from a
// free app at https://developer.spotify.com/dashboard — the redirect
// URI it asks you to set is unused for this grant type, any value
// (e.g. http://localhost:3000) satisfies the form.

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAppAccessToken(config) {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  if (!config.spotifyClientId || !config.spotifyClientSecret) {
    throw new Error(
      'Missing spotifyClientId/spotifyClientSecret in config.json — required for song requests.'
    );
  }

  const basicAuth = Buffer.from(`${config.spotifyClientId}:${config.spotifyClientSecret}`).toString(
    'base64'
  );

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Spotify token request failed: ${res.status} ${detail}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000; // refresh a minute early
  return cachedToken;
}

// Accepts either a plain search query ("song name artist") or a direct
// Spotify track link/URI, so viewers can paste either. Returns
// { uri, label } on success, or null for a genuine "no results" —
// anything else (auth failure, network error, real rate limit on this
// app's own token) throws, since that's not the same as "not found."
async function resolveTrack(config, query) {
  const token = await getAppAccessToken(config);

  const idMatch = query.match(/(?:open\.spotify\.com\/track\/|spotify:track:)([a-zA-Z0-9]+)/);

  if (idMatch) {
    const res = await fetch(`https://api.spotify.com/v1/tracks/${idMatch[1]}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      // Still queueable from the id alone even if metadata lookup
      // failed — just without a nice label for the chat message.
      return { uri: `spotify:track:${idMatch[1]}`, label: null };
    }

    const track = await res.json();
    return { uri: track.uri, label: `${track.name} — ${track.artists?.[0]?.name ?? 'unknown'}` };
  }

  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Spotify search failed: ${res.status} ${detail}`);
  }

  const data = await res.json();
  const track = data?.tracks?.items?.[0];
  if (!track) return null; // genuinely zero matches

  return { uri: track.uri, label: `${track.name} — ${track.artists?.[0]?.name ?? 'unknown'}` };
}

export { resolveTrack };
