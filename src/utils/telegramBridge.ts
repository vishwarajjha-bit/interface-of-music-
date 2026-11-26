import type { TelegramContextInfo, Track } from '../types/music';

interface TelegramWebAppLike {
  ready?: () => void;
  expand?: () => void;
  platform?: string;
  colorScheme?: 'dark' | 'light';
  initDataUnsafe?: {
    user?: {
      first_name?: string;
      username?: string;
    };
  };
  HapticFeedback?: {
    impactOccurred?: (style: 'light' | 'medium' | 'heavy' | 'soft' | 'rigid') => void;
    selectionChanged?: () => void;
  };
  sendData?: (data: string) => void;
}

function getTg(): TelegramWebAppLike | null {
  if (typeof window === 'undefined') return null;
  const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebAppLike } }).Telegram?.WebApp;
  return tg ?? null;
}

export function initTelegramMiniApp(): TelegramContextInfo {
  const tg = getTg();
  if (tg) {
    try {
      tg.ready?.();
      tg.expand?.();
    } catch {
      // Safe fallback outside Telegram container
    }
    const user = tg.initDataUnsafe?.user;
    return {
      isTelegramEnv: true,
      platform: tg.platform || 'telegram',
      userName: user?.first_name || user?.username || 'Telegram Listener',
      colorScheme: tg.colorScheme === 'light' ? 'light' : 'dark',
      initDataReady: true,
    };
  }

  return {
    isTelegramEnv: false,
    platform: 'Web Preview',
    userName: 'Guest Session',
    colorScheme: 'dark',
    initDataReady: false,
  };
}

export function triggerTelegramHaptic(style: 'light' | 'medium' | 'selection' = 'light'): void {
  const tg = getTg();
  if (!tg?.HapticFeedback) return;
  try {
    if (style === 'selection') {
      tg.HapticFeedback.selectionChanged?.();
    } else {
      tg.HapticFeedback.impactOccurred?.(style);
    }
  } catch {
    // Ignore when running outside Telegram client
  }
}

export function buildBotSyncPayload(track: Track, isPlaying: boolean, progress: number) {
  return {
    event: 'ondine_player_sync',
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    isPlaying,
    positionSec: Math.floor(progress),
    durationSec: track.duration,
  };
}

export function sendPayloadToTelegramBot(payload: object): boolean {
  const tg = getTg();
  if (tg?.sendData) {
    try {
      tg.sendData(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
