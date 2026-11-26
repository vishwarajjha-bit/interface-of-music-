import { useRef, useState, type ButtonHTMLAttributes, type PointerEvent, type ReactNode } from 'react';
import { triggerTelegramHaptic } from '../utils/telegramBridge';

interface LocalWave {
  id: number;
  x: number;
  y: number;
}

interface LiquidButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'glass' | 'elevated' | 'primary' | 'subtle' | 'ghost';
  haptic?: 'light' | 'medium' | 'selection';
}

export function LiquidButton({
  children,
  className = '',
  variant = 'glass',
  haptic = 'light',
  onPointerDown,
  ...rest
}: LiquidButtonProps) {
  const [waves, setWaves] = useState<LocalWave[]>([]);
  const waveId = useRef(1);

  const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX ? e.clientX - rect.left : rect.width / 2;
    const y = e.clientY ? e.clientY - rect.top : rect.height / 2;
    const id = waveId.current++;

    setWaves((prev) => [...prev.slice(-3), { id, x, y }]);
    triggerTelegramHaptic(haptic);

    window.setTimeout(() => {
      setWaves((prev) => prev.filter((item) => item.id !== id));
    }, 700);

    onPointerDown?.(e);
  };

  const variantClasses = {
    glass: 'liquid-glass hover:bg-white/[0.15] hover:border-white/30 text-white',
    elevated: 'liquid-glass-elevated hover:bg-white/[0.2] hover:border-white/35 text-white',
    primary:
      'bg-white text-slate-950 hover:bg-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_32px_rgba(255,255,255,0.18)] font-medium',
    subtle: 'liquid-glass-subtle hover:bg-white/[0.11] text-slate-100',
    ghost: 'bg-transparent hover:bg-white/[0.08] text-slate-200 border border-transparent',
  }[variant];

  return (
    <button
      onPointerDown={handlePointerDown}
      className={`relative overflow-hidden liquid-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80 disabled:opacity-45 disabled:pointer-events-none cursor-pointer ${variantClasses} ${className}`}
      {...rest}
    >
      {waves.map((wave) => (
        <span
          key={wave.id}
          aria-hidden="true"
          className="pointer-events-none absolute h-24 w-24 rounded-full animate-local-wave"
          style={{
            left: wave.x,
            top: wave.y,
            background:
              variant === 'primary'
                ? 'radial-gradient(circle, rgba(14,165,233,0.32) 0%, rgba(14,165,233,0) 70%)'
                : 'radial-gradient(circle, rgba(255,255,255,0.42) 0%, rgba(186,230,253,0.18) 42%, rgba(255,255,255,0) 72%)',
          }}
        />
      ))}
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
    </button>
  );
}
