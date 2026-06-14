import { useState } from 'react';
import { Save, Plus, X } from 'lucide-react';
import { ProxySource } from '../types';

interface SourcesPanelProps {
  sources: ProxySource[];
  onUpdate: (sources: ProxySource[]) => void;
  onSave: () => void;
}

export function SourcesPanel({ sources, onUpdate, onSave }: SourcesPanelProps) {
  const [newUrl, setNewUrl] = useState('');

  const addSource = () => {
    const url = newUrl.trim();
    if (!url) return;
    if (sources.some((s) => s.url === url)) return;
    onUpdate([...sources, { url, enabled: true }]);
    setNewUrl('');
  };

  const removeSource = (index: number) => {
    onUpdate(sources.filter((_, i) => i !== index));
  };

  const toggleSource = (index: number) => {
    onUpdate(sources.map((s, i) => i === index ? { ...s, enabled: !s.enabled } : s));
  };

  return (
    <div className="neon-card bg-[var(--color-bg-card)] backdrop-blur rounded-2xl border border-[var(--color-border)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2 m-0">
          <span className="w-1 h-5 bg-gradient-to-b from-accent to-amber rounded-full inline-block" />
          Источники
        </h2>
          <button onClick={onSave}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center gap-1
            bg-white/10 text-text-primary border border-[var(--color-border)]
            hover:bg-white/15 hover:scale-[1.02]"
        >
          <Save className="w-3.5 h-3.5" />
          Сохранить
        </button>
      </div>

      <div className="flex gap-2 mb-3">
        <input type="url" value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addSource()}
          placeholder="https://github.com/... или raw ссылка"
          className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-[var(--color-border)] text-sm text-text-primary
            focus:outline-none focus:border-accent placeholder:text-text-secondary/50"
        />
        <button onClick={addSource}
          className="px-3 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all flex items-center gap-1
            bg-gradient-to-r from-accent to-accent-dark text-bg-dark
            hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          Добавить
        </button>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {sources.length === 0 && (
          <div className="text-center py-8 text-text-secondary text-sm">
            Нет источников. Добавьте ссылку на GitHub или API.
          </div>
        )}
        {sources.map((source, i) => (
          <div key={i}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/30 border border-[var(--color-border)]
              hover:border-[var(--color-border-glow)] transition-all group"
          >
            <input type="checkbox" checked={source.enabled}
              onChange={() => toggleSource(i)}
              className="w-4 h-4 accent-accent cursor-pointer"
            />
            <span className="flex-1 text-sm truncate text-text-secondary group-hover:text-text-primary transition-colors">
              {source.url}
            </span>
            <button onClick={() => removeSource(i)}
              className="p-1 rounded-lg text-red/60 hover:text-red hover:bg-red/10 transition-all opacity-0 group-hover:opacity-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
