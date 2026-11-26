import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterTracks,
  formatDuration,
  getActiveLyricIndex,
  getNextTrackIndex,
  getPrevTrackIndex,
  spawnWave,
  stepWaves,
  toggleItemInList,
  validatePlaylistName,
} from './playerLogic';
import type { Track, WaveRipple } from '../types/music';

const sampleTracks: Track[] = [
  {
    id: 't1',
    title: 'Tidal Glass',
    artist: 'Kaito Mori',
    album: 'Refractions',
    duration: 215,
    mood: 'Deep Focus',
    coverUrl: '/a.jpg',
    bpm: 92,
    formatLabel: '24-bit · 96 kHz',
    palette: { primary: '#38bdf8', secondary: '#1e3a8a', rippleRgb: '125, 211, 252' },
    waveform: [0.4, 0.8],
    lyrics: [
      { time: 0, text: 'Line one' },
      { time: 18, text: 'Line two' },
      { time: 45, text: 'Line three' },
    ],
  },
  {
    id: 't2',
    title: 'Amber Drift',
    artist: 'Nora Vance',
    album: 'Dusk Sessions',
    duration: 184,
    mood: 'Midnight Drive',
    coverUrl: '/b.jpg',
    bpm: 108,
    formatLabel: '24-bit · 48 kHz',
    palette: { primary: '#f59e0b', secondary: '#78350f', rippleRgb: '252, 211, 77' },
    waveform: [0.5, 0.7],
    lyrics: [],
  },
];

test('formatDuration formats seconds cleanly', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(65), '1:05');
  assert.equal(formatDuration(215), '3:35');
  assert.equal(formatDuration(-4), '0:00');
});

test('filterTracks filters by mood and search query', () => {
  assert.equal(filterTracks(sampleTracks, 'All', '').length, 2);
  assert.equal(filterTracks(sampleTracks, 'Midnight Drive', '').length, 1);
  assert.equal(filterTracks(sampleTracks, 'All', 'kaito')[0]?.id, 't1');
  assert.equal(filterTracks(sampleTracks, 'Deep Focus', 'amber').length, 0);
});

test('getNextTrackIndex handles repeat, end of queue, and deterministic shuffle', () => {
  assert.equal(getNextTrackIndex(0, 3, 'off', false), 1);
  assert.equal(getNextTrackIndex(2, 3, 'off', false), -1);
  assert.equal(getNextTrackIndex(2, 3, 'all', false), 0);
  assert.equal(getNextTrackIndex(1, 3, 'one', false), 1);
  // Shuffle with currentIndex=1 and random=0 picks 0; random=0.9 picks 2
  assert.equal(getNextTrackIndex(1, 3, 'off', true, 0.0), 0);
  assert.equal(getNextTrackIndex(1, 3, 'off', true, 0.9), 2);
});

test('getPrevTrackIndex restarts when >3s and goes back when <=3s', () => {
  assert.deepEqual(getPrevTrackIndex(1, 3, 12, 'off'), { index: 1, resetProgress: true });
  assert.deepEqual(getPrevTrackIndex(1, 3, 2, 'off'), { index: 0, resetProgress: true });
  assert.deepEqual(getPrevTrackIndex(0, 3, 1, 'all'), { index: 2, resetProgress: true });
});

test('getActiveLyricIndex tracks playback timestamp accurately', () => {
  const lyrics = sampleTracks[0].lyrics;
  assert.equal(getActiveLyricIndex(lyrics, 0), 0);
  assert.equal(getActiveLyricIndex(lyrics, 20), 1);
  assert.equal(getActiveLyricIndex(lyrics, 60), 2);
  assert.equal(getActiveLyricIndex([], 10), -1);
});

test('toggleItemInList toggles presence without mutating input', () => {
  const original = ['a', 'b'];
  assert.deepEqual(toggleItemInList(original, 'c'), ['a', 'b', 'c']);
  assert.deepEqual(toggleItemInList(original, 'a'), ['b']);
  assert.deepEqual(original, ['a', 'b']);
});

test('validatePlaylistName rejects empty, short, or duplicate names', () => {
  assert.equal(validatePlaylistName('   ', []).valid, false);
  assert.equal(validatePlaylistName('A', []).valid, false);
  assert.equal(validatePlaylistName('Late Night', ['late night']).valid, false);
  assert.deepEqual(validatePlaylistName('  Rainy Glass  ', ['Morning']), {
    valid: true,
    name: 'Rainy Glass',
    error: null,
  });
});

test('spawnWave and stepWaves advance and expire ripples cleanly', () => {
  let waves: WaveRipple[] = [];
  waves = spawnWave(waves, { id: 1, x: 100, y: 200, rgb: '125, 211, 252', duration: 500 });
  assert.equal(waves.length, 1);
  waves = stepWaves(waves, 250);
  assert.equal(waves.length, 1);
  assert.equal(waves[0].age, 250);
  waves = stepWaves(waves, 300);
  assert.equal(waves.length, 0);
});
