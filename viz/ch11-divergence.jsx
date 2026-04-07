import { h, render } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { useCanvas } from './shared/canvas-utils.jsx';
import { Slider } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';

function klDiv(p, q) {
  let d = 0;
  for (let i = 0; i < p.length; i++) {
    if (p[i] > 1e-12 && q[i] > 1e-12) d += p[i] * Math.log(p[i] / q[i]);
  }
  return d;
}

function makeDist(a, b) {
  const raw = [a, b, Math.max(0.01, 1 - a - b)];
  const sum = raw[0] + raw[1] + raw[2];
  return raw.map(v => v / sum);
}

function Ch11Viz() {
  const colors = useThemeColors();
  const [p1, setP1] = useState(0.5);
  const [p2, setP2] = useState(0.3);
  const [q1, setQ1] = useState(0.2);
  const [q2, setQ2] = useState(0.5);

  const draw = useCallback((ctx, w, h) => {
    const p = makeDist(p1, p2);
    const q = makeDist(q1, q2);
    const dpq = klDiv(p, q);
    const dqp = klDiv(q, p);

    const barW = w * 0.35;
    const barH = h * 0.45;
    const gap = w * 0.08;
    const leftX = w / 2 - barW - gap / 2;
    const rightX = w / 2 + gap / 2;
    const topY = 60;
    const categories = ['x₁', 'x₂', 'x₃'];
    const catW = barW / 3;

    // Draw P distribution
    ctx.fillStyle = colors.fg;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('분포 P', leftX + barW / 2, topY - 10);

    for (let i = 0; i < 3; i++) {
      const x = leftX + i * catW + catW * 0.15;
      const bw = catW * 0.7;
      const bh = p[i] * barH;

      ctx.fillStyle = 'rgba(33,150,243,0.7)';
      ctx.fillRect(x, topY + barH - bh, bw, bh);
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, topY + barH - bh, bw, bh);

      ctx.fillStyle = colors.fg;
      ctx.font = '12px sans-serif';
      ctx.fillText(categories[i], x + bw / 2, topY + barH + 16);
      ctx.fillText(p[i].toFixed(2), x + bw / 2, topY + barH - bh - 5);
    }

    // Draw Q distribution
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('분포 Q', rightX + barW / 2, topY - 10);

    for (let i = 0; i < 3; i++) {
      const x = rightX + i * catW + catW * 0.15;
      const bw = catW * 0.7;
      const bh = q[i] * barH;

      ctx.fillStyle = 'rgba(233,30,99,0.7)';
      ctx.fillRect(x, topY + barH - bh, bw, bh);
      ctx.strokeStyle = '#E91E63';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, topY + barH - bh, bw, bh);

      ctx.fillStyle = colors.fg;
      ctx.font = '12px sans-serif';
      ctx.fillText(categories[i], x + bw / 2, topY + barH + 16);
      ctx.fillText(q[i].toFixed(2), x + bw / 2, topY + barH - bh - 5);
    }

    // KL divergence display
    const divY = topY + barH + 50;
    const maxDiv = Math.max(dpq, dqp, 0.01);
    const divBarMax = w * 0.35;

    ctx.textAlign = 'left';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = colors.fg;
    ctx.fillText('KL 발산 (비대칭!)', 12, divY);

    // D(P||Q) bar
    ctx.fillStyle = colors.accent;
    ctx.font = '13px sans-serif';
    ctx.fillText(`D(P‖Q) = ${dpq.toFixed(4)}`, 12, divY + 28);
    const bar1W = (dpq / (maxDiv * 1.2)) * divBarMax;
    ctx.fillStyle = 'rgba(33,150,243,0.6)';
    ctx.fillRect(180, divY + 16, bar1W, 16);

    // D(Q||P) bar
    ctx.fillStyle = '#E91E63';
    ctx.font = '13px sans-serif';
    ctx.fillText(`D(Q‖P) = ${dqp.toFixed(4)}`, 12, divY + 56);
    const bar2W = (dqp / (maxDiv * 1.2)) * divBarMax;
    ctx.fillStyle = 'rgba(233,30,99,0.6)';
    ctx.fillRect(180, divY + 44, bar2W, 16);

    // Ratio
    if (dpq > 0.001 && dqp > 0.001) {
      ctx.fillStyle = colors.fgMuted;
      ctx.font = '12px sans-serif';
      ctx.fillText(
        `비율: D(P‖Q) / D(Q‖P) = ${(dpq / dqp).toFixed(2)}`,
        12, divY + 80
      );
    }

    ctx.textAlign = 'left';
  }, [p1, p2, q1, q2, colors]);

  const canvasRef = useCanvas(draw, [draw]);

  return (
    <div class="viz-inner">
      <canvas ref={canvasRef} />
      <div class="viz-controls">
        <Slider label="P₁" min={0.05} max={0.9} step={0.01} value={p1} onChange={setP1} />
        <Slider label="P₂" min={0.05} max={0.9} step={0.01} value={p2} onChange={setP2} />
        <Slider label="Q₁" min={0.05} max={0.9} step={0.01} value={q1} onChange={setQ1} />
        <Slider label="Q₂" min={0.05} max={0.9} step={0.01} value={q2} onChange={setQ2} />
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch11Viz />, el); }
