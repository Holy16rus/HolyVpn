export function clsx(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

export function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() / 1000 - ts));
  if (secs < 5) return 'только что';
  if (secs < 60) return `${secs}с назад`;
  if (secs < 3600) return `${Math.floor(secs / 60)}м назад`;
  return `${Math.floor(secs / 3600)}ч назад`;
}
