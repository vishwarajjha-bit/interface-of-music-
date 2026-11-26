import { useEffect, useRef } from 'react';
import { spawnWave, stepWaves } from '../utils/playerLogic';
import type { WaveRipple } from '../types/music';

interface WaterWaveCanvasProps {
  rippleRgb: string;
}

export function emitWaterWave(
  x: number,
  y: number,
  options?: { intensity?: number; maxRadius?: number; duration?: number; rgb?: string }
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('ondine:wave', {
      detail: {
        x,
        y,
        intensity: options?.intensity ?? 1,
        maxRadius: options?.maxRadius ?? 170,
        duration: options?.duration ?? 620,
        rgb: options?.rgb,
      },
    })
  );
}

/**
 * Minimal, zero-lag water-ripple canvas: only renders when explicit ondine:wave
 * events are emitted (e.g. Prism or Wave Pond), using lightweight single-stroke arcs.
 */
export function WaterWaveCanvas({ rippleRgb }: WaterWaveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wavesRef = useRef<WaveRipple[]>([]);
  const nextIdRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const rgbRef = useRef(rippleRgb);

  useEffect(() => {
    rgbRef.current = rippleRgb;
  }, [rippleRgb]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };

    resize();
    window.addEventListener('resize', resize);

    const drawFrame = (now: number) => {
      const delta = lastTimeRef.current ? Math.min(now - lastTimeRef.current, 64) : 16;
      lastTimeRef.current = now;

      wavesRef.current = stepWaves(wavesRef.current, delta);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const wave of wavesRef.current) {
        const progress = Math.min(wave.age / wave.duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const radius = 10 + eased * wave.maxRadius;
        const alpha = Math.pow(1 - progress, 2) * 0.42 * wave.intensity;

        ctx.strokeStyle = `rgba(${wave.rgb}, ${alpha})`;
        ctx.lineWidth = Math.max(0.75, (1 - progress) * 1.6);
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        if (progress > 0.14) {
          const wakeP = (progress - 0.14) / 0.86;
          const wakeRadius = 6 + (1 - Math.pow(1 - wakeP, 2.5)) * (wave.maxRadius * 0.65);
          const wakeAlpha = Math.pow(1 - wakeP, 2.2) * 0.24 * wave.intensity;
          ctx.strokeStyle = `rgba(255, 255, 255, ${wakeAlpha})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.arc(wave.x, wave.y, wakeRadius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      if (wavesRef.current.length > 0) {
        rafRef.current = window.requestAnimationFrame(drawFrame);
      } else {
        rafRef.current = null;
        lastTimeRef.current = 0;
      }
    };

    const handleCustomWave = (event: Event) => {
      if (prefersReducedMotion) return;
      const detail = (event as CustomEvent).detail as {
        x: number;
        y: number;
        intensity?: number;
        maxRadius?: number;
        duration?: number;
        rgb?: string;
      };
      if (!detail) return;

      wavesRef.current = spawnWave(
        wavesRef.current,
        {
          id: nextIdRef.current++,
          x: detail.x,
          y: detail.y,
          rgb: detail.rgb || rgbRef.current,
          intensity: detail.intensity ?? 1,
          maxRadius: detail.maxRadius ?? 170,
          duration: detail.duration ?? 620,
        },
        8
      );

      if (rafRef.current === null) {
        lastTimeRef.current = 0;
        rafRef.current = window.requestAnimationFrame(drawFrame);
      }
    };

    window.addEventListener('ondine:wave', handleCustomWave);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('ondine:wave', handleCustomWave);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="water-wave-canvas"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50"
    />
  );
}
