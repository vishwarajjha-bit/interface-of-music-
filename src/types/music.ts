export type MoodCategory =
  | 'All'
  | 'Deep Focus'
  | 'Midnight Drive'
  | 'Velvet Acoustic'
  | 'Ambient Drift';

export type RepeatMode = 'off' | 'all' | 'one';

export type SpatialProfile = 'Pure Stereo' | 'Glass Hall' | 'Warm Analog';

export type AppTab = 'stage' | 'currents' | 'crate' | 'wave';

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
  title: string;
  artist: string;
  album: string;
  duration: number; // seconds
  mood: Exclude<MoodCategory, 'All'>;
  coverUrl: string;
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
}
