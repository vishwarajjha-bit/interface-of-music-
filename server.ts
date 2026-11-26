import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer } from 'ws';
import {
  handleAudioStreamRequest,
  raceFetchLyrics,
  raceSearchMusic,
} from './server/musicRacer';
import {
  applyVcControlAndEnqueue,
  drainPendingCommands,
  getGroupVcSession,
  isBridgeSecretValid,
  listActiveVcRooms,
  registerBotSocket,
  subscribeRoomSocket,
  unsubscribeSocket,
  upsertBotVcState,
  verifyGroupAdminAccess,
  type VcCommand,
} from './server/vcStore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

const VALID_ACTIONS = new Set<VcCommand['action']>([
  'play',
  'pause',
  'resume',
  'skip',
  'replay',
  'stop',
  'seek',
  'speed',
  'loop',
  'shuffle',
  'remove_queue',
  'jump_queue',
  'enqueue',
]);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'ondine-miniapp',
      botTokenConfigured: Boolean(process.env.BOT_TOKEN?.trim()),
      musicKeyConfigured: Boolean(process.env.MUSIC_API_KEY?.trim()),
      bridgeConfigured: Boolean(process.env.BOT_BRIDGE_SECRET?.trim()),
      botUsername: process.env.BOT_USERNAME || '',
    });
  });

  // ── Native Mini App Music Streaming & 5-Source Racing ─────────────────────
  app.get('/api/music/search', async (req, res) => {
    const query = String(req.query.q || req.query.query || '').trim();
    if (!query || query.length > 200) {
      res.status(400).json({ error: 'Provide a search query up to 200 characters.' });
      return;
    }
    const result = await raceSearchMusic(query);
    res.json(result);
  });

  app.get('/api/music/stream', handleAudioStreamRequest);

  app.get('/api/music/lyrics', async (req, res) => {
    const query = String(req.query.q || '').trim();
    if (!query || query.length > 200) {
      res.status(400).json({ error: 'Missing query' });
      return;
    }
    const lyrics = await raceFetchLyrics(query);
    res.json({ lyrics });
  });

  // ── Group VC Discovery & Admin-Verified Remote Control ─────────────────────
  app.get('/api/vc/rooms', (_req, res) => {
    res.json({
      rooms: listActiveVcRooms(),
      botTokenConfigured: Boolean(process.env.BOT_TOKEN?.trim()),
    });
  });

  app.post('/api/vc/session', async (req, res) => {
    const { chatId, initData, sandboxAsAdmin } = (req.body || {}) as {
      chatId?: string;
      initData?: string;
      sandboxAsAdmin?: boolean;
    };
    if (!chatId || !/^-?\d{3,22}$/.test(String(chatId))) {
      res.status(400).json({ error: 'Valid numeric group chatId is required.' });
      return;
    }

    const session = getGroupVcSession(String(chatId));
    const botConfigured = Boolean(process.env.BOT_TOKEN?.trim());

    if (botConfigured || session?.source === 'bot') {
      const access = await verifyGroupAdminAccess({
        chatId: String(chatId),
        initData,
      });
      res.json({
        session: session
          ? { ...session, adminIds: [] }
          : null,
        access,
      });
      return;
    }

    // Preview sandbox mode when BOT_TOKEN is not yet configured on this preview instance
    if (!session) {
      res.json({
        session: null,
        access: {
          authorized: false,
          role: 'guest',
          reason: 'No active Group VC session found for this chat yet.',
        },
      });
      return;
    }

    const isSandboxAdmin = Boolean(sandboxAsAdmin);
    res.json({
      session: { ...session, adminIds: [] },
      access: {
        authorized: isSandboxAdmin,
        role: isSandboxAdmin ? 'admin' : 'member',
        userName: isSandboxAdmin ? 'Preview Group Admin' : 'Preview Group Member',
        reason: isSandboxAdmin
          ? undefined
          : 'Admin rights required. Non-admins cannot control this Group VC.',
      },
    });
  });

  app.post('/api/vc/control', async (req, res) => {
    const { chatId, initData, action, payload, sandboxAsAdmin } = (req.body || {}) as {
      chatId?: string;
      initData?: string;
      action?: VcCommand['action'];
      payload?: Record<string, unknown>;
      sandboxAsAdmin?: boolean;
    };

    if (!chatId || !/^-?\d{3,22}$/.test(String(chatId))) {
      res.status(400).json({ error: 'Valid chatId is required.' });
      return;
    }
    if (!action || !VALID_ACTIONS.has(action)) {
      res.status(400).json({ error: 'Unsupported VC control action.' });
      return;
    }

    const existing = getGroupVcSession(String(chatId));
    const botConfigured = Boolean(process.env.BOT_TOKEN?.trim());
    let issuedBy = 'Admin';

    if (botConfigured || existing?.source === 'bot') {
      const access = await verifyGroupAdminAccess({
        chatId: String(chatId),
        initData,
      });
      if (!access.authorized) {
        res.status(403).json({
          error: access.reason || 'Only group admins can control this Voice Chat.',
          access,
        });
        return;
      }
      issuedBy = access.userName || `Admin ${access.userId}`;
    } else {
      if (!existing || existing.source !== 'sandbox') {
        res.status(403).json({
          error: 'BOT_TOKEN must be configured to control live Telegram groups.',
        });
        return;
      }
      if (!sandboxAsAdmin) {
        res.status(403).json({
          error: 'Only group admins can control this Voice Chat.',
        });
        return;
      }
      issuedBy = 'Preview Group Admin';
    }

    const result = applyVcControlAndEnqueue({
      chatId: String(chatId),
      action,
      payload,
      issuedBy,
    });
    res.json({
      ok: true,
      session: { ...result.session, adminIds: [] },
      commandId: result.command.id,
    });
  });

  // Preview Sandbox Seeder (disabled automatically once BOT_TOKEN is configured)
  app.post('/api/vc/sandbox', (req, res) => {
    if (process.env.BOT_TOKEN?.trim()) {
      res.status(403).json({ error: 'Sandbox disabled when BOT_TOKEN is active.' });
      return;
    }
    const body = (req.body || {}) as {
      chatId?: string;
      groupTitle?: string;
      trackTitle?: string;
      artist?: string;
    };
    const chatId = body.chatId && /^-?\d+$/.test(body.chatId) ? body.chatId : '-1002489104211';
    const session = upsertBotVcState({
      chatId,
      groupTitle: body.groupTitle || 'Midnight Beats VC Lounge',
      isPlaying: true,
      progress: 42,
      duration: 214,
      speed: 1,
      loop: 0,
      videoMode: false,
      source: 'sandbox',
      currentTrack: {
        vidid: 'tidal-glass',
        title: body.trackTitle || 'Tidal Glass Nocturne',
        artist: body.artist || 'Kaito Takahashi',
        duration: 214,
        coverUrl: '/src/assets/images/album_tidal_glass_1795661948490.jpg',
        requestedBy: 'Group Admin',
        streamType: 'audio',
      },
      queue: [
        {
          vidid: 'amber-drift',
          title: 'Amber Drift Over Kyoto',
          artist: 'Sora & Lune',
          duration: 198,
          coverUrl: '/src/assets/images/album_amber_drift_1795661949426.jpg',
          requestedBy: 'Aarav',
          streamType: 'audio',
        },
        {
          vidid: 'velvet-rain',
          title: 'Velvet Rain on 5th',
          artist: 'Julian Mercer',
          duration: 230,
          coverUrl: '/src/assets/images/album_velvet_rain_1795661949226.jpg',
          requestedBy: 'Neha',
          streamType: 'audio',
        },
      ],
    });
    res.json({ ok: true, session: { ...session, adminIds: [] } });
  });

  // ── Python AloneMusic Bot <-> Mini App Bridge Endpoints ────────────────────
  app.post('/api/bot/vc-state', (req, res) => {
    if (process.env.BOT_BRIDGE_SECRET && !isBridgeSecretValid(req.header('x-bot-secret'))) {
      res.status(401).json({ error: 'Invalid x-bot-secret' });
      return;
    }
    const body = req.body || {};
    if (!body.chatId) {
      res.status(400).json({ error: 'chatId required' });
      return;
    }
    const session = upsertBotVcState({
      ...body,
      chatId: String(body.chatId),
      source: 'bot',
    });
    res.json({ ok: true, chatId: session.chatId });
  });

  app.get('/api/bot/commands', (req, res) => {
    if (process.env.BOT_BRIDGE_SECRET && !isBridgeSecretValid(req.header('x-bot-secret'))) {
      res.status(401).json({ error: 'Invalid x-bot-secret' });
      return;
    }
    res.json({ commands: drainPendingCommands() });
  });

  // ── HTTP + WebSocket Server + Vite Middleware ──────────────────────────────
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type?: string;
          chatId?: string;
          secret?: string;
        };
        if (msg.type === 'subscribe' && msg.chatId) {
          subscribeRoomSocket(String(msg.chatId), ws);
          const session = getGroupVcSession(String(msg.chatId));
          if (session) {
            ws.send(
              JSON.stringify({
                event: 'vc:state',
                chatId: String(msg.chatId),
                session: { ...session, adminIds: [] },
              })
            );
          }
        } else if (msg.type === 'bot_auth') {
          if (!process.env.BOT_BRIDGE_SECRET || isBridgeSecretValid(msg.secret)) {
            registerBotSocket(ws);
            ws.send(JSON.stringify({ event: 'bot:authenticated', ok: true }));
          } else {
            ws.close(1008, 'Unauthorized bot secret');
          }
        }
      } catch {
        // Ignore malformed socket frames
      }
    });

    ws.on('close', () => {
      unsubscribeSocket(ws);
    });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.resolve(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output missing. Run npm run build.');
      }
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Ondine Mini App & Bot Bridge running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Ondine server:', err);
  process.exit(1);
});
