import { h, render } from 'preact';
import { useState, useRef } from 'preact/hooks';
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

function klTerms(p, q) {
  const terms = [];
  for (let i = 0; i < p.length; i++) {
    if (p[i] > 1e-12 && q[i] > 1e-12) {
      terms.push(p[i] * Math.log(p[i] / q[i]));
    } else {
      terms.push(0);
    }
  }
  return terms;
}

function makeDist(a, b) {
  const raw = [a, b, Math.max(0.01, 1 - a - b)];
  const sum = raw[0] + raw[1] + raw[2];
  return raw.map(v => v / sum);
}

const COL_P = '#2196F3';
const COL_Q = '#E91E63';
const COL_LOG = '#FF9800';

function Ch11Viz() {
  const colors = useThemeColors();
  const [p1, setP1] = useState(0.5);
  const [p2, setP2] = useState(0.3);
  const [q1, setQ1] = useState(0.2);
  const [q2, setQ2] = useState(0.5);

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const p = makeDist(p1, p2);
    const q = makeDist(q1, q2);
    const dpq = klDiv(p, q);
    const dqp = klDiv(q, p);
    const termsPQ = klTerms(p, q);
    const termsQP = klTerms(q, p);

    const barW = w * 0.35;
    const barH = h * 0.28;
    const gap = w * 0.08;
    const leftX = w / 2 - barW - gap / 2;
    const rightX = w / 2 + gap / 2;
    const topY = 50;
    const categories = ['x\u2081', 'x\u2082', 'x\u2083'];
    const catW = barW / 3;

    // Draw P distribution
    ctx.fillStyle = COL_P;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\uBD84\uD3EC P', leftX + barW / 2, topY - 10);

    for (let i = 0; i < 3; i++) {
      const x = leftX + i * catW + catW * 0.15;
      const bw = catW * 0.7;
      const bh = p[i] * barH;

      ctx.fillStyle = 'rgba(33,150,243,0.7)';
      ctx.fillRect(x, topY + barH - bh, bw, bh);
      ctx.strokeStyle = COL_P;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, topY + barH - bh, bw, bh);

      ctx.fillStyle = colors.fg;
      ctx.font = '12px sans-serif';
      ctx.fillText(categories[i], x + bw / 2, topY + barH + 16);
      ctx.fillStyle = COL_P;
      ctx.font = '11px monospace';
      ctx.fillText(p[i].toFixed(2), x + bw / 2, topY + barH - bh - 5);
    }

    // Draw Q distribution
    ctx.fillStyle = COL_Q;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('\uBD84\uD3EC Q', rightX + barW / 2, topY - 10);

    for (let i = 0; i < 3; i++) {
      const x = rightX + i * catW + catW * 0.15;
      const bw = catW * 0.7;
      const bh = q[i] * barH;

      ctx.fillStyle = 'rgba(233,30,99,0.7)';
      ctx.fillRect(x, topY + barH - bh, bw, bh);
      ctx.strokeStyle = COL_Q;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, topY + barH - bh, bw, bh);

      ctx.fillStyle = colors.fg;
      ctx.font = '12px sans-serif';
      ctx.fillText(categories[i], x + bw / 2, topY + barH + 16);
      ctx.fillStyle = COL_Q;
      ctx.font = '11px monospace';
      ctx.fillText(q[i].toFixed(2), x + bw / 2, topY + barH - bh - 5);
    }

    // --- Term-by-term breakdown ---
    const divY = topY + barH + 40;
    ctx.textAlign = 'left';

    // D(P||Q) formula header
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = COL_P;
    const headerPQ = 'D(P\u2016Q)';
    ctx.fillText(headerPQ, 12, divY);
    ctx.fillStyle = colors.fg;
    ctx.fillText(` = \u03A3 p\u1D62 log(p\u1D62/q\u1D62)`, 12 + ctx.measureText(headerPQ).width, divY);

    // Per-element breakdown for D(P||Q)
    ctx.font = '12px monospace';
    let lineY = divY + 18;
    const subscripts = ['\u2081', '\u2082', '\u2083'];
    for (let i = 0; i < 3; i++) {
      let xOff = 20;
      const sign = i === 0 ? '  ' : '+ ';
      ctx.fillStyle = colors.fg;
      ctx.fillText(sign, xOff, lineY);
      xOff += ctx.measureText(sign).width;

      // p_i in blue
      ctx.fillStyle = COL_P;
      const pText = `${p[i].toFixed(2)}`;
      ctx.fillText(pText, xOff, lineY);
      xOff += ctx.measureText(pText).width;

      // log( in default
      ctx.fillStyle = colors.fg;
      ctx.fillText('\u00B7log(', xOff, lineY);
      xOff += ctx.measureText('\u00B7log(').width;

      // p_i/q_i ratio in orange
      ctx.fillStyle = COL_LOG;
      const ratio = p[i] / q[i];
      const ratioText = `${ratio.toFixed(2)}`;
      ctx.fillText(ratioText, xOff, lineY);
      xOff += ctx.measureText(ratioText).width;

      ctx.fillStyle = colors.fg;
      ctx.fillText(') = ', xOff, lineY);
      xOff += ctx.measureText(') = ').width;

      // Term value
      const termColor = termsPQ[i] >= 0 ? COL_P : COL_Q;
      ctx.fillStyle = termColor;
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`${termsPQ[i] >= 0 ? '+' : ''}${termsPQ[i].toFixed(4)}`, xOff, lineY);
      ctx.font = '12px monospace';

      lineY += 16;
    }

    // Total D(P||Q)
    ctx.fillStyle = COL_P;
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`= D(P\u2016Q) = ${dpq.toFixed(4)}`, 20, lineY + 2);

    // D(Q||P) formula header
    lineY += 24;
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = COL_Q;
    const headerQP = 'D(Q\u2016P)';
    ctx.fillText(headerQP, 12, lineY);
    ctx.fillStyle = colors.fg;
    ctx.fillText(` = \u03A3 q\u1D62 log(q\u1D62/p\u1D62)`, 12 + ctx.measureText(headerQP).width, lineY);

    // Per-element breakdown for D(Q||P)
    ctx.font = '12px monospace';
    lineY += 18;
    for (let i = 0; i < 3; i++) {
      let xOff = 20;
      const sign = i === 0 ? '  ' : '+ ';
      ctx.fillStyle = colors.fg;
      ctx.fillText(sign, xOff, lineY);
      xOff += ctx.measureText(sign).width;

      // q_i in pink
      ctx.fillStyle = COL_Q;
      const qText = `${q[i].toFixed(2)}`;
      ctx.fillText(qText, xOff, lineY);
      xOff += ctx.measureText(qText).width;

      // log( in default
      ctx.fillStyle = colors.fg;
      ctx.fillText('\u00B7log(', xOff, lineY);
      xOff += ctx.measureText('\u00B7log(').width;

      // q_i/p_i ratio in orange
      ctx.fillStyle = COL_LOG;
      const ratio = q[i] / p[i];
      const ratioText = `${ratio.toFixed(2)}`;
      ctx.fillText(ratioText, xOff, lineY);
      xOff += ctx.measureText(ratioText).width;

      ctx.fillStyle = colors.fg;
      ctx.fillText(') = ', xOff, lineY);
      xOff += ctx.measureText(') = ').width;

      // Term value - highlight the biggest difference
      const termColor = termsQP[i] >= 0 ? COL_Q : COL_P;
      ctx.fillStyle = termColor;
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`${termsQP[i] >= 0 ? '+' : ''}${termsQP[i].toFixed(4)}`, xOff, lineY);
      ctx.font = '12px monospace';

      lineY += 16;
    }

    // Total D(Q||P)
    ctx.fillStyle = COL_Q;
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`= D(Q\u2016P) = ${dqp.toFixed(4)}`, 20, lineY + 2);

    // Asymmetry highlight
    lineY += 24;
    ctx.fillStyle = colors.fg;
    ctx.font = 'bold 13px sans-serif';
    if (dpq > 0.001 && dqp > 0.001) {
      const ratioVal = (dpq / dqp).toFixed(2);
      ctx.fillText(`\uBE44\uB300\uCE6D: D(P\u2016Q) / D(Q\u2016P) = ${ratioVal}`, 12, lineY);
      ctx.fillStyle = colors.fgMuted;
      ctx.font = '12px sans-serif';
      ctx.fillText('log(p/q) \u2260 log(q/p) \u2192 KL \uBC1C\uC0B0\uC740 \uBE44\uB300\uCE6D', 12, lineY + 18);
    }

    ctx.textAlign = 'left';
  };

  const canvasRef = useCanvas(drawRef);

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
