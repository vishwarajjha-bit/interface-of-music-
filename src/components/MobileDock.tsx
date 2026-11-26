import { Disc3, Compass, Layers, Waves } from 'lucide-react';
import type { AppTab } from '../types/music';
import { triggerTelegramHaptic } from '../utils/telegramBridge';

interface MobileDockProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
}

const DOCK_ITEMS: { id: AppTab; label: string; Icon: typeof Disc3 }[] = [
  { id: 'stage', label: 'Stage', Icon: Disc3 },
  { id: 'currents', label: 'Currents', Icon: Compass },
  { id: 'crate', label: 'Crate', Icon: Layers },
  { id: 'wave', label: 'Wave', Icon: Waves },
];

export function MobileDock({ activeTab, onSelectTab }: MobileDockProps) {
  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-2 left-3 right-3 z-40 h-14 rounded-2xl liquid-glass-elevated px-1.5"
    >
      <div className="grid h-full grid-cols-4 items-center gap-1">
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
              className={`min-h-[44px] flex flex-col items-center justify-center rounded-xl transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80 ${
                isActive
                  ? 'bg-white/[0.16] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]'
                  : 'text-slate-300/80 hover:text-white'
              }`}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              <span className="mt-0.5 text-[11px] font-medium leading-none whitespace-nowrap">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
