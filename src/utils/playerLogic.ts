import type {
  EqPresetName,
  LyricLine,
  MoodCategory,
  RepeatMode,
  Track,
  WaveRipple,
} from '../types/music';

/**
 * Formats seconds into M:SS with clean padding for tabular display.
 */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '0:00';
  }
  const rounded = Math.floor(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Filters tracks by mood category and case-insensitive search query across title, artist, and album.
 */
export function filterTracks(
  tracks: Track[],
  mood: MoodCategory,
  searchQuery: string
): Track[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  return tracks.filter((track) => {
    const matchesMood = mood === 'All' || track.mood === mood;
    if (!matchesMood) return false;
    if (!normalizedQuery) return true;
    return (
      track.title.toLowerCase().includes(normalizedQuery) ||
      track.artist.toLowerCase().includes(normalizedQuery) ||
      track.album.toLowerCase().includes(normalizedQuery) ||
      track.mood.toLowerCase().includes(normalizedQuery)
    );
  });
}

/**
 * Computes the next track index in the active queue.
 * Returns -1 when playback should stop at the end of a non-repeating queue.
 */
export function getNextTrackIndex(
  currentIndex: number,
  queueLength: number,
  repeatMode: RepeatMode,
  shuffle: boolean,
  randomValue = Math.random()
): number {
  if (queueLength <= 0) return -1;
  if (repeatMode === 'one') {
    return currentIndex >= 0 && currentIndex < queueLength ? currentIndex : 0;
  }
  if (shuffle && queueLength > 1) {
    const clamped = Math.min(Math.max(randomValue, 0), 0.999999);
    const candidate = Math.floor(clamped * (queueLength - 1));
    return candidate >= currentIndex ? candidate + 1 : candidate;
  }
  const next = currentIndex + 1;
  if (next < queueLength) return next;
  return repeatMode === 'all' ? 0 : -1;
}

/**
 * Computes the previous track index in the active queue.
 * If progress > 3s, restarts current track instead of jumping back.
 */
export function getPrevTrackIndex(
  currentIndex: number,
  queueLength: number,
  currentProgressSeconds: number,
  repeatMode: RepeatMode
): { index: number; resetProgress: boolean } {
  if (queueLength <= 0) return { index: -1, resetProgress: true };
  if (currentProgressSeconds > 3) {
    return { index: currentIndex, resetProgress: true };
  }
  if (currentIndex > 0) {
    return { index: currentIndex - 1, resetProgress: true };
  }
  if (repeatMode === 'all') {
    return { index: queueLength - 1, resetProgress: true };
  }
  return { index: 0, resetProgress: true };
}

/**
 * Finds the active lyric line index for a given playback timestamp in seconds.
 */
export function getActiveLyricIndex(lyrics: LyricLine[], currentTime: number): number {
  if (lyrics.length === 0) return -1;
  let active = 0;
  for (let i = 0; i < lyrics.length; i += 1) {
    if (currentTime >= lyrics[i].time) {
      active = i;
    } else {
      break;
    }
  }
  return active;
}

/**
 * Toggles an ID in a string list immutably.
 */
export function toggleItemInList(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

/**
 * Validates and normalizes a new playlist name.
 */
export function validatePlaylistName(
  rawName: string,
  existingNames: string[]
): { valid: boolean; name: string; error: string | null } {
  const trimmed = rawName.trim();
  if (!trimmed) {
    return { valid: false, name: '', error: 'Please enter a playlist name.' };
  }
  if (trimmed.length < 2) {
    return { valid: false, name: trimmed, error: 'Name must be at least 2 characters.' };
  }
  if (trimmed.length > 36) {
    return { valid: false, name: trimmed, error: 'Name must be 36 characters or fewer.' };
  }
  const duplicate = existingNames.some(
    (existing) => existing.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (duplicate) {
    return { valid: false, name: trimmed, error: 'A playlist with this name already exists.' };
  }
  return { valid: true, name: trimmed, error: null };
}

/**
 * Spawns a new water ripple state object with bounded capacity.
 */
export function spawnWave(
  waves: WaveRipple[],
  params: {
    id: number;
    x: number;
    y: number;
    rgb: string;
    intensity?: number;
    maxRadius?: number;
    duration?: number;
  },
  maxActive = 16
): WaveRipple[] {
  const nextWave: WaveRipple = {
    id: params.id,
    x: params.x,
    y: params.y,
    age: 0,
    duration: params.duration ?? 920,
    maxRadius: params.maxRadius ?? 210,
    rgb: params.rgb,
    intensity: params.intensity ?? 1,
  };
  const trimmed = waves.length >= maxActive ? waves.slice(waves.length - maxActive + 1) : waves;
  return [...trimmed, nextWave];
}

/**
 * Advances active water ripples by deltaMs and prunes expired ripples.
 */
export function stepWaves(waves: WaveRipple[], deltaMs: number): WaveRipple[] {
  if (deltaMs <= 0) return waves;
  return waves
    .map((wave) => ({ ...wave, age: wave.age + deltaMs }))
    .filter((wave) => wave.age < wave.duration);
}

export const EQ_BAND_FREQS = ['60 Hz', '230 Hz', '910 Hz', '3.6 kHz', '14 kHz'] as const;

export const EQ_PRESETS: Record<Exclude<EqPresetName, 'Custom'>, number[]> = {
  Flat: [0, 0, 0, 0, 0],
  Bass: [6.5, 4.5, 0.5, -1, 1],
  Dance: [5, 2.5, -1.5, 3, 4.5],
  Classic: [2.5, 1, -0.5, 2.5, 4],
  Vocal: [-2, 0.5, 4.5, 3.5, 1],
};

export function clampEqGain(value: number, min = -12, max = 12): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.round(value * 2) / 2, min), max);
}

export function getEqPresetBands(preset: Exclude<EqPresetName, 'Custom'>): number[] {
  return [...EQ_PRESETS[preset]];
}

export function formatDb(db: number): string {
  const fixed = db.toFixed(1);
  return db > 0 ? `+${fixed} dB` : `${fixed} dB`;
}

/**
 * Generates an SVG smooth cubic-bezier path string for 5 EQ band gains (-12..+12 dB).
 */
export function buildEqCurvePath(bands: number[], width = 500, height = 140): string {
  const safeBands = bands.length > 0 ? bands : [0, 0, 0, 0, 0];
  const padX = 24;
  const padY = 18;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;

  const points = safeBands.map((gain, i) => {
    const x =
      safeBands.length === 1
        ? width / 2
        : padX + (i / (safeBands.length - 1)) * usableW;
    const normalized = (12 - clampEqGain(gain)) / 24; // +12 at top, -12 at bottom
    const y = padY + normalized * usableH;
    return { x, y };
  });

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midX = ((p0.x + p1.x) / 2).toFixed(1);
    path += ` C ${midX} ${p0.y.toFixed(1)}, ${midX} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return path;
}
