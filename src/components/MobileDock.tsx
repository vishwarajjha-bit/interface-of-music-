import { Compass, Disc3, Layers, Sliders, Waves } from 'lucide-react';
import { motion } from 'motion/react';
import type { AppTab } from '../types/music';
import { triggerTelegramHaptic } from '../utils/telegramBridge';

interface MobileDockProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
}

const DOCK_ITEMS: { id: AppTab; label: string; Icon: typeof Disc3 }[] = [
  { id: 'stage', label: 'Stage', Icon: Disc3 },
  { id: 'currents', label: 'Currents', Icon: Compass },
  { id: 'eq', label: 'EQ', Icon: Sliders },
  { id: 'crate', label: 'Crate', Icon: Layers },
  { id: 'wave', label: 'Wave', Icon: Waves },
];

export function MobileDock({ activeTab, onSelectTab }: MobileDockProps) {
  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-2 left-3 right-3 z-40 h-14 rounded-2xl liquid-glass-elevated px-1.5"
    >
      <div className="grid h-full grid-cols-5 items-center gap-1">
        {DOCK_ITEMS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                triggerTelegramHaptic('selection');
                onSelectTab(id);
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`relative min-h-[44px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80 ${
                isActive ? 'text-white' : 'text-slate-300/80 hover:text-white'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="mobile-dock-pill"
                  aria-hidden="true"
                  transition={{
                    type: 'spring',
                    stiffness: 420,
                    damping: 20,
                    mass: 0.9,
                  }}
                  className="absolute inset-0 rounded-xl bg-white/[0.16] shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
                />
              )}
              <Icon className="relative z-10 h-[17px] w-[17px]" aria-hidden="true" />
              <span className="relative z-10 mt-0.5 text-[10px] font-medium leading-none whitespace-nowrap">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
