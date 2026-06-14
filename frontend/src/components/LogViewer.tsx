import { useEffect, useRef } from 'react';
import { clsx } from '../lib/utils';

interface LogEntry {
  text: string;
  level?: string;
  time: number;
}

export function LogViewer({ logs }: { logs: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  return (
    <div className="neon-card bg-[var(--color-bg-card)] backdrop-blur rounded-2xl border border-[var(--color-border)] p-5">
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 m-0">
        <span className="w-1 h-5 bg-gradient-to-b from-accent to-amber rounded-full inline-block" />
        Живой лог
      </h2>

      <div className="bg-black/50 rounded-xl p-4 max-h-[300px] overflow-y-auto font-['JetBrains_Mono',monospace] text-xs leading-relaxed">
        {logs.length === 0 && (
          <div className="text-text-secondary/50 text-center py-8">
            Ожидание данных...
          </div>
        )}
        {logs.map((log, i) => (
          <div key={i} className={clsx(
            'py-0.5 border-b border-[rgba(255,36,72,0.055)] last:border-0',
            log.level === 'error' ? 'text-red' :
            log.level === 'warn' ? 'text-amber' :
            'text-text-secondary'
          )}>
            <span className="text-text-secondary/40 mr-2">
              {new Date(log.time * 1000).toLocaleTimeString()}
            </span>
            {log.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
