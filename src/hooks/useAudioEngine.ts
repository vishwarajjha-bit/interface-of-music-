import { useEffect, useRef, useState } from 'react';
import type { EqSettings, SpatialProfile, Track } from '../types/music';

const BAND_CENTER_FREQS = [60, 230, 910, 3600, 14000];

interface UseAudioEngineOptions {
  track: Track;
  isPlaying: boolean;
  eq: EqSettings;
  spatialProfile: SpatialProfile;
  isVcRemoteMode: boolean;
  onTimeUpdate: (seconds: number) => void;
  onTrackEnded: () => void;
}

export function useAudioEngine({
  track,
  isPlaying,
  eq,
  spatialProfile,
  isVcRemoteMode,
  onTimeUpdate,
  onTrackEnded,
}: UseAudioEngineOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const preampRef = useRef<GainNode | null>(null);
  const bassShelfRef = useRef<BiquadFilterNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const [isBuffering, setIsBuffering] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onTrackEndedRef = useRef(onTrackEnded);
  onTimeUpdateRef.current = onTimeUpdate;
  onTrackEndedRef.current = onTrackEnded;

  const hasAudioUrl = Boolean(track.streamUrl);

  // Initialize hidden <audio> element once
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'metadata';
    audioRef.current = audio;

    const handleTime = () => {
      onTimeUpdateRef.current(Math.floor(audio.currentTime || 0));
    };
    const handleEnded = () => {
      setIsBuffering(false);
      onTrackEndedRef.current();
    };
    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => {
      setIsBuffering(false);
      setStreamError(null);
    };
    const handleError = () => {
      setIsBuffering(false);
      if (audio.src) {
        setStreamError('Unable to stream this track right now. Try another mirror or track.');
      }
    };

    audio.addEventListener('timeupdate', handleTime);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTime);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  // Build Web Audio EQ chain lazily on playback
  const ensureAudioGraph = () => {
    const audio = audioRef.current;
    if (!audio || ctxRef.current) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const source = ctx.createMediaElementSource(audio);
    const preamp = ctx.createGain();
    const bassShelf = ctx.createBiquadFilter();
    bassShelf.type = 'lowshelf';
    bassShelf.frequency.value = 110;

    const filters = BAND_CENTER_FREQS.map((freq, idx) => {
      const f = ctx.createBiquadFilter();
      f.type = idx === 0 ? 'lowshelf' : idx === BAND_CENTER_FREQS.length - 1 ? 'highshelf' : 'peaking';
      f.frequency.value = freq;
      f.Q.value = 1.1;
      return f;
    });

    source.connect(preamp);
    preamp.connect(bassShelf);
    let node: AudioNode = bassShelf;
    for (const f of filters) {
      node.connect(f);
      node = f;
    }
    node.connect(ctx.destination);

    ctxRef.current = ctx;
    preampRef.current = preamp;
    bassShelfRef.current = bassShelf;
    filtersRef.current = filters;
  };

  // Apply real-time EQ bands, preamp, bass boost, and spatial tone
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;

    if (preampRef.current) {
      const db = eq.preamp;
      const linear = Math.pow(10, db / 20);
      preampRef.current.gain.setTargetAtTime(linear, now, 0.03);
    }

    if (bassShelfRef.current) {
      const boostDb = (eq.bassBoost / 100) * 6 + (spatialProfile === 'Warm Analog' ? 2 : 0);
      bassShelfRef.current.gain.setTargetAtTime(boostDb, now, 0.04);
    }

    filtersRef.current.forEach((filter, idx) => {
      let gain = eq.bands[idx] ?? 0;
      if (spatialProfile === 'Glass Hall' && idx >= 3) gain += 1.5;
      filter.gain.setTargetAtTime(gain, now, 0.03);
    });
  }, [eq, spatialProfile]);

  // Load track stream URL when track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setStreamError(null);

    if (!track.streamUrl || isVcRemoteMode) {
      audio.pause();
      if (audio.src) {
        audio.removeAttribute('src');
        audio.load();
      }
      setIsBuffering(false);
      return;
    }

    if (audio.getAttribute('data-track-id') !== track.id) {
      audio.setAttribute('data-track-id', track.id);
      audio.src = track.streamUrl;
      audio.load();
    }
  }, [track.id, track.streamUrl, isVcRemoteMode]);

  // Play / Pause control
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track.streamUrl || isVcRemoteMode) return;

    if (isPlaying) {
      ensureAudioGraph();
      if (ctxRef.current?.state === 'suspended') {
        ctxRef.current.resume().catch(() => {});
      }
      setIsBuffering(true);
      audio
        .play()
        .then(() => setIsBuffering(false))
        .catch(() => setIsBuffering(false));
    } else {
      audio.pause();
    }
  }, [isPlaying, track.streamUrl, isVcRemoteMode]);

  const seekAudio = (seconds: number) => {
    const audio = audioRef.current;
    if (audio && track.streamUrl && Number.isFinite(audio.duration)) {
      audio.currentTime = Math.max(0, Math.min(seconds, audio.duration));
    }
  };

  return {
    hasAudioUrl,
    isBuffering,
    streamError,
    seekAudio,
  };
}
