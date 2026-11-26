import { motion } from 'motion/react';
import { triggerTelegramHaptic } from '../utils/telegramBridge';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedGlassProps<T extends string> {
  groupId: string;
  ariaLabel: string;
  options: SegmentedOption<T>[];
  value: T | string;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Apple Liquid Glass segmented control with sliding spring-inertia pill indicator
 * that settles with a subtle physical overshoot wobble.
 */
export function SegmentedGlass<T extends string>({
  groupId,
  ariaLabel,
  options,
  value,
  onChange,
  className = '',
  size = 'sm',
}: SegmentedGlassProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1 rounded-2xl liquid-glass-subtle p-1 max-w-full overflow-x-auto ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => {
              triggerTelegramHaptic('selection');
              onChange(opt.value);
            }}
            className={`relative liquid-press rounded-xl font-medium whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80 ${
              size === 'sm' ? 'min-h-[38px] px-3.5 py-1.5 text-xs' : 'min-h-[42px] px-4 py-2 text-sm'
            } ${active ? 'text-white' : 'text-slate-300 hover:text-white'}`}
          >
            {active && (
              <motion.span
                layoutId={groupId}
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
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
