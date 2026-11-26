import { Pause, Play, RotateCcw, Sliders } from 'lucide-react';
import type { EqPresetName, EqSettings, Track } from '../types/music';
import {
  buildEqCurvePath,
  clampEqGain,
  EQ_BAND_FREQS,
  formatDb,
} from '../utils/playerLogic';
import { LiquidButton } from './LiquidSurface';
import { SegmentedGlass, type SegmentedOption } from './SegmentedGlass';

interface EqualizerViewProps {
  currentTrack: Track;
  isPlaying: boolean;
  eq: EqSettings;
  onSelectPreset: (preset: Exclude<EqPresetName, 'Custom'>) => void;
  onChangeBand: (index: number, gain: number) => void;
  onChangePreamp: (preamp: number) => void;
  onChangeBassBoost: (bassBoost: number) => void;
  onChangeStereoWidth: (stereoWidth: number) => void;
  onResetEq: () => void;
  onTogglePlay: () => void;
}

const PRESET_OPTIONS: SegmentedOption<Exclude<EqPresetName, 'Custom'>>[] = [
  { value: 'Flat', label: 'Flat' },
  { value: 'Bass', label: 'Bass' },
  { value: 'Dance', label: 'Dance' },
  { value: 'Classic', label: 'Classic' },
  { value: 'Vocal', label: 'Vocal' },
];

