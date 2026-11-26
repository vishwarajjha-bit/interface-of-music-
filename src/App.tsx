import { useEffect, useMemo, useState } from 'react';
import { BotBridgeModal } from './components/BotBridgeModal';
import { CrateView } from './components/CrateView';
import { CurrentsView } from './components/CurrentsView';
import { MobileDock } from './components/MobileDock';
import { SoundstageView } from './components/SoundstageView';
import { TopBar } from './components/TopBar';
import { WaterWaveCanvas } from './components/WaterWaveCanvas';
import { WaveSurfaceView } from './components/WaveSurfaceView';
import { DEMO_TRACKS, INITIAL_PLAYLISTS } from './data/catalog';
import type {
  AppTab,
  MoodCategory,
  Playlist,
  RepeatMode,
  SpatialProfile,
  Track,
} from './types/music';
import {
  filterTracks,
  getNextTrackIndex,
  getPrevTrackIndex,
  toggleItemInList,
} from './utils/playerLogic';
import { initTelegramMiniApp, triggerTelegramHaptic } from './utils/telegramBridge';

export default function App() {
  const [telegramContext] = useState(() => initTelegramMiniApp());
  const [activeTab, setActiveTab] = useState<AppTab>('stage');

  // Catalog & Queue state
  const [tracks] = useState<Track[]>(DEMO_TRACKS);
  const [queueIds, setQueueIds] = useState<string[]>(() => DEMO_TRACKS.slice(0, 5).map((t) => t.id));
  const [currentTrackId, setCurrentTrackId] = useState<string>(DEMO_TRACKS[0].id);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(34);
  const [shuffle, setShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  const [spatialProfile, setSpatialProfile] = useState<SpatialProfile>('Glass Hall');

  // Personal Crate state
  const [likedIds, setLikedIds] = useState<string[]>(['tidal-glass', 'velvet-rain']);
  const [playlists, setPlaylists] = useState<Playlist[]>(INITIAL_PLAYLISTS);
  const [recentIds, setRecentIds] = useState<string[]>(['tidal-glass', 'amber-drift', 'arctic-echo']);

  // Currents discovery filter state
  const [activeMood, setActiveMood] = useState<MoodCategory>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Telegram Bot Bridge modal
  const [botModalOpen, setBotModalOpen] = useState<boolean>(false);

  const trackMap = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);

  const currentTrack = useMemo(
    () => trackMap.get(currentTrackId) ?? tracks[0],
    [trackMap, currentTrackId, tracks]
  );

  const queue = useMemo(
    () => queueIds.map((id) => trackMap.get(id)).filter((t): t is Track => Boolean(t)),
    [queueIds, trackMap]
  );

  const filteredTracks = useMemo(
    () => filterTracks(tracks, activeMood, searchQuery),
    [tracks, activeMood, searchQuery]
  );

  const selectAndPlayTrack = (trackId: string) => {
    setCurrentTrackId(trackId);
    setProgress(0);
    setIsPlaying(true);
    setQueueIds((prev) => (prev.includes(trackId) ? prev : [...prev, trackId]));
    setRecentIds((prev) => [trackId, ...prev.filter((id) => id !== trackId)].slice(0, 8));
  };

  const handleNext = () => {
    const activeQueue = queue.length > 0 ? queue : tracks;
    const currentIndex = activeQueue.findIndex((t) => t.id === currentTrack.id);
    const nextIndex = getNextTrackIndex(currentIndex, activeQueue.length, repeatMode, shuffle);
    if (nextIndex === -1) {
      setIsPlaying(false);
      setProgress(0);
      return;
    }
    const nextTrack = activeQueue[nextIndex];
    if (nextTrack) {
      selectAndPlayTrack(nextTrack.id);
    }
  };

  const handlePrev = () => {
    const activeQueue = queue.length > 0 ? queue : tracks;
    const currentIndex = activeQueue.findIndex((t) => t.id === currentTrack.id);
    const result = getPrevTrackIndex(currentIndex, activeQueue.length, progress, repeatMode);
    if (result.index >= 0 && activeQueue[result.index]) {
      const target = activeQueue[result.index];
      if (target.id === currentTrack.id) {
        setProgress(0);
      } else {
        selectAndPlayTrack(target.id);
      }
    }
  };

  // Real-time playback clock
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setProgress((prev) => {
        if (prev + 1 >= currentTrack.duration) {
          return currentTrack.duration;
        }
        return prev + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isPlaying, currentTrack.duration]);

  // Auto-advance at end of track
  useEffect(() => {
    if (!isPlaying || progress < currentTrack.duration) return;
    const activeQueue = queue.length > 0 ? queue : tracks;
    const currentIndex = activeQueue.findIndex((t) => t.id === currentTrack.id);
    const nextIndex = getNextTrackIndex(currentIndex, activeQueue.length, repeatMode, shuffle);
    if (nextIndex === -1) {
      setIsPlaying(false);
      setProgress(0);
      return;
    }
    const nextTrack = activeQueue[nextIndex];
    if (nextTrack) {
      if (nextTrack.id === currentTrack.id) {
        setProgress(0);
      } else {
        setCurrentTrackId(nextTrack.id);
        setProgress(0);
        setRecentIds((prev) => [nextTrack.id, ...prev.filter((id) => id !== nextTrack.id)].slice(0, 8));
      }
    }
  }, [progress, isPlaying, currentTrack.duration, currentTrack.id, queue, tracks, repeatMode, shuffle]);

  const handleToggleLike = (trackId: string) => {
    triggerTelegramHaptic('selection');
    setLikedIds((prev) => toggleItemInList(prev, trackId));
  };

  const handleAddToQueue = (trackId: string) => {
    setQueueIds((prev) => (prev.includes(trackId) ? prev : [...prev, trackId]));
  };

  const handleRemoveFromQueue = (trackId: string) => {
    setQueueIds((prev) => {
      const updated = prev.filter((id) => id !== trackId);
      if (trackId === currentTrack.id && updated.length > 0) {
        setCurrentTrackId(updated[0]);
        setProgress(0);
      }
      return updated;
    });
  };

  const handleCycleRepeat = () => {
    setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
  };

  const handleCreatePlaylist = (name: string) => {
    const newPlaylist: Playlist = {
      id: `pl-${Date.now()}`,
      name,
      description: 'Custom Liquid Glass collection.',
      trackIds: [currentTrack.id],
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setPlaylists((prev) => [newPlaylist, ...prev]);
  };

  const handleAddCurrentToPlaylist = (playlistId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) =>
        pl.id === playlistId && !pl.trackIds.includes(currentTrack.id)
          ? { ...pl, trackIds: [...pl.trackIds, currentTrack.id] }
          : pl
      )
    );
  };

  const handlePlayPlaylist = (playlist: Playlist) => {
    if (playlist.trackIds.length === 0) return;
    setQueueIds(playlist.trackIds);
    selectAndPlayTrack(playlist.trackIds[0]);
    setActiveTab('stage');
  };

  return (
    <div
      data-playback-state={isPlaying ? 'playing' : 'paused'}
      data-active-tab={activeTab}
      className="min-h-screen relative flex flex-col bg-[#07090e] text-slate-100 overflow-x-hidden"
    >
      {/* Adaptive Liquid Glass Chromatic Backdrop */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute -top-40 left-[8%] h-[520px] w-[520px] rounded-full blur-[140px] opacity-30 transition-colors duration-1000"
          style={{ background: currentTrack.palette.primary }}
        />
        <div
          className="absolute bottom-[-160px] right-[6%] h-[560px] w-[560px] rounded-full blur-[150px] opacity-35 transition-colors duration-1000"
          style={{ background: currentTrack.palette.secondary }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05),transparent_60%)]" />
      </div>

      {/* Global Interactive Water Wave Canvas */}
      <WaterWaveCanvas rippleRgb={currentTrack.palette.rippleRgb} />

      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenBotBridge={() => setBotModalOpen(true)}
      />

      <main className="relative z-10 flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-5 sm:pt-8 pb-24 md:pb-12">
        {activeTab === 'stage' && (
          <SoundstageView
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            progress={progress}
            shuffle={shuffle}
            repeatMode={repeatMode}
            spatialProfile={spatialProfile}
            likedIds={likedIds}
            queue={queue}
            onTogglePlay={() => setIsPlaying((p) => !p)}
            onNext={handleNext}
            onPrev={handlePrev}
            onSeek={(sec) => setProgress(sec)}
            onToggleShuffle={() => setShuffle((s) => !s)}
            onCycleRepeat={handleCycleRepeat}
            onChangeSpatial={setSpatialProfile}
            onToggleLike={handleToggleLike}
            onPlayTrack={selectAndPlayTrack}
            onRemoveFromQueue={handleRemoveFromQueue}
            onOpenCurrents={() => setActiveTab('currents')}
            onOpenLyrics={() => setActiveTab('wave')}
          />
        )}

        {activeTab === 'currents' && (
          <CurrentsView
            tracks={tracks}
            filteredTracks={filteredTracks}
            activeMood={activeMood}
            searchQuery={searchQuery}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            likedIds={likedIds}
            queueIds={queueIds}
            onMoodChange={setActiveMood}
            onSearchChange={setSearchQuery}
            onPlayTrack={selectAndPlayTrack}
            onTogglePlay={() => setIsPlaying((p) => !p)}
            onAddToQueue={handleAddToQueue}
            onToggleLike={handleToggleLike}
            onOpenStage={() => setActiveTab('stage')}
            onResetFilters={() => {
              setActiveMood('All');
              setSearchQuery('');
            }}
          />
        )}

        {activeTab === 'crate' && (
          <CrateView
            tracks={tracks}
            likedIds={likedIds}
            playlists={playlists}
            recentIds={recentIds}
            currentTrack={currentTrack}
            onPlayTrack={selectAndPlayTrack}
            onPlayPlaylist={handlePlayPlaylist}
            onCreatePlaylist={handleCreatePlaylist}
            onAddCurrentToPlaylist={handleAddCurrentToPlaylist}
            onToggleLike={handleToggleLike}
          />
        )}

        {activeTab === 'wave' && (
          <WaveSurfaceView
            currentTrack={currentTrack}
            progress={progress}
            isPlaying={isPlaying}
            onSeek={(sec) => setProgress(sec)}
            onTogglePlay={() => setIsPlaying((p) => !p)}
          />
        )}
      </main>

      <MobileDock activeTab={activeTab} onSelectTab={setActiveTab} />

      <BotBridgeModal
        isOpen={botModalOpen}
        telegramContext={telegramContext}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        progress={progress}
        onClose={() => setBotModalOpen(false)}
      />
    </div>
  );
}
