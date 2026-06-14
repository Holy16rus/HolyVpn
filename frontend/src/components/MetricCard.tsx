import { useEffect, useRef, useState } from 'react';
import { clsx } from '../lib/utils';

function AnimatedNumber({ value, label, accent = false }: { value: number; label: string; accent?: boolean }) {
  const [display, setDisplay] = useState(0);
  const animRef = useRef<number>(0);
  const startRef = useRef(0);
  const startValRef = useRef(0);

  useEffect(() => {
    if (startRef.current === 0) {
      setDisplay(value);
      startRef.current = Date.now();
      return;
    }
    startValRef.current = display;
    startRef.current = Date.now();
    const duration = 500;

    const animate = () => {
      const elapsed = Date.now() - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValRef.current + (value - startValRef.current) * eased);
      setDisplay(current);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [value]);

  return (
    <div className={clsx(
      'text-center p-3 rounded-xl border transition-all duration-300',
      accent ? 'bg-accent/10 border-accent/30' : 'bg-black/30 border-[var(--color-border)]'
    )}>
      <div className={clsx(
        'text-2xl font-bold leading-none mb-1',
        accent ? 'text-accent' : 'text-text-primary'
      )}>
        {display}
      </div>
      <div className="text-xs text-text-secondary uppercase tracking-wider">{label}</div>
    </div>
  );
}

export function MetricsPanel({ metrics }: { metrics: Record<string, number> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <AnimatedNumber value={metrics.candidates || 0} label="Кандидатов" />
      <AnimatedNumber value={metrics.deduped || 0} label="После дедупа" />
      <AnimatedNumber value={metrics.live || 0} label="Живых" accent />
      <AnimatedNumber value={metrics.ping_checked || 0} label="Пинг" accent />
      <AnimatedNumber value={metrics.selected || 0} label="В конфиге" accent />
      <AnimatedNumber value={metrics.countries || 0} label="Стран" />
    </div>
  );
}

export function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.min((current / total) * 100, 100) : 0;

  return (
    <div className="w-full bg-black/30 rounded-full h-2 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-accent to-accent-dark transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
