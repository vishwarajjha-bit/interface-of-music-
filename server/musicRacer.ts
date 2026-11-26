import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Request, Response } from 'express';
import { buildSafeTrackSlug, getConfiguredMirrors, isAllowedExternalBaseUrl } from './telegramAuth';

const execFileAsync = promisify(execFile);

const CACHE_DIR = path.resolve('/tmp/ondine-audio-cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });

export interface RemoteSearchTrack {
  id: string;
  vidid: string;
  title: string;
  artist: string;
  duration: number;
  coverUrl: string;
  sourceMirror: string;
  streamUrl: string;
}

function getMusicApiKey(): string {
  return (
    process.env.MUSIC_API_KEY?.trim() ||
    process.env.API_KEY?.trim() ||
    process.env.RITESH_API_KEY?.trim() ||
    ''
  );
}

function parseDurationToSeconds(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
  if (typeof raw !== 'string') return 180;
  const parts = raw
    .trim()
    .split(':')
    .map((n) => Number(n));
  if (parts.some((n) => !Number.isFinite(n))) return 180;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 180;
}

function normalizeMirrorResults(json: unknown, mirror: string): RemoteSearchTrack[] {
  if (!json || typeof json !== 'object') return [];
  const data = json as Record<string, unknown>;
  const rawList =
    (Array.isArray(data.result) && data.result) ||
    (Array.isArray(data.videos) && data.videos) ||
    (Array.isArray(data.tracks) && data.tracks) ||
    (Array.isArray(data.items) && data.items) ||
    (data.vidid || data.id ? [data] : []);

  const normalized: RemoteSearchTrack[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const vidid = String(obj.id || obj.vidid || '').trim();
    const title = String(obj.title || obj.name || '').trim();
    if (!vidid || !title) continue;
    const thumbs = Array.isArray(obj.thumbnails) ? obj.thumbnails : [];
    const firstThumb =
      thumbs[0] && typeof thumbs[0] === 'object'
        ? String((thumbs[0] as Record<string, unknown>).url || '')
        : '';
    const cover = String(obj.thumbnail || obj.thumb || firstThumb || '').split('?')[0];
    const channelObj =
      obj.channel && typeof obj.channel === 'object'
        ? (obj.channel as Record<string, unknown>)
        : null;
    const artist = String(obj.artist || obj.uploader || channelObj?.name || 'YouTube Audio').trim();
    const duration = parseDurationToSeconds(
      obj.duration_sec ?? obj.duration ?? obj.duration_min ?? 180
    );

    normalized.push({
      id: `yt-${vidid}`,
      vidid,
      title,
      artist,
      duration,
      coverUrl:
        cover && isAllowedExternalBaseUrl(cover)
          ? cover
          : `https://i.ytimg.com/vi/${encodeURIComponent(vidid)}/hqdefault.jpg`,
      sourceMirror: new URL(mirror).hostname,
      streamUrl: `/api/music/stream?vidid=${encodeURIComponent(vidid)}&title=${encodeURIComponent(title)}`,
    });
  }
  return normalized.slice(0, 12);
}

async function searchSingleMirror(
  mirror: string,
  query: string,
  apiKey: string,
  signal: AbortSignal
): Promise<RemoteSearchTrack[]> {
  const endpoint = query.startsWith('http://') || query.startsWith('https://') ? 'details' : 'search';
  const url = new URL(`${mirror}/${endpoint}`);
  if (endpoint === 'details') {
    url.searchParams.set('link', query);
  } else {
    url.searchParams.set('query', query);
    url.searchParams.set('limit', '10');
  }
  if (apiKey) url.searchParams.set('api_key', apiKey);

  const resp = await fetch(url.toString(), { signal });
  if (!resp.ok) throw new Error(`Mirror ${mirror} returned ${resp.status}`);
  const json = await resp.json();
  const parsed = normalizeMirrorResults(json, mirror);
  if (parsed.length === 0) throw new Error(`Mirror ${mirror} returned empty results`);
  return parsed;
}

async function searchViaYtdlp(query: string): Promise<RemoteSearchTrack[]> {
  const target = /^https?:\/\//i.test(query) ? query : `ytsearch8:${query}`;
  const { stdout } = await execFileAsync(
    'yt-dlp',
    ['--dump-single-json', '--flat-playlist', '--no-warnings', '--quiet', target],
    { timeout: 10_000, maxBuffer: 4 * 1024 * 1024 }
  );
  const parsed = JSON.parse(stdout) as { entries?: unknown[]; id?: string; title?: string };
  const rawEntries = Array.isArray(parsed.entries) ? parsed.entries : parsed.id ? [parsed] : [];
  return normalizeMirrorResults({ result: rawEntries }, 'https://yt-dlp.local');
}

export async function raceSearchMusic(query: string): Promise<{
  tracks: RemoteSearchTrack[];
  winningSource: string;
}> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return { tracks: [], winningSource: 'none' };
  }

  const mirrors = getConfiguredMirrors(process.env.MUSIC_API_URLS);
  const apiKey = getMusicApiKey();
  const controllers = mirrors.map(() => new AbortController());

  const tasks = [
    ...mirrors.map((mirror, idx) =>
      searchSingleMirror(mirror, cleanQuery, apiKey, controllers[idx].signal).then((tracks) => ({
        tracks,
        winningSource: new URL(mirror).hostname,
        winnerIdx: idx,
      }))
    ),
    searchViaYtdlp(cleanQuery).then((tracks) => {
      if (tracks.length === 0) throw new Error('yt-dlp empty');
      return { tracks, winningSource: 'yt-dlp', winnerIdx: -1 };
    }),
  ];

  try {
    const winner = await Promise.any(tasks);
    controllers.forEach((ctrl, idx) => {
      if (idx !== winner.winnerIdx) ctrl.abort();
    });
    return { tracks: winner.tracks, winningSource: winner.winningSource };
  } catch {
    return { tracks: [], winningSource: 'unavailable' };
  }
}

