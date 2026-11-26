import crypto from 'node:crypto';
import type { WebSocket } from 'ws';
import { isTelegramChatAdmin, verifyTelegramInitData } from './telegramAuth';

export interface VcTrackItem {
  vidid: string;
  title: string;
  artist: string;
  duration: number;
  coverUrl: string;
  requestedBy: string;
  streamType?: 'audio' | 'video';
}

export interface VcCommand {
  id: string;
  chatId: string;
  action:
    | 'play'
    | 'pause'
    | 'resume'
    | 'skip'
    | 'replay'
    | 'stop'
    | 'seek'
    | 'speed'
    | 'loop'
    | 'shuffle'
    | 'remove_queue'
    | 'jump_queue'
    | 'enqueue';
  payload?: Record<string, unknown>;
  issuedBy: string;
  createdAt: number;
}

export interface GroupVcSession {
  chatId: string;
  groupTitle: string;
  isPlaying: boolean;
  progress: number;
  duration: number;
  speed: number;
  loop: number;
  videoMode: boolean;
  currentTrack: VcTrackItem | null;
  queue: VcTrackItem[];
  adminIds: number[];
  updatedAt: number;
  source: 'bot' | 'sandbox';
}

const sessions = new Map<string, GroupVcSession>();
const pendingCommands = new Map<string, VcCommand[]>();
const roomSockets = new Map<string, Set<WebSocket>>();
const botSockets = new Set<WebSocket>();
const adminCache = new Map<string, { isAdmin: boolean; checkedAt: number }>();

const SESSION_SECRET = process.env.BOT_BRIDGE_SECRET || crypto.randomBytes(32).toString('hex');

export function getBridgeSecret(): string {
  return process.env.BOT_BRIDGE_SECRET || SESSION_SECRET;
}

