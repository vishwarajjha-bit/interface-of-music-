import { Heart, Pause, Play, Plus, Search, X } from 'lucide-react';
import type { MoodCategory, Track } from '../types/music';
import { formatDuration } from '../utils/playerLogic';
import { LiquidButton } from './LiquidSurface';

interface CurrentsViewProps {
  tracks: Track[];
  filteredTracks: Track[];
  activeMood: MoodCategory;
  searchQuery: string;
  currentTrack: Track;
  isPlaying: boolean;
  likedIds: string[];
  queueIds: string[];
  onMoodChange: (mood: MoodCategory) => void;
  onSearchChange: (q: string) => void;
  onPlayTrack: (trackId: string) => void;
  onTogglePlay: () => void;
  onAddToQueue: (trackId: string) => void;
  onToggleLike: (trackId: string) => void;
  onOpenStage: () => void;
  onResetFilters: () => void;
}

const MOODS: MoodCategory[] = [
  'All',
  'Deep Focus',
  'Midnight Drive',
  'Velvet Acoustic',
  'Ambient Drift',
];

export function CurrentsView({
  tracks,
  filteredTracks,
  activeMood,
  searchQuery,
  currentTrack,
  isPlaying,
  likedIds,
  queueIds,
  onMoodChange,
  onSearchChange,
  onPlayTrack,
  onTogglePlay,
  onAddToQueue,
  onToggleLike,
  onOpenStage,
  onResetFilters,
}: CurrentsViewProps) {
  const featured = tracks[0];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Inline Compact Now-Playing Strip (scrolls naturally, keeps sticky cap low) */}
      <div className="liquid-glass-subtle rounded-2xl p-3 sm:px-5 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onOpenStage}
          className="flex items-center gap-3 min-w-0 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 rounded-xl"
        >
          <img
            src={currentTrack.coverUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-10 w-10 rounded-xl object-cover border border-white/20 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{currentTrack.title}</p>
            <p className="text-xs text-slate-400 truncate">
              {currentTrack.artist} · {isPlaying ? 'Playing' : 'Paused'}
            </p>
          </div>
        </button>

        <LiquidButton
          type="button"
          variant="glass"
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

      {/* Featured Editorial Glass Current */}
      {featured && (
        <section
          aria-label="Featured stream"
          className="liquid-glass rounded-3xl p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-center relative overflow-hidden"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full blur-3xl opacity-25"
            style={{ background: featured.palette.primary }}
          />
          <div className="md:col-span-8 space-y-3 relative z-10">
            <p className="text-xs font-mono-tabular text-sky-200/90">
              Curated Stream · {tracks.length} Lossless Masters
            </p>
            <h1
              className="font-display text-2xl sm:text-4xl font-semibold tracking-tight text-white"
              style={{ textWrap: 'balance' }}
            >
              Midnight Glass & Acoustic Tides
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
              Spacious ambient textures, felt piano studies, and slow nocturnal pulses arranged for
              distraction-free listening.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <LiquidButton
                type="button"
                variant="primary"
                onClick={() => onPlayTrack(featured.id)}
                className="h-11 px-5 rounded-2xl text-sm whitespace-nowrap shrink-0"
              >
                <Play className="h-4 w-4 fill-slate-950" aria-hidden="true" />
                <span>Play Featured</span>
              </LiquidButton>
              <LiquidButton
                type="button"
                variant="subtle"
                onClick={onOpenStage}
                className="h-11 px-5 rounded-2xl text-sm whitespace-nowrap shrink-0"
              >
                Open Soundstage
              </LiquidButton>
            </div>
          </div>

          <div className="md:col-span-4 flex justify-center md:justify-end relative z-10">
            <div className="h-44 w-44 sm:h-48 sm:w-48 rounded-3xl overflow-hidden border border-white/25 shadow-2xl">
              <img
                src={featured.coverUrl}
                alt={`${featured.album} cover`}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover scale-[1.08]"
              />
            </div>
          </div>
        </section>
      )}

      {/* Search & Mood Filter Controls */}
      <section aria-label="Filter currents" className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search tracks, artists, or albums..."
              aria-label="Search tracks, artists, or albums"
              className="w-full h-11 pl-10 pr-10 rounded-2xl liquid-glass-subtle text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300/80"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search query"
                className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div
            role="group"
            aria-label="Mood filter"
            className="flex items-center gap-1.5 overflow-x-auto pb-1"
          >
            {MOODS.map((mood) => {
              const active = activeMood === mood;
              return (
                <LiquidButton
                  key={mood}
                  type="button"
                  variant={active ? 'elevated' : 'subtle'}
                  onClick={() => onMoodChange(mood)}
                  aria-pressed={active}
                  className={`min-h-[40px] px-3.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 ${
                    active ? 'text-white' : 'text-slate-300'
                  }`}
                >
                  {mood}
                </LiquidButton>
              );
            })}
          </div>
        </div>

        {/* Filtered Results List */}
        {filteredTracks.length === 0 ? (
          <div className="liquid-glass rounded-3xl p-10 text-center space-y-3">
            <h2 className="font-display text-lg font-semibold text-white">No matching tracks</h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Nothing in the current catalog matches &ldquo;{searchQuery.trim() || activeMood}&rdquo;.
            </p>
            <div className="pt-2">
              <LiquidButton
                type="button"
                variant="primary"
                onClick={onResetFilters}
                className="h-10 px-4 rounded-xl text-xs"
              >
                Reset Filters
              </LiquidButton>
            </div>
          </div>
        ) : (
          <div className="liquid-glass rounded-3xl p-3 sm:p-5">
            <div className="flex items-center justify-between px-2 pb-3 border-b border-white/10">
              <h2 className="font-display text-base font-semibold text-white">Track Stream</h2>
              <span className="text-xs font-mono-tabular text-slate-400">
                {filteredTracks.length} {filteredTracks.length === 1 ? 'track' : 'tracks'}
              </span>
            </div>

            <ul className="divide-y divide-white/[0.07]">
              {filteredTracks.map((track) => {
                const isCurrent = track.id === currentTrack.id;
                const isLiked = likedIds.includes(track.id);
                const inQueue = queueIds.includes(track.id);

                return (
                  <li key={track.id} className="py-2">
                    <div
                      className={`flex items-center justify-between gap-3 rounded-2xl p-2 transition-colors ${
                        isCurrent ? 'bg-white/[0.11]' : 'hover:bg-white/[0.05]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onPlayTrack(track.id)}
                        aria-label={`Play ${track.title} by ${track.artist}`}
                        className="flex flex-1 min-w-0 items-center gap-3.5 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 rounded-xl"
                      >
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-slate-900">
                          <img
                            src={track.coverUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover scale-[1.08]"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm sm:text-base font-medium truncate ${
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
                            <span>{track.mood}</span>
                            <span className="mx-1.5" aria-hidden="true">
                              ·
                            </span>
                            <span className="font-mono-tabular">
                              {formatDuration(track.duration)}
                            </span>
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <LiquidButton
                          type="button"
                          variant="ghost"
                          onClick={() => onAddToQueue(track.id)}
                          aria-label={
                            inQueue
                              ? `${track.title} is in queue`
                              : `Add ${track.title} to queue`
                          }
                          disabled={inQueue}
                          className="min-h-[44px] px-3 rounded-xl text-xs whitespace-nowrap"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="hidden sm:inline">
                            {inQueue ? 'Queued' : 'Queue'}
                          </span>
                        </LiquidButton>

                        <LiquidButton
                          type="button"
                          variant="ghost"
                          onClick={() => onToggleLike(track.id)}
                          aria-label={
                            isLiked ? `Unlike ${track.title}` : `Like ${track.title}`
                          }
                          aria-pressed={isLiked}
                          className="min-h-[44px] min-w-[44px] rounded-xl"
                        >
                          <Heart
                            className={`h-4 w-4 ${
                              isLiked ? 'fill-rose-400 text-rose-400' : 'text-slate-300'
                            }`}
                            aria-hidden="true"
                          />
                        </LiquidButton>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