function cleanupStalePartFiles(prefix: string): void {
  try {
    const files = fs.readdirSync(CACHE_DIR);
    for (const file of files) {
      if (file.startsWith(prefix) && file.endsWith('.part')) {
        const full = path.resolve(CACHE_DIR, file);
        if (full.startsWith(CACHE_DIR + path.sep)) {
          fs.rmSync(full, { force: true });
        }
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

async function downloadFromMirrorToCache(
  mirror: string,
  vidid: string,
  dlType: 'audio' | 'video',
  apiKey: string,
  partPath: string,
  signal: AbortSignal
): Promise<{ partPath: string; source: string; contentType: string }> {
  const url = new URL(`${mirror}/download`);
  url.searchParams.set('query', vidid);
  url.searchParams.set('dl_type', dlType);
  if (apiKey) url.searchParams.set('api_key', apiKey);

  const resp = await fetch(url.toString(), { signal });
  if (!resp.ok || !resp.body) {
    throw new Error(`Mirror ${mirror} download failed: ${resp.status}`);
  }
  const ctype = resp.headers.get('content-type') || (dlType === 'video' ? 'video/mp4' : 'audio/mpeg');
  if (ctype.includes('application/json') || ctype.includes('text/html')) {
    throw new Error(`Mirror ${mirror} returned non-media content-type ${ctype}`);
  }

  const writer = fs.createWriteStream(partPath);
  const reader = resp.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal.aborted) throw new Error('Aborted');
      writer.write(Buffer.from(value));
    }
    await new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
      writer.end();
    });
    const stat = fs.statSync(partPath);
    if (stat.size < 2048) {
      throw new Error('Downloaded stream too small');
    }
    return { partPath, source: new URL(mirror).hostname, contentType: ctype };
  } catch (err) {
    writer.destroy();
    fs.rmSync(partPath, { force: true });
    throw err;
  }
}

async function downloadViaYtdlpToCache(
  vidid: string,
  dlType: 'audio' | 'video',
  partPath: string,
  signal: AbortSignal
): Promise<{ partPath: string; source: string; contentType: string }> {
  const target = /^https?:\/\//i.test(vidid)
    ? vidid
    : `https://www.youtube.com/watch?v=${vidid}`;
  const fmt =
    dlType === 'video'
      ? 'best[height<=720][ext=mp4]/best[ext=mp4]/best'
      : 'bestaudio[ext=m4a]/bestaudio/best';

  await execFileAsync(
    'yt-dlp',
    ['-f', fmt, '--no-playlist', '--no-warnings', '--quiet', '-o', partPath, target],
    { signal, timeout: 45_000 }
  );
  if (!fs.existsSync(partPath) || fs.statSync(partPath).size < 2048) {
    fs.rmSync(partPath, { force: true });
    throw new Error('yt-dlp output missing');
  }
  return {
    partPath,
    source: 'yt-dlp',
    contentType: dlType === 'video' ? 'video/mp4' : 'audio/mp4',
  };
}

