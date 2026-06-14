import { useState, useCallback, useEffect } from 'react';
import { Download } from 'lucide-react';
import { StatusHeader } from './components/StatusHeader';
import { MetricsPanel, ProgressBar } from './components/MetricCard';
import { ProxyGlobe } from './components/ProxyGlobe';
import { Controls, GenerateOptions } from './components/Controls';
import { SourcesPanel } from './components/SourcesPanel';
import { LinksCard } from './components/LinksCard';
import { LogViewer } from './components/LogViewer';
import { ProxySource, Metrics, EngineStatus, GlobePoint } from './types';
import { useSSE } from './hooks/useSSE';

const API_BASE = '/api';

interface LogEntry {
  text: string;
  level?: string;
  time: number;
}

export default function App() {
  const [sources, setSources] = useState<ProxySource[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    total_sources: 0, current_source: 0, candidates: 0, deduped: 0,
    checking_progress: 0, checking_total: 0, live: 0, geo_checked: 0,
    ping_checked: 0, selected: 0, countries: 0,
  });
  const [status, setStatus] = useState<EngineStatus>('idle');
  const [statusMsg, setStatusMsg] = useState('Ожидание');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [geoPoints, setGeoPoints] = useState<GlobePoint[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/config`)
      .then((r) => r.json())
      .then((cfg) => setSources(cfg.sources || []))
      .catch(() => {});
  }, []);

  const handleStatus = useCallback((data: Record<string, unknown>) => {
    const s = data.status as EngineStatus;
    setStatus(s);
    setStatusMsg((data.message as string) || '');
    setIsRunning(s === 'running');
  }, []);

  const handleMetrics = useCallback((data: Record<string, unknown>) => {
    setMetrics((prev) => ({ ...prev, ...data }));
  }, []);

  const handleLog = useCallback((data: Record<string, unknown>) => {
    setLogs((prev) => {
      const entry: LogEntry = {
        text: (data.text as string) || '',
        level: data.level as string,
        time: Date.now() / 1000,
      };
      const next = [...prev, entry];
      return next.slice(-200);
    });
  }, []);

  const handleGeoPoints = useCallback((data: Record<string, unknown>) => {
    const points = Array.isArray(data.points) ? data.points : [];
    setGeoPoints(points.filter((p): p is GlobePoint => {
      if (!p || typeof p !== 'object') return false;
      const point = p as Record<string, unknown>;
      return typeof point.lat === 'number' && typeof point.lon === 'number';
    }));
  }, []);

  const handleError = useCallback(() => {
    setStatus('error');
    setStatusMsg('Потеря соединения с сервером');
  }, []);

  useSSE(`${API_BASE}/stream`, {
    status: handleStatus,
    metrics: handleMetrics,
    log: handleLog,
    geo_points: handleGeoPoints,
    error: handleError,
    __error: handleError,
  });

  const startGenerate = async (opts: GenerateOptions) => {
    setLogs([]);
    setGeoPoints([]);
    setMetrics({
      total_sources: 0, current_source: 0, candidates: 0, deduped: 0,
      checking_progress: 0, checking_total: 0, live: 0, geo_checked: 0,
      ping_checked: 0, selected: 0, countries: 0,
    });

    try {
      await fetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources }),
      });

      const resp = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: opts.limit,
          max_checks: opts.maxChecks,
          timeout: opts.timeout,
          selection: opts.selection,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        setStatus('error');
        setStatusMsg(err.detail || 'Ошибка запуска');
      }
    } catch (e) {
      setStatus('error');
      setStatusMsg(String(e));
    }
  };

  const cancelGenerate = async () => {
    await fetch(`${API_BASE}/cancel`, { method: 'POST' });
  };

  const saveSources = async () => {
    await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources }),
    });
  };

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,36,72,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,36,72,0.035) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
        <StatusHeader status={status} message={statusMsg} />

        <LinksCard />

        <div className="space-y-4">
          <Controls
            onGenerate={startGenerate}
            onCancel={cancelGenerate}
            isRunning={isRunning}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="neon-card bg-[var(--color-bg-card)] backdrop-blur rounded-2xl border border-[var(--color-border)] p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2 m-0">
                  <span className="w-1 h-5 bg-gradient-to-b from-accent to-amber rounded-full inline-block" />
                  Статус проверки
                </h2>
                <a href="/api/download"
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all
                    bg-white/10 text-text-primary border border-[var(--color-border)]
                    hover:bg-white/15 hover:scale-[1.02] no-underline inline-block flex items-center gap-1.5"
                  target="_blank"
                >
                  <Download className="w-3.5 h-3.5" />
                  Скачать
                </a>
              </div>
              <MetricsPanel metrics={metrics as unknown as Record<string, number>} />
              {metrics.checking_total > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-text-secondary mb-1">
                    <span>Проверка прокси</span>
                    <span>{metrics.checking_progress} / {metrics.checking_total}</span>
                  </div>
                  <ProgressBar current={metrics.checking_progress} total={metrics.checking_total} />
                </div>
              )}
              <div className="mt-3 h-[300px]">
                <ProxyGlobe liveCount={metrics.live} isActive={isRunning} points={geoPoints} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <SourcesPanel
              sources={sources}
              onUpdate={setSources}
              onSave={saveSources}
            />
          </div>
        </div>

        <LogViewer logs={logs} />
      </div>
    </div>
  );
}
