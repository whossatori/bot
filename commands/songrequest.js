import { resolveTrack } from '../utils/spotifyApi.js';

export default {
  name: 'songrequest',
  aliases: ['sr'],
  description: 'Requests a song to be added to the queue. Usage: !songrequest <song name, artist, or Spotify link>',
  adminOnly: false,

  async execute({ channelName, senderUsername, args, botState }) {
    const prefix = botState.getPrefix();
    const query = args.join(' ').trim();

    if (!query) {
      await botState.client.me(
        channelName,
        `Usage: ${prefix}songrequest <song name, artist, or Spotify link>`
      );
      return;
    }

    if (!botState.songRequests.hasConnectedClients()) {
      await botState.client.me(channelName, `✘ song requests aren't connected right now.`);
      return;
    }

    let track;
    try {
      track = await resolveTrack(botState.config, query);
    } catch (err) {
      console.error('songrequest: failed to resolve track:', err.message);
      await botState.client.me(channelName, `✘ couldn't reach Spotify right now.`);
      return;
    }

    if (!track) {
      await botState.client.me(channelName, `✘ no match for "${query}".`);
      return;
    }

    botState.songRequests.broadcast({
      type: 'request',
      uri: track.uri,
      label: track.label,
      requestedBy: senderUsername,
    });

    await botState.client.me(
      channelName,
      `🎵 queued: ${track.label ?? query} (requested by ${senderUsername})`
    );
  },
};