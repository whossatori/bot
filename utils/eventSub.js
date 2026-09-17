// ─── EventSub (Channel Point Redemptions) ──────────────────────────
// Uses Twurple's EventSubWsListener so redemptions reach the bot
// regardless of whether "require viewer to enter text" is on — IRC
// only sees redemptions WITH text input; this sees all of them,
// through one persistent WebSocket Twurple manages entirely (session
// setup, keepalive, reconnects).
//
// This subscription type only accepts the BROADCASTER's own user
// token — confirmed on Twitch's dev forum: moderator/editor tokens
// are rejected outright — obtained once via get-eventsub-token.js.
// Token refreshes are persisted to eventsub-token.json so a restart
// picks up the latest refresh token rather than the one-time original
// (Twitch rotates the refresh token on every use).
//
// Single channel only, by design — this bot only ever runs for one
// broadcaster, so there's no multi-channel subscription bookkeeping
// here, just one listener for one reward.

import { RefreshingAuthProvider } from '@twurple/auth';
import { ApiClient } from '@twurple/api';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const TOKEN_FILE = path.join(__dirname, '..', 'eventsub-token.json');

function loadTokenData(config) {
  if (fs.existsSync(TOKEN_FILE)) {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
  }

  if (!config.eventSubRefreshToken) {
    throw new Error(
      'Missing eventSubRefreshToken in config.json — run get-eventsub-token.js once to get one.'
    );
  }

  // First run only: bootstrap from config.json's refresh token.
  // expiresIn: 0 forces an immediate refresh on startup, after which
  // onRefresh below takes over and the file becomes the source of
  // truth for every run after this one.
  return {
    accessToken: '',
    refreshToken: config.eventSubRefreshToken,
    expiresIn: 0,
    obtainmentTimestamp: 0,
  };
}

// onDailyRedemption(event) is called only for redemptions of
// config.dailyRewardId — everything else is ignored here.
async function startEventSub(config, broadcasterId, onDailyRedemption) {
  const authProvider = new RefreshingAuthProvider({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  });

  authProvider.onRefresh((_userId, newTokenData) => {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(newTokenData, null, 2), 'utf-8');
  });

  await authProvider.addUserForToken(loadTokenData(config));

  const apiClient = new ApiClient({ authProvider });
  const listener = new EventSubWsListener({ apiClient });

  listener.onSubscriptionCreateFailure((sub, err) => {
    console.error('eventSub: subscription failed:', sub.id, err.message);
  });

  await listener.start();

  listener.onChannelRedemptionAdd(broadcasterId, (event) => {
    if (event.rewardId !== config.dailyRewardId) return;
    onDailyRedemption(event);
  });

  console.log('🎁 EventSub listening for channel point redemptions');
}

export { startEventSub };
