import { Check, Copy, Radio, Send, ShieldCheck, ShieldAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ActiveVcRoomSummary, TelegramContextInfo, Track } from '../types/music';
import { buildBotSyncPayload, sendPayloadToTelegramBot } from '../utils/telegramBridge';
import { LiquidButton } from './LiquidSurface';

interface BotBridgeModalProps {
  isOpen: boolean;
  telegramContext: TelegramContextInfo;
  currentTrack: Track;
  isPlaying: boolean;
  progress: number;
  activeRooms: ActiveVcRoomSummary[];
  botTokenConfigured: boolean;
  onRefreshRooms: () => void;
  onConnectVcRoom: (chatId: string, sandboxAsAdmin: boolean) => void;
  onCreateSandboxRoom: (asAdmin: boolean) => void;
  onClose: () => void;
}

export function BotBridgeModal({
  isOpen,
  telegramContext,
  currentTrack,
  isPlaying,
  progress,
  activeRooms,
  botTokenConfigured,
  onRefreshRooms,
  onConnectVcRoom,
  onCreateSandboxRoom,
  onClose,
}: BotBridgeModalProps) {
  const [copied, setCopied] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    onRefreshRooms();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, onRefreshRooms]);

  if (!isOpen) return null;

  const payload = buildBotSyncPayload(currentTrack, isPlaying, progress);
  const payloadJson = JSON.stringify(payload, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payloadJson);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setSyncNotice('Clipboard access unavailable in this browser.');
    }
  };

  const handleTestSync = () => {
    const sent = sendPayloadToTelegramBot(payload);
    setSyncNotice(
      sent
        ? 'Payload dispatched to Telegram Bot WebApp.'
        : 'Preview mode active — link your AWS bot via BOT_BRIDGE_SECRET to stream commands live.'
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bot-bridge-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md"
    >
      <div className="w-full max-w-xl max-h-[88vh] overflow-y-auto liquid-glass-elevated rounded-3xl p-6 sm:p-7 space-y-5 relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="bot-bridge-title" className="font-display text-xl font-semibold text-white">
              Telegram Bot & Group VC Bridge
            </h2>
            <p className="text-xs text-slate-300 mt-1 font-mono-tabular">
              {telegramContext.platform} · {telegramContext.userName} ·{' '}
              {botTokenConfigured ? 'Bot Token Verified Mode' : 'Preview Mode'}
            </p>
          </div>
          <LiquidButton
            type="button"
            variant="ghost"
            onClick={onClose}
            aria-label="Close Telegram Bot Bridge"
            className="min-h-[44px] min-w-[44px] rounded-full shrink-0"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </LiquidButton>
        </div>

        {/* Active Group Voice Chat Rooms */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-slate-300">Active Group Voice Chats</h3>
            <button
              type="button"
              onClick={onRefreshRooms}
              className="text-xs text-sky-300 hover:text-sky-200 cursor-pointer"
            >
              Refresh
            </button>
          </div>

          {activeRooms.length === 0 ? (
            <div className="rounded-2xl bg-black/30 border border-white/10 p-4 text-xs text-slate-300 space-y-3">
              <p>
                No live Group VC sessions synced yet. When your Python AloneMusic bot plays in any
                Telegram group, each chat appears isolated here by group ID.
              </p>
              {!botTokenConfigured && (
                <div className="flex flex-wrap gap-2">
                  <LiquidButton
                    type="button"
                    variant="subtle"
                    onClick={() => {
                      onCreateSandboxRoom(true);
                      onClose();
                    }}
                    className="h-9 px-3 rounded-xl text-xs"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                    <span>Test Admin VC Room</span>
                  </LiquidButton>
                  <LiquidButton
                    type="button"
                    variant="subtle"
                    onClick={() => {
                      onCreateSandboxRoom(false);
                      onClose();
                    }}
                    className="h-9 px-3 rounded-xl text-xs"
                  >
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                    <span>Test Non-Admin Lock</span>
                  </LiquidButton>
                </div>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {activeRooms.map((room) => (
                <li
                  key={room.chatId}
                  className="rounded-2xl bg-black/30 border border-white/10 p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate flex items-center gap-2">
                      <Radio className="h-3.5 w-3.5 text-sky-300 shrink-0" aria-hidden="true" />
                      <span className="truncate">{room.groupTitle}</span>
                    </p>
                    <p className="text-xs text-slate-400 truncate mt-0.5 font-mono-tabular">
                      {room.trackTitle} · {room.queueCount} queued
                    </p>
                  </div>
                  <LiquidButton
                    type="button"
                    variant="subtle"
                    onClick={() => {
                      onConnectVcRoom(room.chatId, true);
                      onClose();
                    }}
                    className="h-9 px-3 rounded-xl text-xs shrink-0"
                  >
                    Open VC
                  </LiquidButton>
                </li>
              ))}
            </ul>
          )}
        </section>

        <pre className="rounded-2xl bg-black/40 border border-white/10 p-4 text-xs font-mono-tabular text-sky-100 overflow-x-auto">
          {payloadJson}
        </pre>

        {syncNotice && (
          <p className="text-xs text-sky-200" role="status">
            {syncNotice}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
          <LiquidButton
            type="button"
            variant="subtle"
            onClick={handleCopy}
            className="h-11 px-4 rounded-xl text-xs font-medium"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                <span>Copied JSON</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" aria-hidden="true" />
                <span>Copy Payload</span>
              </>
            )}
          </LiquidButton>

          <LiquidButton
            type="button"
            variant="primary"
            onClick={handleTestSync}
            className="h-11 px-4 rounded-xl text-xs"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Test Bot Dispatch</span>
          </LiquidButton>
        </div>
      </div>
    </div>
  );
}