export async function raceDownloadMedia(
  vidid: string,
  dlType: 'audio' | 'video' = 'audio'
): Promise<{ filePath: string; source: string; contentType: string }> {
  const safeSlug = buildSafeTrackSlug(vidid);
  const ext = dlType === 'video' ? 'mp4' : 'mp3';
  const finalPath = path.resolve(CACHE_DIR, `${safeSlug}.${ext}`);
  if (!finalPath.startsWith(CACHE_DIR + path.sep)) {
    throw new Error('Invalid cache path');
  }
  if (fs.existsSync(finalPath) && fs.statSync(finalPath).size > 2048) {
    return {
      filePath: finalPath,
      source: 'cache',
      contentType: dlType === 'video' ? 'video/mp4' : 'audio/mpeg',
    };
  }

  const mirrors = getConfiguredMirrors(process.env.MUSIC_API_URLS);
  const apiKey = getMusicApiKey();
  const raceId = crypto.randomBytes(6).toString('hex');
  const partPrefix = `.race_${safeSlug}_${raceId}`;
  const controllers = [...mirrors.map(() => new AbortController()), new AbortController()];

  const tasks = [
    ...mirrors.map((mirror, idx) => {
      const partPath = path.resolve(CACHE_DIR, `${partPrefix}_m${idx}.${ext}.part`);
      return downloadFromMirrorToCache(
        mirror,
        vidid,
        dlType,
        apiKey,
        partPath,
        controllers[idx].signal
      ).then((res) => ({ ...res, winnerIdx: idx }));
    }),
    (() => {
      const ytdlpIdx = mirrors.length;
      const partPath = path.resolve(CACHE_DIR, `${partPrefix}_ytdlp.${ext}.part`);
      return downloadViaYtdlpToCache(
        vidid,
        dlType,
        partPath,
        controllers[ytdlpIdx].signal
      ).then((res) => ({ ...res, winnerIdx: ytdlpIdx }));
    })(),
  ];

  try {
    const winner = await Promise.any(tasks);
    // Cancel all losing downloaders and purge every partial temp file
    controllers.forEach((ctrl, idx) => {
      if (idx !== winner.winnerIdx) ctrl.abort();
    });
    fs.renameSync(winner.partPath, finalPath);
    cleanupStalePartFiles(partPrefix);
    return {
      filePath: finalPath,
      source: winner.source,
      contentType: winner.contentType,
    };
  } catch {
    cleanupStalePartFiles(partPrefix);
    throw new Error('All download mirrors and yt-dlp failed for this track.');
  }
}

export async function handleAudioStreamRequest(req: Request, res: Response): Promise<void> {
  const vidid = String(req.query.vidid || req.query.query || '').trim();
  const dlType = req.query.dl_type === 'video' ? 'video' : 'audio';
  if (!vidid || vidid.length > 256) {
    res.status(400).json({ error: 'Missing vidid or query parameter' });
    return;
  }

  try {
    const { filePath, source, contentType } = await raceDownloadMedia(vidid, dlType);
    const stat = fs.statSync(filePath);
    const total = stat.size;
    const range = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('X-Ondine-Source', source);
    res.setHeader('Content-Type', contentType);

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (match) {
        const start = match[1] ? Number(match[1]) : 0;
        const end = match[2] ? Number(match[2]) : total - 1;
        if (start >= total || end >= total || start > end) {
          res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
          return;
        }
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        res.setHeader('Content-Length', String(end - start + 1));
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }

    res.setHeader('Content-Length', String(total));
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stream unavailable';
    res.status(502).json({ error: message });
  }
}

export async function raceFetchLyrics(query: string): Promise<string | null> {
  const clean = query.trim();
  if (!clean) return null;
  const mirrors = getConfiguredMirrors(process.env.MUSIC_API_URLS);
  const apiKey = getMusicApiKey();
  const controllers = mirrors.map(() => new AbortController());

  const tasks = mirrors.map(async (mirror, idx) => {
    const url = new URL(`${mirror}/api/lyrics`);
    url.searchParams.set('q', clean);
    if (apiKey) url.searchParams.set('api_key', apiKey);
    const resp = await fetch(url.toString(), { signal: controllers[idx].signal });
    if (!resp.ok) throw new Error('Lyrics fetch failed');
    const data = (await resp.json()) as { lyrics?: string; text?: string };
    const text = data.lyrics || data.text;
    if (!text) throw new Error('Empty lyrics');
    return { text, idx };
  });

  try {
    const winner = await Promise.any(tasks);
    controllers.forEach((c, idx) => {
      if (idx !== winner.idx) c.abort();
    });
    return winner.text;
  } catch {
    return null;
  }
}
