import { Pause, Play, Waves } from 'lucide-react';
import { useRef, useState, type PointerEvent } from 'react';
import type { Track } from '../types/music';
import { formatDuration, getActiveLyricIndex } from '../utils/playerLogic';
import { LiquidButton } from './LiquidSurface';
import { emitWaterWave } from './WaterWaveCanvas';

interface WaveSurfaceViewProps {
  currentTrack: Track;
  progress: number;
  isPlaying: boolean;
  onSeek: (seconds: number) => void;
  onTogglePlay: () => void;
}

export function WaveSurfaceView({
  currentTrack,
  progress,
  isPlaying,
  onSeek,
  onTogglePlay,
}: WaveSurfaceViewProps) {
  const [rippleCount, setRippleCount] = useState(0);
  const [isDraggingPond, setIsDraggingPond] = useState(false);
  const lastDragWaveRef = useRef(0);
  const activeLyricIndex = getActiveLyricIndex(currentTrack.lyrics, progress);

  const triggerPondRipple = (x: number, y: number, intensity = 1.5) => {
    setRippleCount((c) => c + 1);
    emitWaterWave(x, y, {
      intensity,
      maxRadius: intensity > 1.2 ? 340 : 210,
      duration: intensity > 1.2 ? 1120 : 840,
      rgb: currentTrack.palette.rippleRgb,
    });
  };

  const handlePondTouch = (e: PointerEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX || rect.left + rect.width / 2;
    const y = e.clientY || rect.top + rect.height / 2;
    setIsDraggingPond(true);
    triggerPondRipple(x, y, 1.5);
  };

  const handlePondMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!isDraggingPond) return;
    const now = performance.now();
    if (now - lastDragWaveRef.current < 85) return;
    lastDragWaveRef.current = now;
    triggerPondRipple(e.clientX, e.clientY, 0.95);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
      {/* Synced Lyrics Column */}
      <section
        aria-label="Synced Lyrics"
        className="lg:col-span-7 liquid-glass rounded-3xl p-6 sm:p-8 flex flex-col justify-between"
      >
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-semibold text-white truncate">
              {currentTrack.title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 truncate">
              {currentTrack.artist} · Synced Verse
            </p>
          </div>
          <LiquidButton
            type="button"
            variant="elevated"
            onClick={onTogglePlay}
            aria-label={isPlaying ? `Pause ${currentTrack.title}` : `Play ${currentTrack.title}`}
            className="min-h-[44px] min-w-[44px] rounded-full shrink-0"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4 translate-x-[1px]" aria-hidden="true" />
            )}
          </LiquidButton>
        </div>

        <div className="my-6 space-y-3">
          {currentTrack.lyrics.map((line, index) => {
            const isActive = index === activeLyricIndex;
            return (
              <button
                key={line.time}
                type="button"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  emitWaterWave(rect.left + 32, rect.top + rect.height / 2, {
                    intensity: 1.2,
                    maxRadius: 240,
                    rgb: currentTrack.palette.rippleRgb,
                  });
                  onSeek(line.time);
                }}
                className={`w-full text-left rounded-2xl px-4 py-3 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                  isActive
                    ? 'bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <span className="block text-[11px] font-mono-tabular text-slate-400 mb-0.5">
                  {formatDuration(line.time)}
                </span>
                <span className="font-display text-base sm:text-xl font-medium leading-snug block">
                  {line.text}
                </span>
              </button>
            );
          })}
        </div>

        <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 font-mono-tabular">
          <span>Tap any line to seek</span>
          <span>
            {formatDuration(progress)} / {formatDuration(currentTrack.duration)}
          </span>
        </div>
      </section>

      {/* Interactive Apple Liquid Glass Resonance Pond */}
      <section
        aria-label="Interactive Water Surface"
        className="lg:col-span-5 liquid-glass rounded-3xl p-6 sm:p-8 flex flex-col justify-between gap-5"
      >
        <div>
          <h2 className="font-display text-lg font-semibold text-white">Liquid Resonance Pond</h2>
          <p className="text-sm text-slate-300 mt-1">
            Tap or glide across the glass pond below to generate multi-ring Apple water ripples
            tuned to <span className="text-white font-medium">{currentTrack.title}</span>.
          </p>
        </div>

        <button
          type="button"
          onPointerDown={handlePondTouch}
          onPointerMove={handlePondMove}
          onPointerUp={() => setIsDraggingPond(false)}
          onPointerLeave={() => setIsDraggingPond(false)}
          aria-label="Tap glass pond to emit harmonic water waves"
          className="group relative flex-1 min-h-[260px] rounded-3xl liquid-glass-elevated overflow-hidden flex flex-col items-center justify-center p-6 text-center cursor-pointer liquid-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 touch-none"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-35 transition-opacity group-hover:opacity-55"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${currentTrack.palette.primary}38 0%, transparent 68%)`,
            }}
          />
          <div className="relative z-10 flex flex-col items-center gap-3">
            <div className="h-16 w-16 rounded-full liquid-glass flex items-center justify-center">
              <Waves className="h-7 w-7 text-white" aria-hidden="true" />
            </div>
            <p className="font-display text-base font-medium text-white">Tap Glass Surface</p>
            <p className="text-xs font-mono-tabular text-slate-300">
              {rippleCount === 0
                ? 'Ready for tactile wave input'
                : `${rippleCount} ${rippleCount === 1 ? 'wave' : 'waves'} emitted`}
            </p>
          </div>
        </button>
      </section>
    </div>
  );
}
