import { clsx } from '../lib/utils';
import { EngineStatus } from '../types';

const statusConfig: Record<EngineStatus, { label: string; color: string }> = {
  idle: { label: 'Ожидание', color: 'bg-accent' },
  running: { label: 'Сборка...', color: 'bg-accent animate-pulse' },
  done: { label: 'Готово', color: 'bg-amber' },
  error: { label: 'Ошибка', color: 'bg-red' },
  cancelled: { label: 'Отменено', color: 'bg-amber' },
};

export function StatusHeader({ status, message }: { status: EngineStatus; message?: string }) {
  const cfg = statusConfig[status] || statusConfig.idle;

  return (
    <div className="neon-card bg-[var(--color-bg-card)] backdrop-blur rounded-2xl border border-[var(--color-border)] p-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-4xl font-extrabold m-0 bg-gradient-to-r from-text-primary to-accent bg-clip-text text-transparent">
              HolyVPN
            </h1>
            <span className="text-xs text-text-secondary bg-black/30 px-2 py-0.5 rounded-full">v2</span>
          </div>
          <p className="text-sm text-text-secondary m-0">
            Генератор быстрых прокси-подписок с проверкой и фильтрацией
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-black/30 rounded-xl px-4 py-2 border border-[var(--color-border)]">
            <div className={clsx('w-3 h-3 rounded-full', cfg.color)} />
            <div>
              <div className="text-sm font-semibold text-text-primary">{cfg.label}</div>
              {message && (
                <div className="text-xs text-text-secondary max-w-[300px] truncate">{message}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
