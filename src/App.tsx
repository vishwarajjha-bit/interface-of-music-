import { MotionConfig } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BotBridgeModal } from './components/BotBridgeModal';
import { CrateView } from './components/CrateView';
import { CurrentsView } from './components/CurrentsView';
import { EqualizerView } from './components/EqualizerView';
import { MobileDock } from './components/MobileDock';
import { SoundstageView } from './components/SoundstageView';
import { TopBar } from './components/TopBar';
import { WaterWaveCanvas } from './components/WaterWaveCanvas';
import { WaveSurfaceView } from './components/WaveSurfaceView';
import { DEMO_TRACKS, INITIAL_PLAYLISTS } from './data/catalog';
import { useAudioEngine } from './hooks/useAudioEngine';
import type {
  ActiveVcRoomSummary,
  AppTab,
  EqPresetName,
  EqSettings,
  GroupVcAccess,
  GroupVcSession,
  MoodCategory,
  Playlist,
  RepeatMode,
  SpatialProfile,
  Track,
} from './types/music';
import {
  clampEqGain,
  filterTracks,
  getEqPresetBands,
  getNextTrackIndex,
  getPrevTrackIndex,
  toggleItemInList,
} from './utils/playerLogic';
import {
  initTelegramMiniApp,
  parseVcChatIdFromStartParam,
  triggerTelegramHaptic,
} from './utils/telegramBridge';

