export type MoodCategory =
  | 'All'
  | 'Deep Focus'
  | 'Midnight Drive'
  | 'Velvet Acoustic'
  | 'Ambient Drift';

export type RepeatMode = 'off' | 'all' | 'one';

export type SpatialProfile = 'Pure Stereo' | 'Glass Hall' | 'Warm Analog';

export type AppTab = 'stage' | 'currents' | 'eq' | 'crate' | 'wave';

export type EqPresetName = 'Flat' | 'Bass' | 'Dance' | 'Classic' | 'Vocal' | 'Custom';

export interface EqBand {
  id: string;
  label: string;
  freqLabel: string;
  gain: number; // -12 to +12 dB
}

export interface EqSettings {
  preset: EqPresetName;
  bands: number[]; // 5 bands in dB (-12..+12)
  preamp: number; // -6..+6 dB
  bassBoost: number; // 0..100 %
  stereoWidth: number; // 0..100 %
}

export interface LyricLine {
  time: number; // seconds
  text: string;
}

export interface TrackPalette {
  primary: string;
  secondary: string;
  rippleRgb: string;
}

export interface Track {
  id: string;
  vidid?: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // seconds
  mood: Exclude<MoodCategory, 'All'>;
  coverUrl: string;
  streamUrl?: string;
  sourceMirror?: string;
  bpm: number;
  formatLabel: string;
  palette: TrackPalette;
  waveform: number[]; // normalized 0.15..1 values (36 bars)
  lyrics: LyricLine[];
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  trackIds: string[];
  createdAt: string;
}

export interface WaveRipple {
  id: number;
  x: number;
  y: number;
  age: number; // ms elapsed
  duration: number; // total ms
  maxRadius: number;
  rgb: string;
  intensity: number;
}

export interface TelegramContextInfo {
  isTelegramEnv: boolean;
  platform: string;
  userName: string;
  colorScheme: 'dark' | 'light';
  initDataReady: boolean;
  rawInitData: string;
  startParam: string;
}

export interface VcTrackItem {
  vidid: string;
  title: string;
  artist: string;
  duration: number;
  coverUrl: string;
  requestedBy: string;
  streamType?: 'audio' | 'video';
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
  source: 'bot' | 'sandbox';
}

export interface GroupVcAccess {
  authorized: boolean;
  role: 'admin' | 'member' | 'guest';
  userId?: number;
  userName?: string;
  reason?: string;
}

export interface ActiveVcRoomSummary {
  chatId: string;
  groupTitle: string;
  isPlaying: boolean;
  trackTitle: string;
  queueCount: number;
  source: 'bot' | 'sandbox';
}
