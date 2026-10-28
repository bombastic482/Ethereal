/**
 * Renders a shareable progress card (1080×1350, Instagram-portrait) on a canvas:
 * headline, trend chart, three stats. Nothing leaves the device unless the user shares it.
 */
import type { TrendPoint } from './calc/trend';

export interface ShareCardInput {
  title: string; // e.g. "4.2 kg down"
  subtitle: string; // e.g. "in 6 weeks · Ethereal"
  points: TrendPoint[];
  stats: Array<[label: string, value: string]>;
  unit: string;
  dark?: boolean;
}

export function renderShareCard(input: ShareCardInput): HTMLCanvasElement {
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const dark = input.dark ?? false;
  const bg = dark ? '#1c1916' : '#f7f4ee';
  const fg = dark ? '#f3efe7' : '#2a2520';
  const muted = dark ? '#b7ae9f' : '#6b6259';
  const moss = '#4f8a62';
  const apricot = '#e8a06a';

  // background + grain-ish gradient
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, bg);
  g.addColorStop(1, dark ? '#26211c' : '#efe9df');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.8, H * 0.15, 20, W * 0.8, H * 0.15, 500);
  glow.addColorStop(0, 'rgba(79,138,98,0.28)');
  glow.addColorStop(1, 'rgba(79,138,98,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // brand
  ctx.fillStyle = fg;
  ctx.font = '600 34px Inter, system-ui, sans-serif';
  ctx.fillText('Ethereal', 80, 110);
  ctx.fillStyle = muted;
  ctx.font = '500 28px Inter, system-ui, sans-serif';
  ctx.fillText(input.subtitle, 80, 160);

  // headline (serif)
  ctx.fillStyle = fg;
  ctx.font = '400 150px "Instrument Serif", Georgia, serif';
  ctx.fillText(input.title, 76, 330);

  // chart
  const x0 = 80;
  const x1 = W - 80;
  const y0 = 430;
  const y1 = 900;
  const pts = input.points;
  if (pts.length > 1) {
    const ys = pts.map((p) => p.trendKg);
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    const pad = Math.max(0.5, (max - min) * 0.15);
    const sy = (v: number) => y1 - ((v - (min - pad)) / (max + pad - (min - pad))) * (y1 - y0);
    const sx = (i: number) => x0 + (i / (pts.length - 1)) * (x1 - x0);
    // grid
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      const y = y0 + ((y1 - y0) * i) / 4;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
    }
    // area
    const area = ctx.createLinearGradient(0, y0, 0, y1);
    area.addColorStop(0, 'rgba(79,138,98,0.35)');
    area.addColorStop(1, 'rgba(79,138,98,0)');
    ctx.beginPath();
    ctx.moveTo(sx(0), sy(pts[0]!.trendKg));
    pts.forEach((p, i) => ctx.lineTo(sx(i), sy(p.trendKg)));
    ctx.lineTo(x1, y1);
    ctx.lineTo(x0, y1);
    ctx.closePath();
    ctx.fillStyle = area;
    ctx.fill();
    // dots
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)';
    pts.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(sx(i), sy(p.weightKg), 5, 0, Math.PI * 2);
      ctx.fill();
    });
    // line
    ctx.strokeStyle = moss;
    ctx.lineWidth = 8;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    pts.forEach((p, i) =>
      i ? ctx.lineTo(sx(i), sy(p.trendKg)) : ctx.moveTo(sx(i), sy(p.trendKg)),
    );
    ctx.stroke();
    // end marker
    const last = pts[pts.length - 1]!;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(sx(pts.length - 1), sy(last.trendKg), 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = apricot;
    ctx.lineWidth = 8;
    ctx.stroke();
    // axis labels
    ctx.fillStyle = muted;
    ctx.font = '500 24px Inter, system-ui, sans-serif';
    ctx.fillText(`${max.toFixed(1)} ${input.unit}`, x0, y0 - 14);
    ctx.fillText(`${min.toFixed(1)} ${input.unit}`, x0, y1 + 36);
  }

  // stats
  const colW = (W - 160) / Math.max(1, input.stats.length);
  input.stats.forEach(([label, value], i) => {
    const x = 80 + i * colW;
    ctx.fillStyle = muted;
    ctx.font = '600 24px Inter, system-ui, sans-serif';
    ctx.fillText(label.toUpperCase(), x, 1030);
    ctx.fillStyle = fg;
    ctx.font = '400 72px "Instrument Serif", Georgia, serif';
    ctx.fillText(value, x, 1110);
  });

  // footer
  ctx.fillStyle = muted;
  ctx.font = '500 26px Inter, system-ui, sans-serif';
  ctx.fillText('Trend weight, not daily noise · free and private · no account', 80, 1270);
  return c;
}

export async function shareCanvas(
  canvas: HTMLCanvasElement,
  filename = 'ethereal-progress.png',
): Promise<'shared' | 'downloaded'> {
  const blob: Blob = await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'),
  );
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'My progress', text: 'Tracked with Ethereal' });
    return 'shared';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
