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
        maxRadius: options?.maxRadius ?? 220,
        duration: options?.duration ?? 920,
        rgb: options?.rgb,
      },
    })
  );
}

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
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const drawFrame = (now: number) => {
      const delta = lastTimeRef.current ? Math.min(now - lastTimeRef.current, 64) : 16;
      lastTimeRef.current = now;

      wavesRef.current = stepWaves(wavesRef.current, delta);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (const wave of wavesRef.current) {
        const progress = Math.min(wave.age / wave.duration, 1);
        // Apple-like fluid cubic ease-out
        const eased = 1 - Math.pow(1 - progress, 3);
        const radius = 8 + eased * wave.maxRadius;
        const alpha = Math.pow(1 - progress, 1.8) * 0.55 * wave.intensity;

        // 1. Center droplet flash (first 220ms)
        if (progress < 0.25) {
          const flashAlpha = (1 - progress / 0.25) * 0.35 * wave.intensity;
          const flashGrad = ctx.createRadialGradient(
            wave.x,
            wave.y,
            0,
            wave.x,
            wave.y,
            26 + progress * 60
          );
          flashGrad.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`);
          flashGrad.addColorStop(0.55, `rgba(${wave.rgb}, ${flashAlpha * 0.45})`);
          flashGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = flashGrad;
          ctx.beginPath();
          ctx.arc(wave.x, wave.y, 26 + progress * 60, 0, Math.PI * 2);
          ctx.fill();
        }

        // 2. Primary refractive caustic ring
        const bandGrad = ctx.createRadialGradient(
          wave.x,
          wave.y,
          Math.max(0, radius - 18),
          wave.x,
          wave.y,
          radius + 6
        );
        bandGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        bandGrad.addColorStop(0.55, `rgba(${wave.rgb}, ${alpha * 0.22})`);
        bandGrad.addColorStop(0.88, `rgba(255, 255, 255, ${alpha * 0.52})`);
        bandGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = bandGrad;
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, radius + 6, 0, Math.PI * 2);
        ctx.fill();

        // Crisp water meniscus stroke
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.72})`;
        ctx.lineWidth = Math.max(0.75, (1 - progress) * 2.1);
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        // 3. Secondary trailing harmonic wake
        if (progress > 0.11) {
          const wakeP = Math.min((progress - 0.11) / 0.89, 1);
          const wakeEased = 1 - Math.pow(1 - wakeP, 2.7);
          const wakeRadius = 4 + wakeEased * (wave.maxRadius * 0.72);
          const wakeAlpha = Math.pow(1 - wakeP, 2) * 0.38 * wave.intensity;

          ctx.strokeStyle = `rgba(${wave.rgb}, ${wakeAlpha})`;
          ctx.lineWidth = Math.max(0.5, (1 - wakeP) * 1.4);
          ctx.beginPath();
          ctx.arc(wave.x, wave.y, wakeRadius, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 4. Tertiary subtle inner ring for intense interactions
        if (wave.intensity >= 1.15 && progress > 0.22) {
          const innerP = Math.min((progress - 0.22) / 0.78, 1);
          const innerEased = 1 - Math.pow(1 - innerP, 2.4);
          const innerRadius = 2 + innerEased * (wave.maxRadius * 0.45);
          const innerAlpha = Math.pow(1 - innerP, 2.2) * 0.28;
          ctx.strokeStyle = `rgba(255, 255, 255, ${innerAlpha})`;
          ctx.lineWidth = 0.85;
          ctx.beginPath();
          ctx.arc(wave.x, wave.y, innerRadius, 0, Math.PI * 2);
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

    const scheduleWave = (
      x: number,
      y: number,
      options?: { intensity?: number; maxRadius?: number; duration?: number; rgb?: string }
    ) => {
      if (prefersReducedMotion) return;
      wavesRef.current = spawnWave(wavesRef.current, {
        id: nextIdRef.current++,
        x,
        y,
        rgb: options?.rgb || rgbRef.current,
        intensity: options?.intensity ?? 1,
        maxRadius: options?.maxRadius ?? 215,
        duration: options?.duration ?? 920,
      });

      if (rafRef.current === null) {
        lastTimeRef.current = 0;
        rafRef.current = window.requestAnimationFrame(drawFrame);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      scheduleWave(event.clientX, event.clientY, {
        intensity: 1,
        maxRadius: 215,
        duration: 900,
      });
    };

    const handleCustomWave = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        x: number;
        y: number;
        intensity?: number;
        maxRadius?: number;
        duration?: number;
        rgb?: string;
      };
      if (!detail) return;
      scheduleWave(detail.x, detail.y, detail);
    };

    const handleKeyActivate = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body) return;
      const rect = active.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      scheduleWave(rect.left + rect.width / 2, rect.top + rect.height / 2, {
        intensity: 0.9,
        maxRadius: 185,
      });
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('ondine:wave', handleCustomWave);
    window.addEventListener('keydown', handleKeyActivate, { passive: true });

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('ondine:wave', handleCustomWave);
      window.removeEventListener('keydown', handleKeyActivate);
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
