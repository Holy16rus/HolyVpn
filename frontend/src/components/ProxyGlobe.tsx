import { useEffect, useRef, useState } from 'react';
import { geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import { GlobePoint } from '../types';

type GeoShape = any;
type EarthShapes = { land: GeoShape; countryLines: GeoShape; grid: GeoShape };

export function ProxyGlobe({
  liveCount = 0,
  isActive = false,
  points = [],
}: {
  liveCount?: number;
  isActive?: boolean;
  points?: GlobePoint[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef(20);
  const animRef = useRef(0);
  const [size, setSize] = useState({ w: 400, h: 400 });
  const [earth, setEarth] = useState<EarthShapes | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import('world-atlas/land-50m.json'),
      import('world-atlas/countries-50m.json'),
    ]).then(([landModule, countriesModule]) => {
      if (cancelled) return;
      const landTopo = landModule.default as any;
      const countriesTopo = countriesModule.default as any;
      setEarth({
        land: feature(landTopo, landTopo.objects.land) as GeoShape,
        countryLines: mesh(countriesTopo, countriesTopo.objects.countries, (a: unknown, b: unknown) => a !== b) as GeoShape,
        grid: geoGraticule10() as GeoShape,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(size.w * dpr));
    canvas.height = Math.max(1, Math.floor(size.h * dpr));
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size.w / 2;
    const cy = size.h / 2;
    const R = Math.min(size.w, size.h) * 0.405;
    const projection = geoOrthographic()
      .translate([cx, cy])
      .scale(R)
      .clipAngle(90)
      .precision(0.4);
    const path = geoPath(projection, ctx);

    let lastTime = 0;

    const render = (timestamp: number) => {
      const delta = lastTime ? timestamp - lastTime : 16;
      lastTime = timestamp;
      rotationRef.current = (rotationRef.current + delta * (isActive ? 0.017 : 0.0065)) % 360;

      projection.rotate([rotationRef.current, -8, -6]);
      ctx.clearRect(0, 0, size.w, size.h);

      drawBackdrop(ctx, cx, cy, R, isActive);
      drawSphere(ctx, cx, cy, R);

      ctx.save();
      ctx.beginPath();
      path({ type: 'Sphere' } as GeoShape);
      ctx.clip();

      drawWaterTexture(ctx, cx, cy, R, timestamp);
      if (earth) {
        drawShape(ctx, path, earth.grid, 'rgba(255,50,72,0.18)', 0.45);
        drawShape(ctx, path, earth.land, 'rgba(255,31,54,0.18)', 1.1, 'rgba(55,7,13,0.78)');
        drawShape(ctx, path, earth.countryLines, 'rgba(255,118,132,0.18)', 0.45);
      }
      drawProxyPoints(ctx, projection, points, R, isActive, timestamp);

      ctx.restore();

      drawTerminator(ctx, cx, cy, R);
      drawRim(ctx, cx, cy, R, isActive);
      drawOrbitRings(ctx, cx, cy, R, rotationRef.current, isActive);

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [earth, isActive, points, size]);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[280px] overflow-hidden rounded-[1.75rem]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,24,54,0.12),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]" />
      <canvas ref={canvasRef} className="relative z-10 w-full h-full" />
      <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
        <div className="text-center px-5 py-4 rounded-2xl border border-red-400/15 bg-black/20 backdrop-blur-[2px] shadow-[0_0_60px_rgba(255,24,54,0.22)]">
          <div
            style={{
              fontSize: 'clamp(1.85rem, 5vw, 3rem)',
              fontWeight: 900,
              color: '#ff2448',
              textShadow: '0 0 16px rgba(255,36,72,0.95), 0 0 42px rgba(255,36,72,0.45)',
              letterSpacing: '-0.04em',
              lineHeight: 0.95,
            }}
          >
            {liveCount}
          </div>
          <div
            style={{
              fontSize: '0.66rem',
              color: 'rgba(255,177,185,0.82)',
              letterSpacing: '0.34em',
              textTransform: 'uppercase',
              marginTop: 7,
            }}
          >
            Live Nodes
          </div>
        </div>
      </div>
    </div>
  );
}

function drawBackdrop(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, isActive: boolean) {
  const pulse = isActive ? 1 : 0.6;
  const halo = ctx.createRadialGradient(cx, cy, R * 0.75, cx, cy, R * 1.72);
  halo.addColorStop(0, `rgba(255,24,54,${0.24 * pulse})`);
  halo.addColorStop(0.46, `rgba(255,24,54,${0.085 * pulse})`);
  halo.addColorStop(1, 'rgba(255,24,54,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.72, 0, Math.PI * 2);
  ctx.fillStyle = halo;
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.18);
  ctx.strokeStyle = 'rgba(255,24,54,0.08)';
  ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.ellipse(0, i * R * 0.18, R * 1.22, R * 0.22, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSphere(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number) {
  const ocean = ctx.createRadialGradient(cx - R * 0.38, cy - R * 0.42, R * 0.04, cx, cy, R);
  ocean.addColorStop(0, '#41101b');
  ocean.addColorStop(0.34, '#210914');
  ocean.addColorStop(0.72, '#09040a');
  ocean.addColorStop(1, '#020105');
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = ocean;
  ctx.fill();
}

function drawWaterTexture(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, timestamp: number) {
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = 'rgba(255,82,101,0.08)';
  ctx.lineWidth = 0.55;
  const drift = (timestamp * 0.012) % 28;
  for (let y = cy - R; y <= cy + R; y += 14) {
    ctx.beginPath();
    for (let x = cx - R; x <= cx + R; x += 7) {
      const wave = Math.sin((x + drift) * 0.032 + y * 0.045) * 2.1;
      if (x === cx - R) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  path: ReturnType<typeof geoPath>,
  shape: GeoShape,
  stroke: string,
  lineWidth: number,
  fill?: string,
) {
  ctx.beginPath();
  path(shape);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawProxyPoints(
  ctx: CanvasRenderingContext2D,
  projection: ReturnType<typeof geoOrthographic>,
  points: GlobePoint[],
  R: number,
  isActive: boolean,
  timestamp: number,
) {
  const rotation = projection.rotate();
  const activeAlpha = isActive ? 1 : 0.76;

  for (const point of points) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
    if (!isVisible(point.lon, point.lat, rotation[0], rotation[1])) continue;

    const projected = projection([point.lon, point.lat]);
    if (!projected) continue;

    const [x, y] = projected;
    const latency = point.latency_ms ?? 900;
    const speed = Math.max(0, Math.min(1, (900 - latency) / 900));
    const pulse = 0.72 + Math.sin(timestamp * 0.006 + point.lon) * 0.28;
    const r = 2.2 + speed * 2.4;
    const glow = r * (5.2 + pulse * 1.8);

    const grd = ctx.createRadialGradient(x, y, 0, x, y, glow);
    grd.addColorStop(0, `rgba(255,235,239,${0.8 * activeAlpha})`);
    grd.addColorStop(0.22, `rgba(255,45,72,${0.46 * activeAlpha})`);
    grd.addColorStop(1, 'rgba(255,45,72,0)');
    ctx.beginPath();
    ctx.arc(x, y, glow, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd8df';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,31,54,0.95)';
    ctx.lineWidth = 1.15;
    ctx.stroke();
  }
}

function drawTerminator(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number) {
  const shade = ctx.createRadialGradient(cx + R * 0.28, cy + R * 0.2, R * 0.12, cx + R * 0.32, cy + R * 0.1, R * 1.08);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(0.58, 'rgba(0,0,0,0.08)');
  shade.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = shade;
  ctx.fill();

  const shine = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.48, 0, cx - R * 0.24, cy - R * 0.28, R * 0.74);
  shine.addColorStop(0, 'rgba(255,214,220,0.13)');
  shine.addColorStop(0.36, 'rgba(255,105,123,0.045)');
  shine.addColorStop(1, 'rgba(255,105,123,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = shine;
  ctx.fill();
}

function drawRim(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, isActive: boolean) {
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = isActive ? 'rgba(255,70,92,0.82)' : 'rgba(255,70,92,0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, R + 3, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,24,54,0.2)';
  ctx.lineWidth = 7;
  ctx.stroke();
}

function drawOrbitRings(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, rot: number, isActive: boolean) {
  const alpha = isActive ? 1 : 0.46;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.scale(1, 0.28);
  ctx.beginPath();
  ctx.arc(0, 0, R + 12, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,31,54,${0.34 * alpha})`;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([5, 11]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-rot * 0.72 * Math.PI) / 180);
  ctx.scale(0.24, 1);
  ctx.beginPath();
  ctx.arc(0, 0, R + 18, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,31,54,${0.16 * alpha})`;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 15]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function isVisible(lon: number, lat: number, rotateLon: number, rotateLat: number) {
  const lambda = ((lon + rotateLon) * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const phi0 = (rotateLat * Math.PI) / 180;
  return Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lambda) > 0;
}
