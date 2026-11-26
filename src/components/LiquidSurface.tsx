import type { ButtonHTMLAttributes, PointerEvent, ReactNode } from 'react';
import { triggerTelegramHaptic } from '../utils/telegramBridge';

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
  const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    triggerTelegramHaptic(haptic);
    onPointerDown?.(e);
  };

  const variantClasses = {
    glass: 'liquid-glass hover:bg-white/[0.15] hover:border-white/30 text-white',
    elevated: 'liquid-glass-elevated hover:bg-white/[0.2] hover:border-white/35 text-white',
    primary:
      'bg-white text-slate-950 hover:bg-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_rgba(255,255,255,0.16)] font-medium',
    subtle: 'liquid-glass-subtle hover:bg-white/[0.11] text-slate-100',
    ghost: 'bg-transparent hover:bg-white/[0.08] text-slate-200 border border-transparent',
  }[variant];

  return (
    <button
      onPointerDown={handlePointerDown}
      className={`relative overflow-hidden liquid-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80 disabled:opacity-45 disabled:pointer-events-none cursor-pointer ${variantClasses} ${className}`}
      {...rest}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
    </button>
  );
}
