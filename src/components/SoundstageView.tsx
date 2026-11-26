import {
  Heart,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  X,
} from 'lucide-react';
import type { PointerEvent } from 'react';
import type { RepeatMode, SpatialProfile, Track } from '../types/music';
import { formatDuration } from '../utils/playerLogic';
import { LiquidButton } from './LiquidSurface';
import { emitWaterWave } from './WaterWaveCanvas';

interface SoundstageViewProps {
  currentTrack: Track;
  isPlaying: boolean;
  progress: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  spatialProfile: SpatialProfile;
  likedIds: string[];
  queue: Track[];
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onChangeSpatial: (profile: SpatialProfile) => void;
  onToggleLike: (trackId: string) => void;
  onPlayTrack: (trackId: string) => void;
  onRemoveFromQueue: (trackId: string) => void;
  onOpenCurrents: () => void;
  onOpenLyrics: () => void;
}

const SPATIAL_PROFILES: SpatialProfile[] = ['Pure Stereo', 'Glass Hall', 'Warm Analog'];

export function SoundstageView({
  currentTrack,
  isPlaying,
  progress,
  shuffle,
  repeatMode,
  spatialProfile,
  likedIds,
  queue,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onToggleShuffle,
  onCycleRepeat,
  onChangeSpatial,
  onToggleLike,
  onPlayTrack,
  onRemoveFromQueue,
  onOpenCurrents,
  onOpenLyrics,
}: SoundstageViewProps) {
  const isLiked = likedIds.includes(currentTrack.id);
  const ratio = currentTrack.duration > 0 ? Math.min(progress / currentTrack.duration, 1) : 0;

  const handlePrismTap = (e: PointerEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX || rect.left + rect.width / 2;
    const cy = e.clientY || rect.top + rect.height / 2;
    emitWaterWave(cx, cy, {
      intensity: 1.4,
      maxRadius: 310,
      duration: 1050,
      rgb: currentTrack.palette.rippleRgb,
    });
    onTogglePlay();
  };

  const handleWaveformScrub = (index: number, totalBars: number, e: PointerEvent<HTMLButtonElement>) => {
    const targetTime = Math.floor(((index + 0.5) / totalBars) * currentTrack.duration);
    emitWaterWave(e.clientX, e.clientY, {
      intensity: 1.05,
      maxRadius: 170,
      duration: 780,
      rgb: currentTrack.palette.rippleRgb,
    });
    onSeek(targetTime);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
      {/* Primary Spatial Acoustic Lens */}
      <section
        aria-label="Acoustic Soundstage"
        className="lg:col-span-7 liquid-glass rounded-3xl p-5 sm:p-8 flex flex-col justify-between relative overflow-hidden"
      >
        {/* Subtle internal chromatic mist tied to track palette */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl opacity-25 transition-colors duration-700"
          style={{ background: currentTrack.palette.primary }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full blur-3xl opacity-25 transition-colors duration-700"
          style={{ background: currentTrack.palette.secondary }}
        />

        {/* Top Track Metadata Strip (Unboxed typography, single row on mobile & desktop) */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-300/85 font-mono-tabular truncate min-w-0">
            <span className="truncate">{currentTrack.mood}</span>
            <span aria-hidden="true">·</span>
            <span className="hidden sm:inline">{currentTrack.formatLabel}</span>
            <span className="hidden sm:inline" aria-hidden="true">
              ·
            </span>
            <span className="shrink-0">{currentTrack.bpm} BPM</span>
          </div>

          <LiquidButton
            type="button"
            variant="subtle"
            onClick={onOpenLyrics}
            className="h-9 px-3 sm:px-3.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Lyrics & Wave</span>
          </LiquidButton>
        </div>

        {/* Centerpiece: Refractive Glass Disc / Prism */}
        <div className="relative z-10 my-5 sm:my-9 flex flex-col items-center text-center">
          <button
            type="button"
            onPointerDown={handlePrismTap}
            aria-label={
              isPlaying
                ? `Pause ${currentTrack.title} by ${currentTrack.artist}`
                : `Play ${currentTrack.title} by ${currentTrack.artist}`
            }
            className="group relative flex items-center justify-center rounded-full p-2.5 sm:p-3 liquid-glass-elevated liquid-press cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            {/* Outer specular water ring */}
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute -inset-3 rounded-full border border-white/15 transition-transform duration-700 ${
                isPlaying ? 'scale-105 opacity-90' : 'scale-100 opacity-45'
              }`}
            />
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute -inset-6 rounded-full border border-white/[0.07] transition-transform duration-1000 ${
                isPlaying ? 'scale-105 opacity-75' : 'scale-95 opacity-25'
              }`}
            />

            <div className="relative h-44 w-44 sm:h-64 sm:w-64 overflow-hidden rounded-full border border-white/25 shadow-2xl">
              <img
                src={currentTrack.coverUrl}
                alt={`${currentTrack.album} artwork`}
                referrerPolicy="no-referrer"
                className={`h-full w-full object-cover scale-[1.08] transition-transform duration-700 ${
                  isPlaying ? 'scale-[1.12]' : 'group-hover:scale-[1.1]'
                }`}
              />
              {/* Specular glass dome sheen */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-tr from-black/25 via-transparent to-white/25"
              />
              {/* Subtle center acoustic spindle */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 m-auto h-11 w-11 sm:h-12 sm:w-12 rounded-full liquid-glass-elevated flex items-center justify-center"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4 text-white" />
                ) : (
                  <Play className="h-4 w-4 translate-x-[1px] text-white" />
                )}
              </div>
            </div>
          </button>

          <div className="mt-5 sm:mt-6 flex items-center justify-center gap-3 max-w-full">
            <div className="min-w-0">
              <h1
                className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-white truncate"
                style={{ textWrap: 'balance' }}
              >
                {currentTrack.title}
              </h1>
              <p className="mt-1 text-sm sm:text-base text-slate-300 truncate">
                {currentTrack.artist}
                <span className="mx-2 text-slate-500" aria-hidden="true">
                  ·
                </span>
                <span className="text-slate-400">{currentTrack.album}</span>
              </p>
            </div>

            <LiquidButton
              type="button"
              variant="subtle"
              onClick={() => onToggleLike(currentTrack.id)}
              aria-label={isLiked ? `Unlike ${currentTrack.title}` : `Like ${currentTrack.title}`}
              aria-pressed={isLiked}
              className="min-h-[44px] min-w-[44px] rounded-full shrink-0"
            >
              <Heart
                className={`h-5 w-5 transition-colors ${
                  isLiked ? 'fill-rose-400 text-rose-400' : 'text-slate-200'
                }`}
                aria-hidden="true"
              />
            </LiquidButton>
          </div>
        </div>

        {/* Acoustic Wave Scrubber + Transport */}
        <div className="relative z-10 space-y-4 sm:space-y-5">
          <div>
            {/* Organic waveform bars */}
            <div
              className="flex h-10 sm:h-12 items-end justify-between gap-[3px] sm:gap-1"
              role="group"
              aria-label="Waveform scrub controls"
            >
              {currentTrack.waveform.map((amp, idx) => {
                const barProgress = (idx + 0.5) / currentTrack.waveform.length;
                const isPlayed = barProgress <= ratio;
                return (
                  <button
                    key={idx}
                    type="button"
                    onPointerDown={(e) =>
                      handleWaveformScrub(idx, currentTrack.waveform.length, e)
                    }
                    aria-label={`Seek to ${formatDuration(
                      Math.floor(barProgress * currentTrack.duration)
                    )}`}
                    className="group flex-1 h-full flex items-end justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-300 rounded-sm"
                  >
                    <span
                      className="w-full rounded-full transition-all duration-150 group-hover:opacity-100"
                      style={{
                        height: `${Math.max(18, Math.round(amp * 100))}%`,
                        backgroundColor: isPlayed
                          ? currentTrack.palette.primary
                          : 'rgba(255, 255, 255, 0.22)',
                        opacity: isPlayed ? 0.95 : 0.72,
                      }}
                    />
                  </button>
                );
              })}
            </div>

            {/* Sleek Apple-style glass scrubber track synced with waveform */}
            <div className="mt-2.5 flex items-center gap-3">
              <span className="text-xs font-mono-tabular text-slate-300 w-10 text-left">
                {formatDuration(progress)}
              </span>
              <input
                type="range"
                min={0}
                max={currentTrack.duration}
                value={Math.floor(progress)}
                aria-label="Seek track position"
                onChange={(e) => onSeek(Number(e.target.value))}
                className="liquid-range flex-1 cursor-pointer"
              />
              <span className="text-xs font-mono-tabular text-slate-400 w-10 text-right">
                {formatDuration(currentTrack.duration)}
              </span>
            </div>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center justify-center gap-3 sm:gap-5">
            <LiquidButton
              type="button"
              variant={shuffle ? 'elevated' : 'ghost'}
              onClick={onToggleShuffle}
              aria-label={shuffle ? 'Disable shuffle' : 'Enable shuffle'}
              aria-pressed={shuffle}
              className="min-h-[44px] min-w-[44px] rounded-full"
            >
              <Shuffle
                className={`h-4 w-4 ${shuffle ? 'text-sky-300' : 'text-slate-300'}`}
                aria-hidden="true"
              />
            </LiquidButton>

            <LiquidButton
              type="button"
              variant="glass"
              onClick={onPrev}
              aria-label="Previous track"
              className="min-h-[46px] min-w-[46px] rounded-full"
            >
              <SkipBack className="h-5 w-5" aria-hidden="true" />
            </LiquidButton>

            <LiquidButton
              type="button"
              variant="primary"
              haptic="medium"
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
              className="h-14 w-14 rounded-full"
            >
              {isPlaying ? (
                <Pause className="h-6 w-6 fill-slate-950" aria-hidden="true" />
              ) : (
                <Play className="h-6 w-6 translate-x-[1px] fill-slate-950" aria-hidden="true" />
              )}
            </LiquidButton>

            <LiquidButton
              type="button"
              variant="glass"
              onClick={onNext}
              aria-label="Next track"
              className="min-h-[46px] min-w-[46px] rounded-full"
            >
              <SkipForward className="h-5 w-5" aria-hidden="true" />
            </LiquidButton>

            <LiquidButton
              type="button"
              variant={repeatMode !== 'off' ? 'elevated' : 'ghost'}
              onClick={onCycleRepeat}
              aria-label={`Repeat mode: ${repeatMode}`}
              className="min-h-[44px] min-w-[44px] rounded-full"
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="h-4 w-4 text-sky-300" aria-hidden="true" />
              ) : (
                <Repeat
                  className={`h-4 w-4 ${
                    repeatMode === 'all' ? 'text-sky-300' : 'text-slate-300'
                  }`}
                  aria-hidden="true"
                />
              )}
            </LiquidButton>
          </div>

          {/* Spatial Acoustic Profile Segmented Control */}
          <div className="pt-1 flex justify-center">
            <div
              role="group"
              aria-label="Acoustic profile"
              className="inline-flex items-center gap-1 rounded-2xl liquid-glass-subtle p-1 max-w-full overflow-x-auto"
            >
              {SPATIAL_PROFILES.map((profile) => {
                const active = spatialProfile === profile;
                return (
                  <LiquidButton
                    key={profile}
                    type="button"
                    variant={active ? 'elevated' : 'ghost'}
                    onClick={() => onChangeSpatial(profile)}
                    aria-pressed={active}
                    className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 ${
                      active ? 'text-white' : 'text-slate-300'
                    }`}
                  >
                    {profile}
                  </LiquidButton>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Right / Secondary Column: Flowing Up Next Queue */}
      <aside
        aria-label="Up Next Queue"
        className="lg:col-span-5 liquid-glass rounded-3xl p-6 sm:p-7 flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <h2 className="font-display text-lg font-semibold text-white">Flowing Queue</h2>
              <p className="text-xs text-slate-400 font-mono-tabular mt-0.5">
                {queue.length} {queue.length === 1 ? 'track' : 'tracks'} in stream
              </p>
            </div>
            <LiquidButton
              type="button"
              variant="subtle"
              onClick={onOpenCurrents}
              className="h-10 px-3.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0"
            >
              <ListMusic className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Browse Currents</span>
            </LiquidButton>
          </div>

          {queue.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-300">Your acoustic stream is empty.</p>
              <LiquidButton
                type="button"
                variant="primary"
                onClick={onOpenCurrents}
                className="mt-4 h-10 px-4 rounded-xl text-xs"
              >
                Explore Currents
              </LiquidButton>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-white/[0.07] max-h-[460px] overflow-y-auto pr-1">
              {queue.map((track, idx) => {
                const isCurrent = track.id === currentTrack.id;
                return (
                  <li key={track.id} className="py-2 first:pt-1 last:pb-1">
                    <div
                      className={`flex items-center gap-3 rounded-2xl p-2 transition-colors ${
                        isCurrent ? 'bg-white/[0.11]' : 'hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="w-5 text-center text-xs font-mono-tabular text-slate-400 shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      <button
                        type="button"
                        onClick={() => onPlayTrack(track.id)}
                        aria-label={`Play ${track.title} by ${track.artist}`}
                        className="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 rounded-xl"
                      >
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-slate-900">
                          <img
                            src={track.coverUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover scale-[1.08]"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-medium truncate ${
                              isCurrent ? 'text-sky-200' : 'text-white'
                            }`}
                          >
                            {track.title}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {track.artist}
                            <span className="mx-1.5" aria-hidden="true">
                              ·
                            </span>
                            <span className="font-mono-tabular">
                              {formatDuration(track.duration)}
                            </span>
                          </p>
                        </div>
                      </button>

                      {queue.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemoveFromQueue(track.id)}
                          aria-label={`Remove ${track.title} from queue`}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 shrink-0"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Clean Acoustic Note at Bottom */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <span>Active acoustic profile</span>
          <span className="text-slate-200 font-medium">{spatialProfile}</span>
        </div>
      </aside>
    </div>
  );
}
