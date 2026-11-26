import crypto from 'node:crypto';

export interface TelegramUserInfo {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface VerifiedInitData {
  valid: boolean;
  reason?: string;
  user?: TelegramUserInfo;
  startParam?: string;
  authDate?: number;
}

export interface ParsedStartContext {
  mode: 'vc' | 'personal';
  chatId: string | null;
}

const DEFAULT_MIRRORS = [
  'https://www.riteshyt.in',
  'https://api.riteshyt.in',
  'https://web.riteshyt.in',
  'https://yt.riteshyt.in',
];

export function parseStartParam(raw?: string | null): ParsedStartContext {
  if (!raw || typeof raw !== 'string') {
    return { mode: 'personal', chatId: null };
  }
  const trimmed = raw.trim();
  const vcMatch = /^vc_(-?\d+)$/.exec(trimmed);
  if (vcMatch) {
    return { mode: 'vc', chatId: vcMatch[1] };
  }
  if (/^-?\d{5,20}$/.test(trimmed)) {
    return { mode: 'vc', chatId: trimmed };
  }
  return { mode: 'personal', chatId: null };
}

export function isTelegramChatAdmin(status?: string | null): boolean {
  return status === 'creator' || status === 'administrator';
}

export function getConfiguredMirrors(envValue?: string): string[] {
  const source = envValue?.trim();
  if (!source) return DEFAULT_MIRRORS;
  const parsed = source
    .split(',')
    .map((u) => u.trim().replace(/\/+$/, ''))
    .filter((u) => isAllowedExternalBaseUrl(u));
  return parsed.length > 0 ? parsed : DEFAULT_MIRRORS;
}

export function isAllowedExternalBaseUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.startsWith('169.254.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400
): VerifiedInitData {
  if (!initData || typeof initData !== 'string') {
    return { valid: false, reason: 'Missing initData' };
  }
  if (!botToken || typeof botToken !== 'string') {
    return { valid: false, reason: 'BOT_TOKEN not configured' };
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
    return { valid: false, reason: 'Missing or invalid hash' };
  }

  const entries: string[] = [];
  params.forEach((value, key) => {
    if (key !== 'hash') {
      entries.push(`${key}=${value}`);
    }
  });
  entries.sort((a, b) => a.localeCompare(b));
  const dataCheckString = entries.join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();
  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  const providedBuf = Buffer.from(hash.toLowerCase(), 'utf8');
  const computedBuf = Buffer.from(computedHash.toLowerCase(), 'utf8');
  if (
    providedBuf.length !== computedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, computedBuf)
  ) {
    return { valid: false, reason: 'Signature mismatch' };
  }

  const authDateRaw = Number(params.get('auth_date') || '0');
  const nowSec = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDateRaw) || authDateRaw <= 0 || nowSec - authDateRaw > maxAgeSeconds) {
    return { valid: false, reason: 'Expired initData' };
  }

  let user: TelegramUserInfo | undefined;
  const userJson = params.get('user');
  if (userJson) {
    try {
      const parsedUser = JSON.parse(userJson) as TelegramUserInfo;
      if (typeof parsedUser.id === 'number') {
        user = parsedUser;
      }
    } catch {
      return { valid: false, reason: 'Malformed user payload' };
    }
  }

  return {
    valid: true,
    user,
    startParam: params.get('start_param') || undefined,
    authDate: authDateRaw,
  };
}

export function buildSafeTrackSlug(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return cleaned || 'track';
}
