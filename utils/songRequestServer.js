// ─── Song Request WebSocket Server ─────────────────────────────────
// Bridges the !songrequest command to the Spicetify extension running
// on your own PC. Two-way: the command sends a request and waits for
// the extension to report back what it actually resolved/queued, so
// chat can show the real song name instead of just echoing the raw
// text that was typed.
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

  // requestId -> { resolve } for in-flight requests awaiting a reply.
  const pending = new Map();

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (token !== config.songRequestToken) {
      console.warn('songRequestServer: rejected connection with bad/missing token');
      ws.close(4001, 'invalid token');
      return;
    }

    console.log('songRequestServer: Spicetify extension connected');

    ws.on('message', (raw) => {
      let data;
      try {
        data = JSON.parse(raw);
      } catch (err) {
        console.warn('songRequestServer: received malformed message:', err.message);
        return;
      }

      if (data.type === 'result' && data.id && pending.has(data.id)) {
        pending.get(data.id).resolve(data);
        pending.delete(data.id);
      }
    });

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
  // own PC). Returns how many actually received it.
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

  // Broadcasts a request and waits for a matching { type: 'result', id }
  // reply, up to timeoutMs. Resolves with the result payload, or null
  // if nothing came back in time (extension busy, crashed, Spotify
  // closed, etc.) — callers should treat null as "sent, but unknown
  // outcome," not a hard failure.
  function requestAndWait(payload, timeoutMs = 10000) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve(null);
      }, timeoutMs);

      pending.set(id, {
        resolve: (data) => {
          clearTimeout(timer);
          resolve(data);
        },
      });

      const sent = broadcast({ ...payload, id });
      if (sent === 0) {
        clearTimeout(timer);
        pending.delete(id);
        resolve(null);
      }
    });
  }

  console.log(`🎵 Song request server listening on 127.0.0.1:${config.songRequestPort}`);

  return { broadcast, hasConnectedClients, requestAndWait };
}

export { startSongRequestServer };