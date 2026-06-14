import { useState } from 'react';
import { Link, Copy, Download } from 'lucide-react';

export function LinksCard() {
  const subUrl = `${window.location.protocol}//${window.location.host}/sub`;
  const [copiedSub, setCopiedSub] = useState(false);
  const [copiedFile, setCopiedFile] = useState(false);

  const copyToClipboard = async (text: string, setter: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch {}
  };

  return (
    <div className="neon-card bg-[var(--color-bg-card)] backdrop-blur rounded-2xl border border-[var(--color-border)] p-5">
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 m-0">
        <Link className="w-5 h-5 text-accent" />
        Ссылки для подключения
      </h2>

      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-[var(--color-border)]">
          <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
            <Copy className="w-4 h-4 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-text-secondary mb-0.5">Подписка для FLClash / Clash</div>
            <div className="text-sm font-mono text-accent truncate">{subUrl}</div>
          </div>
          <button onClick={() => copyToClipboard(subUrl, setCopiedSub)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0
              bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 hover:scale-[1.02]"
          >
            {copiedSub ? '✓ Скопировано' : 'Копировать'}
          </button>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-[var(--color-border)]">
          <div className="w-9 h-9 rounded-lg bg-amber/15 flex items-center justify-center shrink-0">
            <Download className="w-4 h-4 text-amber" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-text-secondary mb-0.5">YAML конфиг файл</div>
            <div className="text-sm font-mono text-amber truncate">/api/download</div>
          </div>
          <a href="/api/download" target="_blank"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 no-underline inline-block
              bg-amber/10 text-amber border border-amber/30 hover:bg-amber/20 hover:scale-[1.02]"
          >
            Скачать
          </a>
        </div>
      </div>
    </div>
  );
}
