import { Heart, ListPlus, Play, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import type { Playlist, Track } from '../types/music';
import { formatDuration, validatePlaylistName } from '../utils/playerLogic';
import { LiquidButton } from './LiquidSurface';

interface CrateViewProps {
  tracks: Track[];
  likedIds: string[];
  playlists: Playlist[];
  recentIds: string[];
  currentTrack: Track;
  onPlayTrack: (trackId: string) => void;
  onPlayPlaylist: (playlist: Playlist) => void;
  onCreatePlaylist: (name: string) => void;
  onAddCurrentToPlaylist: (playlistId: string) => void;
  onToggleLike: (trackId: string) => void;
}

type CrateSection = 'saved' | 'playlists' | 'recent';

export function CrateView({
  tracks,
  likedIds,
  playlists,
  recentIds,
  currentTrack,
  onPlayTrack,
  onPlayPlaylist,
  onCreatePlaylist,
  onAddCurrentToPlaylist,
  onToggleLike,
}: CrateViewProps) {
  const [section, setSection] = useState<CrateSection>('saved');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const trackMap = new Map(tracks.map((t) => [t.id, t]));
  const likedTracks = likedIds.map((id) => trackMap.get(id)).filter((t): t is Track => Boolean(t));
  const recentTracks = recentIds
    .map((id) => trackMap.get(id))
    .filter((t): t is Track => Boolean(t));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const validation = validatePlaylistName(
      newPlaylistName,
      playlists.map((p) => p.name)
    );
    if (!validation.valid) {
      setFormError(validation.error);
      return;
    }
    onCreatePlaylist(validation.name);
    setNewPlaylistName('');
    setFormError(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white">
            Your Acoustic Crate
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Saved masters, personal playlists, and listening history
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Crate sections"
          className="inline-flex items-center gap-1 rounded-2xl liquid-glass-subtle p-1 self-start"
        >
          {(
            [
              { id: 'saved', label: `Saved (${likedTracks.length})` },
              { id: 'playlists', label: `Playlists (${playlists.length})` },
              { id: 'recent', label: `Recent (${recentTracks.length})` },
            ] as const
          ).map((tab) => {
            const active = section === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSection(tab.id)}
                className={`relative liquid-press min-h-[40px] px-3.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80 ${
                  active ? 'text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="crate-tab-pill"
                    aria-hidden="true"
                    transition={{
                      type: 'spring',
                      stiffness: 420,
                      damping: 20,
                      mass: 0.9,
                    }}
                    className="absolute inset-0 rounded-xl liquid-glass-elevated"
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section: Saved Tracks */}
      {section === 'saved' && (
        <section aria-label="Saved Tracks" className="liquid-glass rounded-3xl p-4 sm:p-6">
          {likedTracks.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-base font-medium text-white">No saved tracks yet</p>
              <p className="text-sm text-slate-400">
                Tap the heart icon on any track in Soundstage or Currents to save it here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.07]">
              {likedTracks.map((track) => (
                <li key={track.id} className="py-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onPlayTrack(track.id)}
                    aria-label={`Play ${track.title} by ${track.artist}`}
                    className="flex flex-1 min-w-0 items-center gap-3.5 text-left p-2 rounded-2xl hover:bg-white/[0.05] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  >
                    <img
                      src={track.coverUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-12 w-12 rounded-xl object-cover border border-white/15 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm sm:text-base font-medium text-white truncate">
                        {track.title}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {track.artist} · {track.album} ·{' '}
                        <span className="font-mono-tabular">{formatDuration(track.duration)}</span>
                      </p>
                    </div>
                  </button>

                  <LiquidButton
                    type="button"
                    variant="ghost"
                    onClick={() => onToggleLike(track.id)}
                    aria-label={`Remove ${track.title} from saved`}
                    className="min-h-[44px] min-w-[44px] rounded-xl shrink-0"
                  >
                    <Heart className="h-4 w-4 fill-rose-400 text-rose-400" aria-hidden="true" />
                  </LiquidButton>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Section: Playlists + Creation Form */}
      {section === 'playlists' && (
        <div className="space-y-6">
          <form
            onSubmit={handleSubmit}
            className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-3"
            noValidate
          >
            <label htmlFor="new-playlist-input" className="block text-sm font-medium text-white">
              Create New Playlist
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                id="new-playlist-input"
                type="text"
                value={newPlaylistName}
                onChange={(e) => {
                  setNewPlaylistName(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="e.g. Monsoon Reflections"
                aria-invalid={formError ? 'true' : 'false'}
                className="flex-1 h-11 px-4 rounded-2xl liquid-glass-subtle text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300/80"
              />
              <LiquidButton
                type="submit"
                variant="primary"
                className="h-11 px-5 rounded-2xl text-sm whitespace-nowrap shrink-0"
              >
                <ListPlus className="h-4 w-4" aria-hidden="true" />
                <span>Create Playlist</span>
              </LiquidButton>
            </div>
            {formError && (
              <p role="alert" className="text-xs text-rose-300">
                {formError}
              </p>
            )}
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {playlists.map((playlist) => {
              const items = playlist.trackIds
                .map((id) => trackMap.get(id))
                .filter((t): t is Track => Boolean(t));
              const alreadyHasCurrent = playlist.trackIds.includes(currentTrack.id);

              return (
                <article
                  key={playlist.id}
                  className="liquid-glass rounded-3xl p-5 sm:p-6 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-display text-lg font-semibold text-white truncate">
                          {playlist.name}
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5 font-mono-tabular">
                          {items.length} {items.length === 1 ? 'track' : 'tracks'} · Created{' '}
                          {playlist.createdAt}
                        </p>
                      </div>
                      <LiquidButton
                        type="button"
                        variant="elevated"
                        onClick={() => onPlayPlaylist(playlist)}
                        disabled={items.length === 0}
                        aria-label={`Play playlist ${playlist.name}`}
                        className="min-h-[44px] min-w-[44px] rounded-full shrink-0"
                      >
                        <Play className="h-4 w-4 translate-x-[1px]" aria-hidden="true" />
                      </LiquidButton>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{playlist.description}</p>

                    {items.length > 0 && (
                      <ul className="mt-4 space-y-1.5 border-t border-white/10 pt-3">
                        {items.slice(0, 4).map((t) => (
                          <li key={t.id} className="text-xs text-slate-300 flex justify-between gap-2">
                            <span className="truncate">
                              {t.title} — <span className="text-slate-400">{t.artist}</span>
                            </span>
                            <span className="font-mono-tabular text-slate-400 shrink-0">
                              {formatDuration(t.duration)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="pt-2 border-t border-white/10 flex justify-end">
                    <LiquidButton
                      type="button"
                      variant="subtle"
                      onClick={() => onAddCurrentToPlaylist(playlist.id)}
                      disabled={alreadyHasCurrent}
                      className="h-10 px-3.5 rounded-xl text-xs whitespace-nowrap"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {alreadyHasCurrent
                          ? `"${currentTrack.title}" Added`
                          : `Add "${currentTrack.title}"`}
                      </span>
                    </LiquidButton>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* Section: Recently Played */}
      {section === 'recent' && (
        <section aria-label="Recently Played" className="liquid-glass rounded-3xl p-4 sm:p-6">
          <ul className="divide-y divide-white/[0.07]">
            {recentTracks.map((track) => (
              <li key={track.id} className="py-2">
                <button
                  type="button"
                  onClick={() => onPlayTrack(track.id)}
                  aria-label={`Play ${track.title} by ${track.artist}`}
                  className="w-full flex items-center gap-3.5 text-left p-2 rounded-2xl hover:bg-white/[0.05] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  <img
                    src={track.coverUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-12 w-12 rounded-xl object-cover border border-white/15 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm sm:text-base font-medium text-white truncate">
                      {track.title}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {track.artist} · {track.mood} ·{' '}
                      <span className="font-mono-tabular">{formatDuration(track.duration)}</span>
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