export function isBridgeSecretValid(provided?: string | null): boolean {
  const expected = process.env.BOT_BRIDGE_SECRET;
  if (!expected) return false;
  if (!provided || typeof provided !== 'string') return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function computeLiveProgress(session: GroupVcSession): GroupVcSession {
  if (!session.isPlaying || !session.currentTrack) return session;
  const elapsed = Math.floor((Date.now() - session.updatedAt) / 1000);
  if (elapsed <= 0) return session;
  const nextProgress = Math.min(
    session.duration || session.currentTrack.duration || 0,
    Math.max(0, Math.floor(session.progress + elapsed * session.speed))
  );
  return {
    ...session,
    progress: nextProgress,
  };
}

export function upsertBotVcState(payload: {
  chatId: string;
  groupTitle?: string;
  isPlaying?: boolean;
  progress?: number;
  duration?: number;
  speed?: number;
  loop?: number;
  videoMode?: boolean;
  currentTrack?: VcTrackItem | null;
  queue?: VcTrackItem[];
  adminIds?: number[];
  source?: 'bot' | 'sandbox';
}): GroupVcSession {
  const chatId = String(payload.chatId);
  const existing = sessions.get(chatId);
  const next: GroupVcSession = {
    chatId,
    groupTitle: payload.groupTitle || existing?.groupTitle || `Group ${chatId}`,
    isPlaying: payload.isPlaying ?? existing?.isPlaying ?? false,
    progress: typeof payload.progress === 'number' ? payload.progress : existing?.progress ?? 0,
    duration: typeof payload.duration === 'number' ? payload.duration : existing?.duration ?? 0,
    speed: typeof payload.speed === 'number' ? payload.speed : existing?.speed ?? 1,
    loop: typeof payload.loop === 'number' ? payload.loop : existing?.loop ?? 0,
    videoMode: payload.videoMode ?? existing?.videoMode ?? false,
    currentTrack: payload.currentTrack !== undefined ? payload.currentTrack : existing?.currentTrack ?? null,
    queue: Array.isArray(payload.queue) ? payload.queue : existing?.queue ?? [],
    adminIds: Array.isArray(payload.adminIds) ? payload.adminIds : existing?.adminIds ?? [],
    updatedAt: Date.now(),
    source: payload.source || existing?.source || 'bot',
  };
  sessions.set(chatId, next);
  broadcastRoomState(chatId, next);
  return next;
}

export function getGroupVcSession(chatId: string): GroupVcSession | null {
  const s = sessions.get(String(chatId));
  return s ? computeLiveProgress(s) : null;
}

export function listActiveVcRooms(): Array<{
  chatId: string;
  groupTitle: string;
  isPlaying: boolean;
  trackTitle: string;
  queueCount: number;
  source: 'bot' | 'sandbox';
}> {
  return Array.from(sessions.values()).map((s) => ({
    chatId: s.chatId,
    groupTitle: s.groupTitle,
    isPlaying: s.isPlaying,
    trackTitle: s.currentTrack?.title || 'No active track',
    queueCount: s.queue.length,
    source: s.source,
  }));
}

export async function verifyGroupAdminAccess(params: {
  chatId: string;
  initData?: string;
}): Promise<{
  authorized: boolean;
  role: 'admin' | 'member' | 'guest';
  userId?: number;
  userName?: string;
  reason?: string;
}> {
  const botToken = process.env.BOT_TOKEN?.trim() || '';
  const chatId = String(params.chatId);
  const session = sessions.get(chatId);

  if (!botToken) {
    return {
      authorized: false,
      role: 'guest',
      reason: 'BOT_TOKEN is not configured on the server; Telegram admin verification is locked.',
    };
  }

  const verified = verifyTelegramInitData(params.initData || '', botToken);
  if (!verified.valid || !verified.user?.id) {
    return {
      authorized: false,
      role: 'guest',
      reason: verified.reason || 'Open this group controller from Telegram to verify your identity.',
    };
  }

  const userId = verified.user.id;
  const userName = verified.user.first_name || verified.user.username || `User ${userId}`;

  if (session?.adminIds.includes(userId)) {
    return { authorized: true, role: 'admin', userId, userName };
  }

  const cacheKey = `${chatId}:${userId}`;
  const cached = adminCache.get(cacheKey);
  if (cached && Date.now() - cached.checkedAt < 30_000) {
    return {
      authorized: cached.isAdmin,
      role: cached.isAdmin ? 'admin' : 'member',
      userId,
      userName,
      reason: cached.isAdmin ? undefined : 'Only admins of this group can control its Voice Chat.',
    };
  }

  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(botToken)}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${encodeURIComponent(String(userId))}`
    );
    const json = (await resp.json()) as {
      ok?: boolean;
      result?: { status?: string };
      description?: string;
    };
    const isAdmin = Boolean(json.ok && isTelegramChatAdmin(json.result?.status));
    adminCache.set(cacheKey, { isAdmin, checkedAt: Date.now() });
    if (isAdmin && session && !session.adminIds.includes(userId)) {
      session.adminIds = [...session.adminIds, userId];
    }
    return {
      authorized: isAdmin,
      role: isAdmin ? 'admin' : 'member',
      userId,
      userName,
      reason: isAdmin ? undefined : 'Only admins of this group can control its Voice Chat.',
    };
  } catch {
    return {
      authorized: false,
      role: 'member',
      userId,
      userName,
      reason: 'Unable to reach Telegram API to confirm group admin status.',
    };
  }
}

export function applyVcControlAndEnqueue(params: {
  chatId: string;
  action: VcCommand['action'];
  payload?: Record<string, unknown>;
  issuedBy: string;
}): { session: GroupVcSession; command: VcCommand } {
  const chatId = String(params.chatId);
  const current = computeLiveProgress(
    sessions.get(chatId) ||
      upsertBotVcState({
        chatId,
        groupTitle: `Group ${chatId}`,
        currentTrack: null,
        queue: [],
      })
  );

  let next: GroupVcSession = { ...current, updatedAt: Date.now() };
  const p = params.payload || {};

  switch (params.action) {
    case 'pause':
      next.isPlaying = false;
      break;
    case 'resume':
      next.isPlaying = true;
      break;
    case 'replay':
      next.progress = 0;
      next.isPlaying = true;
      break;
    case 'stop':
      next.isPlaying = false;
      next.progress = 0;
      next.currentTrack = null;
      next.queue = [];
      break;
    case 'seek': {
      const sec = Number(p.seconds ?? 0);
      if (Number.isFinite(sec)) {
        next.progress = Math.max(0, Math.min(next.duration || 3600, Math.floor(sec)));
      }
      break;
    }
    case 'speed': {
      const spd = Number(p.speed ?? 1);
      if (Number.isFinite(spd) && spd >= 0.5 && spd <= 2.0) {
        next.speed = spd;
      }
      break;
    }
    case 'loop': {
      const lp = Number(p.loop ?? 0);
      if (Number.isFinite(lp) && lp >= 0 && lp <= 10) {
        next.loop = Math.floor(lp);
      }
      break;
    }
    case 'skip': {
      if (next.queue.length > 0) {
        const [first, ...rest] = next.queue;
        next.currentTrack = first;
        next.duration = first.duration;
        next.progress = 0;
        next.queue = rest;
        next.isPlaying = true;
      } else {
        next.isPlaying = false;
        next.progress = 0;
      }
      break;
    }
    case 'jump_queue': {
      const idx = Number(p.index ?? -1);
      if (idx >= 0 && idx < next.queue.length) {
        const target = next.queue[idx];
        next.currentTrack = target;
        next.duration = target.duration;
        next.progress = 0;
        next.queue = next.queue.filter((_, i) => i !== idx);
        next.isPlaying = true;
      }
      break;
    }
    case 'remove_queue': {
      const idx = Number(p.index ?? -1);
      if (idx >= 0 && idx < next.queue.length) {
        next.queue = next.queue.filter((_, i) => i !== idx);
      }
      break;
    }
    case 'shuffle': {
      const copy = [...next.queue];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      next.queue = copy;
      break;
    }
    case 'enqueue':
    case 'play': {
      const track = p.track as VcTrackItem | undefined;
      if (track && track.title) {
        if (params.action === 'play' || !next.currentTrack) {
          next.currentTrack = track;
          next.duration = track.duration || 210;
          next.progress = 0;
          next.isPlaying = true;
        } else {
          next.queue = [...next.queue, track];
        }
      }
      break;
    }
  }

  sessions.set(chatId, next);

  const command: VcCommand = {
    id: crypto.randomUUID(),
    chatId,
    action: params.action,
    payload: p,
    issuedBy: params.issuedBy,
    createdAt: Date.now(),
  };

  const existingQueue = pendingCommands.get(chatId) || [];
  pendingCommands.set(chatId, [...existingQueue.slice(-49), command]);

  broadcastRoomState(chatId, next);
  broadcastBotCommand(command);

  return { session: next, command };
}

export function drainPendingCommands(): VcCommand[] {
  const all: VcCommand[] = [];
  for (const [, cmds] of pendingCommands.entries()) {
    all.push(...cmds);
  }
  pendingCommands.clear();
  return all;
}

export function subscribeRoomSocket(chatId: string, ws: WebSocket): void {
  const key = String(chatId);
  let set = roomSockets.get(key);
  if (!set) {
    set = new Set();
    roomSockets.set(key, set);
  }
  set.add(ws);
}

export function unsubscribeSocket(ws: WebSocket): void {
  botSockets.delete(ws);
  for (const [key, set] of roomSockets.entries()) {
    set.delete(ws);
    if (set.size === 0) roomSockets.delete(key);
  }
}

export function registerBotSocket(ws: WebSocket): void {
  botSockets.add(ws);
}

export function broadcastRoomState(chatId: string, session: GroupVcSession): void {
  const set = roomSockets.get(String(chatId));
  if (!set) return;
  const msg = JSON.stringify({ event: 'vc:state', chatId: String(chatId), session });
  for (const client of set) {
    if (client.readyState === 1) {
      client.send(msg);
    }
  }
}

function broadcastBotCommand(command: VcCommand): void {
  if (botSockets.size === 0) return;
  const msg = JSON.stringify({ event: 'vc:command', command });
  for (const bot of botSockets) {
    if (bot.readyState === 1) {
      bot.send(msg);
    }
  }
}