export default function App() {
  const [telegramContext] = useState(() => initTelegramMiniApp());
  const [activeTab, setActiveTab] = useState<AppTab>('stage');

  // Catalog & Queue state (includes dynamically searched remote tracks)
  const [tracks, setTracks] = useState<Track[]>(DEMO_TRACKS);
  const [queueIds, setQueueIds] = useState<string[]>(() => DEMO_TRACKS.slice(0, 5).map((t) => t.id));
  const [currentTrackId, setCurrentTrackId] = useState<string>(DEMO_TRACKS[0].id);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(34);
  const [shuffle, setShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  const [spatialProfile, setSpatialProfile] = useState<SpatialProfile>('Glass Hall');

  // Online 5-source search state
  const [remoteTracks, setRemoteTracks] = useState<Track[]>([]);
  const [remoteSource, setRemoteSource] = useState<string | null>(null);
  const [remoteSearching, setRemoteSearching] = useState<boolean>(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  // Equalizer Studio state
  const [eq, setEq] = useState<EqSettings>({
    preset: 'Flat',
    bands: getEqPresetBands('Flat'),
    preamp: 0,
    bassBoost: 20,
    stereoWidth: 65,
  });

  // Personal Crate state
  const [likedIds, setLikedIds] = useState<string[]>(['tidal-glass', 'velvet-rain']);
  const [playlists, setPlaylists] = useState<Playlist[]>(INITIAL_PLAYLISTS);
  const [recentIds, setRecentIds] = useState<string[]>(['tidal-glass', 'amber-drift', 'arctic-echo']);

  // Currents discovery filter state
  const [activeMood, setActiveMood] = useState<MoodCategory>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Telegram Bot Bridge & Group VC Admin Control state
  const [botModalOpen, setBotModalOpen] = useState<boolean>(false);
  const [activeRooms, setActiveRooms] = useState<ActiveVcRoomSummary[]>([]);
  const [botTokenConfigured, setBotTokenConfigured] = useState<boolean>(false);
  const [vcSession, setVcSession] = useState<GroupVcSession | null>(null);
  const [vcAccess, setVcAccess] = useState<GroupVcAccess | null>(null);
  const [isVcMode, setIsVcMode] = useState<boolean>(false);
  const [sandboxAsAdmin, setSandboxAsAdmin] = useState<boolean>(false);
  const [vcControlError, setVcControlError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

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

  const selectAndPlayTrack = useCallback((trackId: string) => {
    setCurrentTrackId(trackId);
    setProgress(0);
    setIsPlaying(true);
    setQueueIds((prev) => (prev.includes(trackId) ? prev : [...prev, trackId]));
    setRecentIds((prev) => [trackId, ...prev.filter((id) => id !== trackId)].slice(0, 8));
  }, []);

  const handleTrackAdvance = useCallback(() => {
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
        selectAndPlayTrack(nextTrack.id);
      }
    }
  }, [queue, tracks, currentTrack.id, repeatMode, shuffle, selectAndPlayTrack]);

  // Real HTML5 Audio + Web Audio 5-Band EQ engine for native Mini App streaming
  const { hasAudioUrl, isBuffering, streamError, seekAudio } = useAudioEngine({
    track: currentTrack,
    isPlaying,
    eq,
    spatialProfile,
    isVcRemoteMode: isVcMode,
    onTimeUpdate: setProgress,
    onTrackEnded: handleTrackAdvance,
  });

  const handleNext = () => {
    handleTrackAdvance();
  };

  const handlePrev = () => {
    const activeQueue = queue.length > 0 ? queue : tracks;
    const currentIndex = activeQueue.findIndex((t) => t.id === currentTrack.id);
    const result = getPrevTrackIndex(currentIndex, activeQueue.length, progress, repeatMode);
    if (result.index >= 0 && activeQueue[result.index]) {
      const target = activeQueue[result.index];
      if (target.id === currentTrack.id) {
        setProgress(0);
        seekAudio(0);
      } else {
        selectAndPlayTrack(target.id);
      }
    }
  };

  // Fallback progression timer only for demo tracks without live streamUrl
  useEffect(() => {
    if (!isPlaying || hasAudioUrl || isVcMode) return;
    const timer = window.setInterval(() => {
      setProgress((prev) => {
        if (prev + 1 >= currentTrack.duration) {
          return currentTrack.duration;
        }
        return prev + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isPlaying, hasAudioUrl, isVcMode, currentTrack.duration]);

  useEffect(() => {
    if (!isPlaying || hasAudioUrl || isVcMode || progress < currentTrack.duration) return;
    handleTrackAdvance();
  }, [progress, isPlaying, hasAudioUrl, isVcMode, currentTrack.duration, handleTrackAdvance]);

  // Live VC room ticker when VC is playing
  useEffect(() => {
    if (!isVcMode || !vcSession?.isPlaying || !vcSession.currentTrack) return;
    const timer = window.setInterval(() => {
      setVcSession((prev) => {
        if (!prev || !prev.isPlaying) return prev;
        const maxDur = prev.duration || prev.currentTrack?.duration || 180;
        return {
          ...prev,
          progress: Math.min(maxDur, prev.progress + Math.max(1, Math.round(prev.speed))),
        };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isVcMode, vcSession?.isPlaying, vcSession?.currentTrack, vcSession?.speed]);

  const refreshRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/vc/rooms');
      if (!res.ok) return;
      const data = (await res.json()) as {
        rooms?: ActiveVcRoomSummary[];
        botTokenConfigured?: boolean;
      };
      setActiveRooms(data.rooms || []);
      setBotTokenConfigured(Boolean(data.botTokenConfigured));
    } catch {
      // Ignore network hiccups
    }
  }, []);

  const connectVcSession = useCallback(
    async (chatId: string, asSandboxAdmin = false) => {
      setVcControlError(null);
      setSandboxAsAdmin(asSandboxAdmin);
      try {
        const res = await fetch('/api/vc/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId,
            initData: telegramContext.rawInitData,
            sandboxAsAdmin: asSandboxAdmin,
          }),
        });
        const data = (await res.json()) as {
          session?: GroupVcSession | null;
          access?: GroupVcAccess;
          error?: string;
        };
        if (data.session) {
          setVcSession(data.session);
          setVcAccess(
            data.access || {
              authorized: false,
              role: 'guest',
              reason: 'Unable to verify group admin access.',
            }
          );
          setIsVcMode(true);
          setActiveTab('stage');

          // Subscribe to live WebSocket updates for this chatId
          wsRef.current?.close();
          const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
          ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'subscribe', chatId }));
          };
          ws.onmessage = (evt) => {
            try {
              const msg = JSON.parse(evt.data) as {
                event?: string;
                chatId?: string;
                session?: GroupVcSession;
              };
              if (msg.event === 'vc:state' && msg.session && msg.chatId === chatId) {
                setVcSession(msg.session);
              }
            } catch {
              // Ignore malformed ws event
            }
          };
          wsRef.current = ws;
        } else {
          setVcControlError(data.access?.reason || data.error || 'Group VC not active.');
        }
      } catch {
        setVcControlError('Could not connect to Group VC sync server.');
      }
    },
    [telegramContext.rawInitData]
  );

  // Auto-open Group VC mode if launched via Telegram Group's "Advanced Music Control" button
  useEffect(() => {
    refreshRooms();
    const initialChatId = parseVcChatIdFromStartParam(telegramContext.startParam);
    if (initialChatId) {
      connectVcSession(initialChatId, false);
    }
    return () => {
      wsRef.current?.close();
    };
  }, [telegramContext.startParam, connectVcSession, refreshRooms]);

  const handleCreateSandboxRoom = async (asAdmin: boolean) => {
    try {
      const res = await fetch('/api/vc/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { session?: GroupVcSession };
      if (data.session) {
        await refreshRooms();
        await connectVcSession(data.session.chatId, asAdmin);
      }
    } catch {
      setVcControlError('Unable to initialize sandbox VC room.');
    }
  };

  const handleVcAction = async (
    action:
      | 'pause'
      | 'resume'
      | 'skip'
      | 'replay'
      | 'stop'
      | 'seek'
      | 'speed'
      | 'jump_queue'
      | 'remove_queue'
      | 'enqueue',
    payload?: Record<string, unknown>
  ) => {
    if (!vcSession) return;
    setVcControlError(null);
    triggerTelegramHaptic('light');
    try {
      const res = await fetch('/api/vc/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: vcSession.chatId,
          initData: telegramContext.rawInitData,
          sandboxAsAdmin,
          action,
          payload,
        }),
      });
      const data = (await res.json()) as {
        session?: GroupVcSession;
        error?: string;
      };
      if (!res.ok) {
        setVcControlError(data.error || 'Action denied for non-admins.');
        return;
      }
      if (data.session) {
        setVcSession(data.session);
      }
    } catch {
      setVcControlError('Failed to send Group VC control command.');
    }
  };

  const handleSearchRemote = async (query: string) => {
    const q = query.trim();
    if (!q) return;
    setRemoteSearching(true);
    setRemoteError(null);
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('Search request failed');
      const data = (await res.json()) as {
        tracks?: Array<{
          id: string;
          vidid: string;
          title: string;
          artist: string;
          duration: number;
          coverUrl: string;
          sourceMirror: string;
          streamUrl: string;
        }>;
        winningSource?: string;
      };
      const mapped: Track[] = (data.tracks || []).map((item) => ({
        id: item.id,
        vidid: item.vidid,
        title: item.title,
        artist: item.artist,
        album: 'Live Stream',
        duration: item.duration || 180,
        mood: 'Midnight Drive',
        coverUrl: item.coverUrl,
        streamUrl: item.streamUrl,
        sourceMirror: item.sourceMirror,
        bpm: 120,
        formatLabel: 'AAC / MP3 Stream',
        palette: DEMO_TRACKS[0].palette,
        waveform: DEMO_TRACKS[0].waveform,
        lyrics: [{ time: 0, text: `${item.title} — ${item.artist}` }],
      }));
      setRemoteTracks(mapped);
      setRemoteSource(data.winningSource || null);
      if (mapped.length === 0) {
        setRemoteError('No online streams returned from mirrors yet. Ensure MUSIC_API_KEY or yt-dlp is reachable.');
      }
    } catch {
      setRemoteError('Online search mirrors are currently unreachable.');
    } finally {
      setRemoteSearching(false);
    }
  };

  const handlePlayRemoteTrack = (remoteTrack: Track) => {
    setTracks((prev) =>
      prev.some((t) => t.id === remoteTrack.id) ? prev : [remoteTrack, ...prev]
    );
    setIsVcMode(false);
    selectAndPlayTrack(remoteTrack.id);
    setActiveTab('stage');
  };

  const handleEnqueueToVc = (remoteTrack: Track) => {
    if (!vcSession || !vcAccess?.authorized) return;
    handleVcAction('enqueue', {
      track: {
        vidid: remoteTrack.vidid || remoteTrack.id,
        title: remoteTrack.title,
        artist: remoteTrack.artist,
        duration: remoteTrack.duration,
        coverUrl: remoteTrack.coverUrl,
        requestedBy: vcAccess.userName || 'Admin',
        streamType: 'audio',
      },
    });
    setActiveTab('stage');
  };

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

  const handleSelectEqPreset = (preset: Exclude<EqPresetName, 'Custom'>) => {
    setEq((prev) => ({
      ...prev,
      preset,
      bands: getEqPresetBands(preset),
    }));
  };

  const handleChangeEqBand = (index: number, gain: number) => {
    setEq((prev) => {
      const nextBands = [...prev.bands];
      nextBands[index] = clampEqGain(gain);
      return {
        ...prev,
        preset: 'Custom',
        bands: nextBands,
      };
    });
  };

  const handleResetEq = () => {
    setEq({
      preset: 'Flat',
      bands: getEqPresetBands('Flat'),
      preamp: 0,
      bassBoost: 0,
      stereoWidth: 50,
    });
  };

  return (
    <MotionConfig reducedMotion="user">
      <div
        data-playback-state={isPlaying ? 'playing' : 'paused'}
        data-active-tab={activeTab}
        className="min-h-screen relative flex flex-col bg-[#07090e] text-slate-100 overflow-x-hidden"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 transition-all duration-700"
          style={{
            background: `radial-gradient(62% 50% at 18% 8%, ${currentTrack.palette.primary}2b 0%, transparent 70%), radial-gradient(58% 48% at 86% 92%, ${currentTrack.palette.secondary}44 0%, transparent 72%)`,
          }}
        />

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
              isBuffering={isBuffering}
              streamError={streamError}
              shuffle={shuffle}
              repeatMode={repeatMode}
              spatialProfile={spatialProfile}
              eqPreset={eq.preset}
              likedIds={likedIds}
              queue={queue}
              vcSession={vcSession}
              vcAccess={vcAccess}
              isVcMode={isVcMode}
              vcControlError={vcControlError}
              onExitVcMode={() => setIsVcMode(false)}
              onVcAction={handleVcAction}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              onNext={handleNext}
              onPrev={handlePrev}
              onSeek={(sec) => {
                setProgress(sec);
                seekAudio(sec);
              }}
              onToggleShuffle={() => setShuffle((s) => !s)}
              onCycleRepeat={handleCycleRepeat}
              onChangeSpatial={setSpatialProfile}
              onToggleLike={handleToggleLike}
              onPlayTrack={selectAndPlayTrack}
              onRemoveFromQueue={handleRemoveFromQueue}
              onOpenCurrents={() => setActiveTab('currents')}
              onOpenLyrics={() => setActiveTab('wave')}
              onOpenEq={() => setActiveTab('eq')}
            />
          )}

          {activeTab === 'currents' && (
            <CurrentsView
              tracks={tracks}
              filteredTracks={filteredTracks}
              remoteTracks={remoteTracks}
              remoteSource={remoteSource}
              remoteSearching={remoteSearching}
              remoteError={remoteError}
              activeMood={activeMood}
              searchQuery={searchQuery}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              likedIds={likedIds}
              queueIds={queueIds}
              canSendToVc={Boolean(vcSession && vcAccess?.authorized)}
              vcGroupTitle={vcSession?.groupTitle}
              onMoodChange={setActiveMood}
              onSearchChange={setSearchQuery}
              onSearchRemote={handleSearchRemote}
              onPlayTrack={(id) => {
                setIsVcMode(false);
                selectAndPlayTrack(id);
              }}
              onPlayRemoteTrack={handlePlayRemoteTrack}
              onEnqueueToVc={handleEnqueueToVc}
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

          {activeTab === 'eq' && (
            <EqualizerView
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              eq={eq}
              onSelectPreset={handleSelectEqPreset}
              onChangeBand={handleChangeEqBand}
              onChangePreamp={(preamp) => setEq((prev) => ({ ...prev, preamp }))}
              onChangeBassBoost={(bassBoost) => setEq((prev) => ({ ...prev, bassBoost }))}
              onChangeStereoWidth={(stereoWidth) => setEq((prev) => ({ ...prev, stereoWidth }))}
              onResetEq={handleResetEq}
              onTogglePlay={() => setIsPlaying((p) => !p)}
            />
          )}

          {activeTab === 'crate' && (
            <CrateView
              tracks={tracks}
              likedIds={likedIds}
              playlists={playlists}
              recentIds={recentIds}
              currentTrack={currentTrack}
              onPlayTrack={(id) => {
                setIsVcMode(false);
                selectAndPlayTrack(id);
              }}
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
              onSeek={(sec) => {
                setProgress(sec);
                seekAudio(sec);
              }}
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
          activeRooms={activeRooms}
          botTokenConfigured={botTokenConfigured}
          onRefreshRooms={refreshRooms}
          onConnectVcRoom={(chatId, asAdmin) => connectVcSession(chatId, asAdmin)}
          onCreateSandboxRoom={handleCreateSandboxRoom}
          onClose={() => setBotModalOpen(false)}
        />
      </div>
    </MotionConfig>
  );
}
