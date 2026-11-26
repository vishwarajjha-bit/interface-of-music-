import {
  Headphones,
  Heart,
  ListMusic,
  Lock,
  Pause,
  Play,
  Radio,
  Repeat,
  Repeat1,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  SkipBack,
  SkipForward,
  Sliders,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import type { PointerEvent } from 'react';
import type {
  EqPresetName,
  GroupVcAccess,
  GroupVcSession,
  RepeatMode,
  SpatialProfile,
  Track,
} from '../types/music';
import { formatDuration } from '../utils/playerLogic';
import { LiquidButton } from './LiquidSurface';
import { SegmentedGlass, type SegmentedOption } from './SegmentedGlass';
import { emitWaterWave } from './WaterWaveCanvas';

interface SoundstageViewProps {
  currentTrack: Track;
  isPlaying: boolean;
  progress: number;
  isBuffering: boolean;
  streamError: string | null;
  shuffle: boolean;
  repeatMode: RepeatMode;
  spatialProfile: SpatialProfile;
  eqPreset: EqPresetName;
  likedIds: string[];
  queue: Track[];
  vcSession: GroupVcSession | null;
  vcAccess: GroupVcAccess | null;
  isVcMode: boolean;
  vcControlError: string | null;
  onExitVcMode: () => void;
  onVcAction: (
    action: 'pause' | 'resume' | 'skip' | 'replay' | 'stop' | 'seek' | 'speed' | 'jump_queue' | 'remove_queue',
    payload?: Record<string, unknown>
  ) => void;
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
  onOpenEq: () => void;
}

const SPATIAL_OPTIONS: SegmentedOption<SpatialProfile>[] = [
  { value: 'Pure Stereo', label: 'Pure Stereo' },
  { value: 'Glass Hall', label: 'Glass Hall' },
  { value: 'Warm Analog', label: 'Warm Analog' },
];

const VC_SPEEDS = [0.75, 1, 1.25, 1.5, 2];

export function SoundstageView({
  currentTrack,
  isPlaying,
  progress,
  isBuffering,
  streamError,
  shuffle,
  repeatMode,
  spatialProfile,
  eqPreset,
  likedIds,
  queue,
  vcSession,
  vcAccess,
  isVcMode,
  vcControlError,
  onExitVcMode,
  onVcAction,
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
  onOpenEq,
}: SoundstageViewProps) {
  const isAdminVerified = Boolean(isVcMode && vcAccess?.authorized);
  const isVcLocked = Boolean(isVcMode && !vcAccess?.authorized);

  const activeTitle =
    isVcMode && vcSession?.currentTrack ? vcSession.currentTrack.title : currentTrack.title;
  const activeArtist =
    isVcMode && vcSession?.currentTrack ? vcSession.currentTrack.artist : currentTrack.artist;
  const activeCover =
    isVcMode && vcSession?.currentTrack?.coverUrl
      ? vcSession.currentTrack.coverUrl
      : currentTrack.coverUrl;
  const activeDuration =
    isVcMode && vcSession?.currentTrack
      ? vcSession.duration || vcSession.currentTrack.duration || 180
      : currentTrack.duration;
  const activeProgress = isVcMode && vcSession ? vcSession.progress : progress;
  const activePlaying = isVcMode && vcSession ? vcSession.isPlaying : isPlaying;

  const isLiked = likedIds.includes(currentTrack.id);
  const ratio = activeDuration > 0 ? Math.min(activeProgress / activeDuration, 1) : 0;

  const handlePrismTap = (e: PointerEvent<HTMLButtonElement>) => {
    if (isVcLocked) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX || rect.left + rect.width / 2;
    const cy = e.clientY || rect.top + rect.height / 2;
    emitWaterWave(cx, cy, {
      intensity: 0.9,
      maxRadius: 170,
      duration: 580,
      rgb: currentTrack.palette.rippleRgb,
    });
    if (isVcMode && vcSession) {
      onVcAction(activePlaying ? 'pause' : 'resume');
    } else {
      onTogglePlay();
    }
  };

  const handleWaveformScrub = (index: number, totalBars: number) => {
    if (isVcLocked) return;
    const targetTime = Math.floor(((index + 0.5) / totalBars) * activeDuration);
    if (isVcMode && vcSession) {
      onVcAction('seek', { seconds: targetTime });
    } else {
      onSeek(targetTime);
    }
  };

  return (
    <div className="space-y-5">
      {/* Group Voice Chat Header Strip when launched from a Group's Advanced Music Control */}
      {isVcMode && vcSession && (
        <section
          aria-label="Group Voice Chat Session"
          className="liquid-glass rounded-2xl p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono-tabular text-sky-200">
              {isAdminVerified ? (
                <ShieldCheck className="h-4 w-4 text-emerald-300 shrink-0" aria-hidden="true" />
              ) : (
                <Lock className="h-4 w-4 text-amber-300 shrink-0" aria-hidden="true" />
              )}
              <span>
                {isAdminVerified
                  ? `Group VC Admin Control · ${vcAccess?.userName || 'Admin'}`
                  : 'Admin-Only Group VC · Controls Locked'}
              </span>
            </div>
            <h2 className="font-display text-lg font-semibold text-white truncate flex items-center gap-2">
              <Radio className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
              <span className="truncate">{vcSession.groupTitle}</span>
            </h2>
            {isVcLocked && (
              <p className="text-xs text-amber-200/90">
                {vcAccess?.reason ||
                  'Only group administrators can pause, skip, or change songs in this group Voice Chat.'}
              </p>
            )}
          </div>

          <LiquidButton
            type="button"
            variant="subtle"
            onClick={onExitVcMode}
            className="h-10 px-4 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Headphones className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Switch to Personal Stream</span>
          </LiquidButton>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        {/* Primary Spatial Acoustic Lens */}
        <section
          aria-label="Acoustic Soundstage"
          className="lg:col-span-7 liquid-glass rounded-3xl p-5 sm:p-8 flex flex-col justify-between relative overflow-hidden"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-25 transition-colors duration-700"
            style={{
              background: `radial-gradient(circle at 15% 15%, ${currentTrack.palette.primary}66 0%, transparent 52%), radial-gradient(circle at 85% 88%, ${currentTrack.palette.secondary}88 0%, transparent 55%)`,
            }}
          />

          {/* Top Track Metadata Strip */}
          <div className="relative z-10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-300/85 font-mono-tabular truncate min-w-0">
              <span className="truncate">
                {isVcMode
                  ? `Group VC · ${vcSession?.speed ?? 1}x Speed`
                  : currentTrack.sourceMirror
                    ? `Live Stream · ${currentTrack.sourceMirror}`
                    : currentTrack.mood}
              </span>
              <span aria-hidden="true">·</span>
              <span className="shrink-0">
                {isBuffering ? 'Buffering' : isVcMode ? (activePlaying ? 'On Air' : 'Paused') : `${currentTrack.bpm} BPM`}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <LiquidButton
                type="button"
                variant="subtle"
                onClick={onOpenEq}
                aria-label={`Open Equalizer (Current preset: ${eqPreset})`}
                className="h-9 px-3 rounded-xl text-xs font-medium whitespace-nowrap shrink-0"
              >
                <Sliders className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
                <span>EQ · {eqPreset}</span>
              </LiquidButton>

              <LiquidButton
                type="button"
                variant="subtle"
                onClick={onOpenLyrics}
                className="h-9 px-3 rounded-xl text-xs font-medium whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Lyrics & Wave</span>
                <span className="sm:hidden">Lyrics</span>
              </LiquidButton>
            </div>
          </div>

          {/* Centerpiece: Refractive Glass Disc / Prism */}
          <div className="relative z-10 my-5 sm:my-9 flex flex-col items-center text-center">
            <button
              type="button"
              disabled={isVcLocked}
              onPointerDown={handlePrismTap}
              aria-label={
                isVcLocked
                  ? 'Group VC locked for non-admins'
                  : activePlaying
                    ? `Pause ${activeTitle}`
                    : `Play ${activeTitle}`
              }
              className={`group relative flex items-center justify-center rounded-full p-2.5 sm:p-3 liquid-glass-elevated liquid-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                isVcLocked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute -inset-3 rounded-full border border-white/15 transition-transform duration-500 ${
                  activePlaying ? 'scale-105 opacity-90' : 'scale-100 opacity-45'
                }`}
              />

              <div className="relative h-44 w-44 sm:h-64 sm:w-64 overflow-hidden rounded-full border border-white/25 shadow-2xl">
                <img
                  src={activeCover}
                  alt={`${activeTitle} artwork`}
                  referrerPolicy="no-referrer"
                  className={`h-full w-full object-cover scale-[1.08] transition-transform duration-500 ${
                    activePlaying ? 'scale-[1.11]' : 'group-hover:scale-[1.1]'
                  }`}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-tr from-black/25 via-transparent to-white/25"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 m-auto h-11 w-11 sm:h-12 sm:w-12 rounded-full liquid-glass-elevated flex items-center justify-center"
                >
                  {isVcLocked ? (
                    <Lock className="h-4 w-4 text-amber-300" />
                  ) : activePlaying ? (
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
                  {activeTitle}
                </h1>
                <p className="mt-1 text-sm sm:text-base text-slate-300 truncate">
                  {activeArtist}
                  <span className="mx-2 text-slate-500" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-slate-400">
                    {isVcMode && vcSession?.currentTrack
                      ? `Requested by ${vcSession.currentTrack.requestedBy}`
                      : currentTrack.album}
                  </span>
                </p>
              </div>

              {!isVcMode && (
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
              )}
            </div>

            {(streamError || vcControlError) && (
              <p className="mt-2 text-xs text-amber-200" role="alert">
                {vcControlError || streamError}
              </p>
            )}
          </div>

          {/* Acoustic Wave Scrubber + Transport */}
          <div className="relative z-10 space-y-4 sm:space-y-5">
            <div>
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
                      disabled={isVcLocked}
                      onClick={() => handleWaveformScrub(idx, currentTrack.waveform.length)}
                      aria-label={`Seek to ${formatDuration(Math.floor(barProgress * activeDuration))}`}
                      className="group flex-1 h-full flex items-end justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-300 rounded-sm disabled:cursor-not-allowed"
                    >
                      <span
                        className="w-full rounded-full transition-opacity duration-150 group-hover:opacity-100"
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

              <div className="mt-2.5 flex items-center gap-3">
                <span className="text-xs font-mono-tabular text-slate-300 w-10 text-left">
                  {formatDuration(activeProgress)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, activeDuration)}
                  value={Math.floor(activeProgress)}
                  disabled={isVcLocked}
                  aria-label="Seek track position"
                  onChange={(e) => {
                    const sec = Number(e.target.value);
                    if (isVcMode && vcSession) {
                      onVcAction('seek', { seconds: sec });
                    } else {
                      onSeek(sec);
                    }
                  }}
                  className="liquid-range flex-1 cursor-pointer disabled:opacity-50"
                />
                <span className="text-xs font-mono-tabular text-slate-400 w-10 text-right">
                  {formatDuration(activeDuration)}
                </span>
              </div>
            </div>

            {/* Transport Controls */}
            {isVcMode && vcSession ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3 sm:gap-4">
                  <LiquidButton
                    type="button"
                    variant="glass"
                    disabled={isVcLocked}
                    onClick={() => onVcAction('replay')}
                    aria-label="Replay VC track"
                    className="min-h-[44px] min-w-[44px] rounded-full"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  </LiquidButton>

                  <LiquidButton
                    type="button"
                    variant="primary"
                    haptic="medium"
                    disabled={isVcLocked}
                    onClick={() => onVcAction(activePlaying ? 'pause' : 'resume')}
                    aria-label={activePlaying ? 'Pause Group VC' : 'Resume Group VC'}
                    className="h-14 w-14 rounded-full"
                  >
                    {activePlaying ? (
                      <Pause className="h-6 w-6 fill-slate-950" aria-hidden="true" />
                    ) : (
                      <Play className="h-6 w-6 translate-x-[1px] fill-slate-950" aria-hidden="true" />
                    )}
                  </LiquidButton>

                  <LiquidButton
                    type="button"
                    variant="glass"
                    disabled={isVcLocked}
                    onClick={() => onVcAction('skip')}
                    aria-label="Skip VC track"
                    className="min-h-[46px] min-w-[46px] rounded-full"
                  >
                    <SkipForward className="h-5 w-5" aria-hidden="true" />
                  </LiquidButton>

                  <LiquidButton
                    type="button"
                    variant="subtle"
                    disabled={isVcLocked}
                    onClick={() => onVcAction('stop')}
                    aria-label="Stop Group VC"
                    className="min-h-[44px] min-w-[44px] rounded-full text-rose-300"
                  >
                    <Square className="h-4 w-4 fill-current" aria-hidden="true" />
                  </LiquidButton>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="text-xs text-slate-400 mr-1">VC Speed:</span>
                  {VC_SPEEDS.map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      disabled={isVcLocked}
                      onClick={() => onVcAction('speed', { speed: spd })}
                      className={`h-8 px-2.5 rounded-lg text-xs font-mono-tabular transition-colors cursor-pointer disabled:opacity-40 ${
                        vcSession.speed === spd
                          ? 'bg-white text-slate-950 font-semibold'
                          : 'bg-white/10 text-slate-200 hover:bg-white/15'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
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

                <div className="pt-1 flex justify-center">
                  <SegmentedGlass
                    groupId="spatial-profile-pill"
                    ariaLabel="Acoustic profile"
                    options={SPATIAL_OPTIONS}
                    value={spatialProfile}
                    onChange={onChangeSpatial}
                  />
                </div>
              </>
            )}
          </div>
        </section>

        {/* Right / Secondary Column: Flowing Queue (Personal or Group VC Queue) */}
        <aside
          aria-label="Up Next Queue"
          className="lg:col-span-5 liquid-glass rounded-3xl p-6 sm:p-7 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <h2 className="font-display text-lg font-semibold text-white">
                  {isVcMode ? 'Group VC Queue' : 'Flowing Queue'}
                </h2>
                <p className="text-xs text-slate-400 font-mono-tabular mt-0.5">
                  {isVcMode && vcSession
                    ? `${vcSession.queue.length} queued in ${vcSession.groupTitle}`
                    : `${queue.length} ${queue.length === 1 ? 'track' : 'tracks'} in stream`}
                </p>
              </div>
              <LiquidButton
                type="button"
                variant="subtle"
                onClick={onOpenCurrents}
                className="h-10 px-3.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0"
              >
                <ListMusic className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isVcMode ? 'Add Songs' : 'Browse Currents'}</span>
              </LiquidButton>
            </div>

            {isVcMode && vcSession ? (
              vcSession.queue.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm text-slate-300">No upcoming tracks in this Group VC queue.</p>
                  <LiquidButton
                    type="button"
                    variant="primary"
                    onClick={onOpenCurrents}
                    className="mt-4 h-10 px-4 rounded-xl text-xs"
                  >
                    Search Songs for VC
                  </LiquidButton>
                </div>
              ) : (
                <ul className="mt-3 divide-y divide-white/[0.07] max-h-[460px] overflow-y-auto pr-1">
                  {vcSession.queue.map((item, idx) => (
                    <li key={`${item.vidid}-${idx}`} className="py-2 first:pt-1 last:pb-1">
                      <div className="flex items-center gap-3 rounded-2xl p-2 hover:bg-white/[0.05] transition-colors">
                        <span className="w-5 text-center text-xs font-mono-tabular text-slate-400 shrink-0">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <button
                          type="button"
                          disabled={isVcLocked}
                          onClick={() => onVcAction('jump_queue', { index: idx })}
                          className="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer disabled:cursor-not-allowed"
                        >
                          <img
                            src={item.coverUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-11 w-11 rounded-xl object-cover border border-white/15 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white truncate">{item.title}</p>
                            <p className="text-xs text-slate-400 truncate">
                              {item.artist} · {formatDuration(item.duration)}
                            </p>
                          </div>
                        </button>
                        {!isVcLocked && (
                          <button
                            type="button"
                            onClick={() => onVcAction('remove_queue', { index: idx })}
                            aria-label={`Remove ${item.title} from VC queue`}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )
            ) : queue.length === 0 ? (
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

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span>{isVcMode ? 'Synced Telegram Group' : 'Active acoustic profile'}</span>
            <span className="text-slate-200 font-medium truncate max-w-[180px]">
              {isVcMode && vcSession ? vcSession.groupTitle : `${spatialProfile} · EQ ${eqPreset}`}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
