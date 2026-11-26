import { Check, Copy, Send, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TelegramContextInfo, Track } from '../types/music';
import { buildBotSyncPayload, sendPayloadToTelegramBot } from '../utils/telegramBridge';
import { LiquidButton } from './LiquidSurface';

interface BotBridgeModalProps {
  isOpen: boolean;
  telegramContext: TelegramContextInfo;
  currentTrack: Track;
  isPlaying: boolean;
  progress: number;
  onClose: () => void;
}

export function BotBridgeModal({
  isOpen,
  telegramContext,
  currentTrack,
  isPlaying,
  progress,
  onClose,
}: BotBridgeModalProps) {
  const [copied, setCopied] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

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
        : 'Preview mode active — ready to connect via BotFather WebApp URL.'
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
      <div className="w-full max-w-lg liquid-glass-elevated rounded-3xl p-6 sm:p-7 space-y-5 relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="bot-bridge-title" className="font-display text-xl font-semibold text-white">
              Telegram Bot Bridge
            </h2>
            <p className="text-xs text-slate-300 mt-1 font-mono-tabular">
              Environment: {telegramContext.platform} · Session: {telegramContext.userName}
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

        <p className="text-sm text-slate-200 leading-relaxed">
          This layout is structured for Telegram Mini Apps. When you link your Python bot via
          BotFather, Ondine automatically reads <code className="text-sky-200">Telegram.WebApp</code>{' '}
          theme/haptics and sends structured playback events like the payload below.
        </p>

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