export function EqualizerView({
  currentTrack,
  isPlaying,
  eq,
  onSelectPreset,
  onChangeBand,
  onChangePreamp,
  onChangeBassBoost,
  onChangeStereoWidth,
  onResetEq,
  onTogglePlay,
}: EqualizerViewProps) {
  const curvePath = buildEqCurvePath(eq.bands, 520, 150);
  const areaPath = `${curvePath} L 496.0 150.0 L 24.0 150.0 Z`;

  return (
    <div className="space-y-6">
      {/* Header + Active Track Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white">
            Equalizer Studio
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Sculpt frequencies and acoustic balance for{' '}
            <span className="text-slate-200">{currentTrack.title}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <span className="text-xs font-mono-tabular text-slate-300">
            Active preset: <strong className="text-white font-medium">{eq.preset}</strong>
          </span>
          <LiquidButton
            type="button"
            variant="subtle"
            onClick={onResetEq}
            aria-label="Reset equalizer to Flat"
            className="h-10 px-3.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset Flat</span>
          </LiquidButton>
        </div>
      </div>

      {/* Main Grid: Curve + Bands on Left, Track & Spatial Sculpting on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        <section
          aria-label="5-Band Graphic Equalizer"
          className="lg:col-span-8 liquid-glass rounded-3xl p-5 sm:p-7 flex flex-col justify-between gap-6"
        >
          {/* Preset Templates with Inertia Slide + Wobble */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
              <Sliders className="h-4 w-4 text-sky-300" aria-hidden="true" />
              <span>Sound Templates</span>
            </div>

            <SegmentedGlass
              groupId="eq-preset-pill"
              ariaLabel="Equalizer preset templates"
              options={PRESET_OPTIONS}
              value={eq.preset}
              onChange={(preset) => onSelectPreset(preset)}
            />
          </div>

          {/* Live Smooth SVG Frequency Response Curve */}
          <div className="relative rounded-2xl bg-black/30 border border-white/10 p-3 sm:p-4 overflow-hidden">
            <svg
              viewBox="0 0 520 150"
              className="w-full h-32 sm:h-40 overflow-visible"
              role="img"
              aria-label={`Equalizer curve for ${eq.preset} preset`}
            >
              <defs>
                <linearGradient id="eqCurveFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={currentTrack.palette.primary} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={currentTrack.palette.primary} stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal 0 dB & +/- 6 dB Reference Lines */}
              <line x1="24" y1="75" x2="496" y2="75" stroke="rgba(255,255,255,0.16)" strokeDasharray="4 4" />
              <line x1="24" y1="46" x2="496" y2="46" stroke="rgba(255,255,255,0.06)" />
              <line x1="24" y1="104" x2="496" y2="104" stroke="rgba(255,255,255,0.06)" />

              <path d={areaPath} fill="url(#eqCurveFill)" className="transition-all duration-300" />
              <path
                d={curvePath}
                fill="none"
                stroke={currentTrack.palette.primary}
                strokeWidth="3"
                strokeLinecap="round"
                className="transition-all duration-300"
              />

              {eq.bands.map((gain, i) => {
                const x = 24 + (i / (eq.bands.length - 1)) * 472;
                const y = 18 + ((12 - clampEqGain(gain)) / 24) * 114;
                return (
                  <circle
                    key={EQ_BAND_FREQS[i]}
                    cx={x}
                    cy={y}
                    r="5.5"
                    fill="#ffffff"
                    stroke={currentTrack.palette.primary}
                    strokeWidth="2.5"
                    className="transition-all duration-300"
                  />
                );
              })}
            </svg>
          </div>

          {/* 5 Frequency Band Sliders */}
          <div className="space-y-4">
            {EQ_BAND_FREQS.map((freq, index) => {
              const gain = eq.bands[index] ?? 0;
              return (
                <div key={freq} className="grid grid-cols-12 items-center gap-3">
                  <label
                    htmlFor={`eq-band-${index}`}
                    className="col-span-3 sm:col-span-2 text-xs sm:text-sm font-mono-tabular text-slate-200"
                  >
                    {freq}
                  </label>
                  <div className="col-span-6 sm:col-span-8 flex items-center">
                    <input
                      id={`eq-band-${index}`}
                      type="range"
                      min={-12}
                      max={12}
                      step={0.5}
                      value={gain}
                      aria-label={`${freq} gain in decibels`}
                      onChange={(e) => onChangeBand(index, Number(e.target.value))}
                      className="liquid-range w-full cursor-pointer"
                    />
                  </div>
                  <span className="col-span-3 sm:col-span-2 text-right text-xs font-mono-tabular text-slate-300">
                    {formatDb(gain)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Panel: Track Preview & Extra Sound Sculpting */}
        <aside
          aria-label="Audio Modifications"
          className="lg:col-span-4 liquid-glass rounded-3xl p-5 sm:p-7 flex flex-col justify-between gap-6"
        >
          {/* Now Modifying Card */}
          <div className="liquid-glass-subtle rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={currentTrack.coverUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="h-12 w-12 rounded-xl object-cover border border-white/20 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{currentTrack.title}</p>
                <p className="text-xs text-slate-400 truncate">
                  {currentTrack.artist} · {eq.preset}
                </p>
              </div>
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

          {/* Acoustic Tone Modifiers */}
          <div className="space-y-5 flex-1">
            <h2 className="font-display text-base font-semibold text-white">
              Tone & Dynamics
            </h2>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <label htmlFor="eq-preamp" className="text-slate-300">
                  Preamp Gain
                </label>
                <span className="font-mono-tabular text-white">{formatDb(eq.preamp)}</span>
              </div>
              <input
                id="eq-preamp"
                type="range"
                min={-6}
                max={6}
                step={0.5}
                value={eq.preamp}
                onChange={(e) => onChangePreamp(Number(e.target.value))}
                className="liquid-range w-full cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <label htmlFor="eq-bass-boost" className="text-slate-300">
                  Sub Bass Depth
                </label>
                <span className="font-mono-tabular text-white">{eq.bassBoost}%</span>
              </div>
              <input
                id="eq-bass-boost"
                type="range"
                min={0}
                max={100}
                step={5}
                value={eq.bassBoost}
                onChange={(e) => onChangeBassBoost(Number(e.target.value))}
                className="liquid-range w-full cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <label htmlFor="eq-stereo-width" className="text-slate-300">
                  Stereo Stage Width
                </label>
                <span className="font-mono-tabular text-white">{eq.stereoWidth}%</span>
              </div>
              <input
                id="eq-stereo-width"
                type="range"
                min={0}
                max={100}
                step={5}
                value={eq.stereoWidth}
                onChange={(e) => onChangeStereoWidth(Number(e.target.value))}
                className="liquid-range w-full cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 text-xs text-slate-400 leading-relaxed">
            Changes apply instantaneously across playback and sync cleanly with Telegram Mini App
            session state.
          </div>
        </aside>
      </div>
    </div>
  );
}
