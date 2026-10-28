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
  const bg = dark ? '#14171c' : '#ffffff';
  const fg = dark ? '#f2f4f7' : '#1c2028';
  const muted = dark ? '#aab1bd' : '#656d7a';
  const moss = '#15996b';
  const apricot = '#f0a84a';

  // background + grain-ish gradient
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, bg);
  g.addColorStop(1, dark ? '#1b1f26' : '#f1f3f6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.8, H * 0.15, 20, W * 0.8, H * 0.15, 500);
  glow.addColorStop(0, 'rgba(79,138,98,0.28)');
  glow.addColorStop(1, 'rgba(79,138,98,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // brand
  ctx.fillStyle = fg;
  ctx.font = '600 34px "Manrope Variable", Manrope, system-ui, sans-serif';
  ctx.fillText('Ethereal', 80, 110);
  ctx.fillStyle = muted;
  ctx.font = '500 28px "Manrope Variable", Manrope, system-ui, sans-serif';
  ctx.fillText(input.subtitle, 80, 160);

  // headline
  ctx.fillStyle = fg;
  ctx.font = '800 128px "Manrope Variable", Manrope, system-ui, sans-serif';
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
    ctx.font = '500 24px "Manrope Variable", Manrope, system-ui, sans-serif';
    ctx.fillText(`${max.toFixed(1)} ${input.unit}`, x0, y0 - 14);
    ctx.fillText(`${min.toFixed(1)} ${input.unit}`, x0, y1 + 36);
  }

  // stats
  const colW = (W - 160) / Math.max(1, input.stats.length);
  input.stats.forEach(([label, value], i) => {
    const x = 80 + i * colW;
    ctx.fillStyle = muted;
    ctx.font = '600 24px "Manrope Variable", Manrope, system-ui, sans-serif';
    ctx.fillText(label.toUpperCase(), x, 1030);
    ctx.fillStyle = fg;
    ctx.font = '800 64px "Manrope Variable", Manrope, system-ui, sans-serif';
    ctx.fillText(value, x, 1110);
  });

  // footer
  ctx.fillStyle = muted;
  ctx.font = '500 26px "Manrope Variable", Manrope, system-ui, sans-serif';
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

export interface WeekCardInput {
  title: string; // e.g. "Week of 22–28 Oct"
  subtitle: string; // e.g. "5 of 7 days logged · Ethereal"
  /** Seven days in order; kcal 0 means not logged. */
  days: Array<{ label: string; kcal: number; targetKcal: number }>;
  stats: Array<[label: string, value: string]>;
  dark?: boolean;
}

/** Shareable week card (1080×1350): seven calorie bars against the target, plus three stats. */
export function renderWeekCard(input: WeekCardInput): HTMLCanvasElement {
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const dark = input.dark ?? false;
  const bg = dark ? '#14171c' : '#ffffff';
  const fg = dark ? '#f2f4f7' : '#1c2028';
  const muted = dark ? '#aab1bd' : '#656d7a';
  const moss = '#15996b';
  const apricot = '#f0a84a';
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, bg);
  grad.addColorStop(1, dark ? '#1b1f26' : '#f1f3f6');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // wordmark
  ctx.fillStyle = moss;
  ctx.beginPath();
  ctx.roundRect(80, 80, 56, 56, 16);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.font = '700 40px "Manrope Variable", Manrope, system-ui, sans-serif';
  ctx.fillText('Ethereal', 156, 124);

  ctx.fillStyle = muted;
  ctx.font = '600 28px "Manrope Variable", Manrope, system-ui, sans-serif';
  ctx.fillText(input.subtitle.toUpperCase(), 80, 230);
  ctx.fillStyle = fg;
  ctx.font = '800 96px "Manrope Variable", Manrope, system-ui, sans-serif';
  ctx.fillText(input.title, 80, 340);

  // bars
  const x0 = 80;
  const x1 = W - 80;
  const y0 = 430;
  const y1 = 900;
  const n = input.days.length;
  const gap = 18;
  const bw = (x1 - x0 - gap * (n - 1)) / n;
  const max = Math.max(...input.days.map((d) => Math.max(d.kcal, d.targetKcal))) * 1.1 || 1;
  const sy = (v: number) => y1 - ((y1 - y0) * v) / max;
  // target line
  const target = input.days[0]?.targetKcal ?? 0;
  if (target > 0) {
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)';
    ctx.setLineDash([12, 12]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0, sy(target));
    ctx.lineTo(x1, sy(target));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = muted;
    ctx.font = '600 22px "Manrope Variable", Manrope, system-ui, sans-serif';
    ctx.fillText(`TARGET ${Math.round(target).toLocaleString('en-US')}`, x0, sy(target) - 12);
  }
  input.days.forEach((d, i) => {
    const x = x0 + i * (bw + gap);
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    ctx.beginPath();
    ctx.roundRect(x, y0, bw, y1 - y0, 14);
    ctx.fill();
    if (d.kcal > 0) {
      const over = d.targetKcal > 0 && d.kcal > d.targetKcal * 1.1;
      ctx.fillStyle = over ? apricot : moss;
      ctx.beginPath();
      ctx.roundRect(x, sy(d.kcal), bw, y1 - sy(d.kcal), 14);
      ctx.fill();
      ctx.fillStyle = fg;
      ctx.font = '700 26px "Manrope Variable", Manrope, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(d.kcal).toLocaleString('en-US'), x + bw / 2, sy(d.kcal) - 14);
    }
    ctx.fillStyle = muted;
    ctx.font = '600 24px "Manrope Variable", Manrope, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.label.toUpperCase(), x + bw / 2, y1 + 40);
    ctx.textAlign = 'left';
  });

  // stats
  const colW = (W - 160) / Math.max(1, input.stats.length);
  input.stats.forEach(([label, value], i) => {
    const x = 80 + i * colW;
    ctx.fillStyle = muted;
    ctx.font = '600 24px "Manrope Variable", Manrope, system-ui, sans-serif';
    ctx.fillText(label.toUpperCase(), x, 1040);
    ctx.fillStyle = fg;
    ctx.font = '800 64px "Manrope Variable", Manrope, system-ui, sans-serif';
    ctx.fillText(value, x, 1120);
  });

  ctx.fillStyle = muted;
  ctx.font = '500 26px "Manrope Variable", Manrope, system-ui, sans-serif';
  ctx.fillText('Logged with Ethereal · free and private · no account', 80, 1270);
  return c;
}
