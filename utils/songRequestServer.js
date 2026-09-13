// ─── Song Request WebSocket Server ─────────────────────────────────
// Bridges the !songrequest command to the Spicetify extension running
// on your own PC. This process only ever PUSHES requests out to
// connected extensions — it never reads anything back over the socket,
// so there's nothing for a rogue connection to inject.
//
// Bound to 127.0.0.1 only. Put nginx in front of it on a subdomain
// (reusing your existing Certbot cert) so the extension connects over
// wss:// — this process itself never needs a port opened in UFW.
//
// Requires: npm install ws
// Requires in config.json:
//   songRequestPort  — e.g. 8081
//   songRequestToken — any long random string (generate with e.g.
//                      `openssl rand -hex 24`); the extension must send
//                      the exact same string back as ?token=... or its
//                      connection is rejected.

import { WebSocketServer } from 'ws';

function startSongRequestServer(config) {
  const wss = new WebSocketServer({ port: config.songRequestPort, host: '127.0.0.1' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (token !== config.songRequestToken) {
      console.warn('songRequestServer: rejected connection with bad/missing token');
      ws.close(4001, 'invalid token');
      return;
    }

    console.log('songRequestServer: Spicetify extension connected');

    ws.on('close', () => {
      console.log('songRequestServer: Spicetify extension disconnected');
    });

    ws.on('error', (err) => {
      console.error('songRequestServer: connection error:', err.message);
    });
  });

  wss.on('error', (err) => {
    console.error('songRequestServer: server error:', err.message);
  });

  // Sends to every connected extension (in practice just one — your
  // own PC). Returns how many actually received it, so the command
  // can tell the requester if nothing's listening.
  function broadcast(payload) {
    const message = JSON.stringify(payload);
    let sent = 0;

    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) {
        client.send(message);
        sent++;
      }
    }

    return sent;
  }

  function hasConnectedClients() {
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) return true;
    }
    return false;
  }

  console.log(`🎵 Song request server listening on 127.0.0.1:${config.songRequestPort}`);

  return { broadcast, hasConnectedClients };
}

export { startSongRequestServer };
