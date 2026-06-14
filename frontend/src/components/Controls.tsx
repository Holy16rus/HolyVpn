import { useState } from 'react';
import { Rocket, Square } from 'lucide-react';
import { clsx } from '../lib/utils';

interface ControlsProps {
  onGenerate: (opts: GenerateOptions) => void;
  onCancel: () => void;
  isRunning: boolean;
  disabled?: boolean;
}

export interface GenerateOptions {
  limit: number;
  maxChecks: number;
  timeout: number;
  selection: 'fastest' | 'balanced';
}

export function Controls({ onGenerate, onCancel, isRunning, disabled }: ControlsProps) {
  const [opts, setOpts] = useState<GenerateOptions>({
    limit: 500,
    maxChecks: 10000,
    timeout: 10,
    selection: 'fastest',
  });

  return (
    <div className="neon-card bg-[var(--color-bg-card)] backdrop-blur rounded-2xl border border-[var(--color-border)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2 m-0">
          <span className="w-1 h-5 bg-gradient-to-b from-accent to-amber rounded-full inline-block" />
          Сборка
        </h2>
        <div className="flex gap-2">
          {isRunning ? (
            <button onClick={onCancel}
              className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all flex items-center gap-1.5
                bg-red/20 text-red border border-red/30 hover:bg-red/30 hover:scale-[1.02]"
            >
              <Square className="w-4 h-4" />
              Остановить
            </button>
          ) : (
            <button onClick={() => onGenerate(opts)} disabled={disabled}
              className={clsx(
                'px-5 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all flex items-center gap-1.5',
                'bg-gradient-to-r from-accent to-accent-dark text-bg-dark',
                'shadow-[0_4px_18px_rgba(255,36,72,0.32)] hover:shadow-[0_6px_26px_rgba(255,36,72,0.46)]',
                'hover:scale-[1.02] active:scale-[0.98]',
                disabled && 'opacity-50 cursor-not-allowed hover:scale-100'
              )}
            >
              <Rocket className="w-4 h-4" />
              Запустить сборку
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-text-secondary mb-1">Лимит прокси</label>
          <input type="number" min={1} max={10000} value={opts.limit}
            onChange={(e) => setOpts({ ...opts, limit: Number(e.target.value) })}
            disabled={isRunning}
            className="w-full px-3 py-2 rounded-xl bg-black/40 border border-[var(--color-border)] text-sm text-text-primary
              focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(255,36,72,0.14)] disabled:opacity-40"
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Max checks</label>
          <input type="number" min={0} max={100000} value={opts.maxChecks}
            onChange={(e) => setOpts({ ...opts, maxChecks: Number(e.target.value) })}
            disabled={isRunning}
            className="w-full px-3 py-2 rounded-xl bg-black/40 border border-[var(--color-border)] text-sm text-text-primary
              focus:outline-none focus:border-accent disabled:opacity-40"
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Timeout (сек)</label>
          <input type="number" min={1} max={60} step={0.5} value={opts.timeout}
            onChange={(e) => setOpts({ ...opts, timeout: Number(e.target.value) })}
            disabled={isRunning}
            className="w-full px-3 py-2 rounded-xl bg-black/40 border border-[var(--color-border)] text-sm text-text-primary
              focus:outline-none focus:border-accent disabled:opacity-40"
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Отбор</label>
          <select value={opts.selection}
            onChange={(e) => setOpts({ ...opts, selection: e.target.value as 'fastest' | 'balanced' })}
            disabled={isRunning}
            className="w-full px-3 py-2 rounded-xl bg-black/40 border border-[var(--color-border)] text-sm text-text-primary
              focus:outline-none focus:border-accent disabled:opacity-40"
          >
            <option value="fastest">Самые быстрые</option>
            <option value="balanced">Сбалансировано</option>
          </select>
        </div>
      </div>
    </div>
  );
}
