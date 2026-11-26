import { Send } from 'lucide-react';
import type { AppTab } from '../types/music';
import { LiquidButton } from './LiquidSurface';

interface TopBarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onOpenBotBridge: () => void;
}

const NAV_ITEMS: { id: AppTab; label: string }[] = [
  { id: 'stage', label: 'Soundstage' },
  { id: 'currents', label: 'Currents' },
  { id: 'crate', label: 'Crate' },
  { id: 'wave', label: 'Wave' },
];

export function TopBar({ activeTab, onSelectTab, onOpenBotBridge }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07090e]/65 backdrop-blur-2xl">
      <div className="mx-auto flex h-12 md:h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('stage')}
          className="font-display text-lg sm:text-xl font-semibold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80 rounded-md px-1"
        >
          Ondine
        </button>

        {/* Zone 2: Desktop Single-Line Navigation Links */}
        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-8">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80 rounded-md px-1 ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-1 -bottom-[1px] h-[2px] rounded-full bg-white transition-opacity duration-200 ${
                    isActive ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          <LiquidButton
            type="button"
            variant="subtle"
            onClick={onOpenBotBridge}
            className="h-9 md:h-10 px-3.5 md:px-4 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap shrink-0"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Bot Bridge</span>
          </LiquidButton>
        </div>
      </div>
    </header>
  );
}
