import { h, render } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { useCanvas } from './shared/canvas-utils.jsx';
import { Slider } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { lerp, clamp } from './shared/math.js';

// 2-simplex (probability simplex for 3 outcomes) in 2D
// Barycentric to Cartesian
function baryToCart(p, cx, cy, S) {
  // Equilateral triangle vertices
  const ax = cx, ay = cy - S * 0.9;
  const bx = cx - S * 0.8, by = cy + S * 0.5;
  const cxx = cx + S * 0.8, cyy = cy + S * 0.5;
  return {
    x: p[0] * ax + p[1] * bx + p[2] * cxx,
    y: p[0] * ay + p[1] * by + p[2] * cyy,
  };
}

// m-geodesic (mixture): linear interpolation in probability space
function mGeodesic(p, q, t) {
  return [
    lerp(p[0], q[0], t),
    lerp(p[1], q[1], t),
    lerp(p[2], q[2], t),
  ];
}

// e-geodesic (exponential): geometric interpolation + normalize
function eGeodesic(p, q, t) {
  const r = [
    Math.pow(p[0], 1 - t) * Math.pow(q[0], t),
    Math.pow(p[1], 1 - t) * Math.pow(q[1], t),
    Math.pow(p[2], 1 - t) * Math.pow(q[2], t),
  ];
  const sum = r[0] + r[1] + r[2];
  return [r[0] / sum, r[1] / sum, r[2] / sum];
}

// Alpha-geodesic: interpolates between m and e
function alphaGeodesic(p, q, t, alpha) {
  if (alpha <= -0.99) return mGeodesic(p, q, t);
  if (alpha >= 0.99) return eGeodesic(p, q, t);
  // General alpha-geodesic via alpha-representation
  const a = (1 - alpha) / 2;
  const f = (x, a) => a === 0 ? Math.log(x) : (Math.pow(x, a) - 1) / a;
  const fInv = (y, a) => a === 0 ? Math.exp(y) : Math.pow(a * y + 1, 1 / a);

  const fp = p.map(x => f(x, a));
  const fq = q.map(x => f(x, a));
  const ft = fp.map((v, i) => lerp(v, fq[i], t));
  const r = ft.map(v => fInv(v, a));
  const sum = r[0] + r[1] + r[2];
  return [r[0] / sum, r[1] / sum, r[2] / sum];
}

function Ch10Viz() {
  const colors = useThemeColors();
  const [alpha, setAlpha] = useState(0);

  const p = [0.6, 0.3, 0.1];
  const q = [0.1, 0.2, 0.7];

  const draw = useCallback((ctx, w, h) => {
    const cx = w / 2, cy = h / 2 + 10;
    const S = Math.min(w, h) * 0.4;

    // Draw simplex triangle
    const verts = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(v => baryToCart(v, cx, cy, S));
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    verts.slice(1).forEach(v => ctx.lineTo(v.x, v.y));
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = colors.bgCode || colors.bg;
    ctx.fill();

    // Vertex labels
    ctx.fillStyle = colors.fg;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('p₁', verts[0].x, verts[0].y - 10);
    ctx.fillText('p₂', verts[1].x - 10, verts[1].y + 18);
    ctx.fillText('p₃', verts[2].x + 10, verts[2].y + 18);
    ctx.textAlign = 'left';

    // Grid lines on simplex
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 0.3;
    ctx.globalAlpha = 0.3;
    for (let i = 1; i < 10; i++) {
      const t = i / 10;
      for (let edge = 0; edge < 3; edge++) {
        const from = mGeodesic([1, 0, 0], [0, 1, 0], t);
        const from2 = mGeodesic([1, 0, 0], [0, 0, 1], t);
        // Draw parallel to each edge
      }
    }
    ctx.globalAlpha = 1;

    // Draw m-geodesic (always, as reference)
    ctx.strokeStyle = '#43A047';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const pt = mGeodesic(p, q, t);
      const scr = baryToCart(pt, cx, cy, S);
      if (i === 0) ctx.moveTo(scr.x, scr.y); else ctx.lineTo(scr.x, scr.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw e-geodesic (always, as reference)
    ctx.strokeStyle = '#e53935';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const pt = eGeodesic(p, q, t);
      const scr = baryToCart(pt, cx, cy, S);
      if (i === 0) ctx.moveTo(scr.x, scr.y); else ctx.lineTo(scr.x, scr.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw current alpha-geodesic
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const pt = alphaGeodesic(p, q, t, alpha);
      const scr = baryToCart(pt, cx, cy, S);
      if (i === 0) ctx.moveTo(scr.x, scr.y); else ctx.lineTo(scr.x, scr.y);
    }
    ctx.stroke();

    // Draw endpoints
    const pScr = baryToCart(p, cx, cy, S);
    const qScr = baryToCart(q, cx, cy, S);

    ctx.fillStyle = colors.accent;
    ctx.beginPath(); ctx.arc(pScr.x, pScr.y, 6, 0, 2 * Math.PI); ctx.fill();
    ctx.beginPath(); ctx.arc(qScr.x, qScr.y, 6, 0, 2 * Math.PI); ctx.fill();

    ctx.fillStyle = colors.fg;
    ctx.font = '12px sans-serif';
    ctx.fillText('p = (0.6, 0.3, 0.1)', pScr.x + 10, pScr.y - 4);
    ctx.fillText('q = (0.1, 0.2, 0.7)', qScr.x + 10, qScr.y + 14);

    // Legend
    ctx.font = '13px sans-serif';
    const ly = 20;
    ctx.fillStyle = '#43A047'; ctx.fillText('--- m-측지선 (α = −1, 합의 길)', 12, ly);
    ctx.fillStyle = '#e53935'; ctx.fillText('--- e-측지선 (α = +1, 곱의 길)', 12, ly + 18);
    ctx.fillStyle = colors.accent; ctx.fillText(`━━ α = ${alpha.toFixed(2)} 측지선`, 12, ly + 36);
    if (Math.abs(alpha) < 0.05) {
      ctx.fillStyle = colors.fgMuted;
      ctx.fillText('(α = 0 = 레비-치비타 접속)', 12, ly + 54);
    }
  }, [alpha, colors]);

  const canvasRef = useCanvas(draw, [draw]);

  return (
    <div class="viz-inner">
      <canvas ref={canvasRef} />
      <div class="viz-controls">
        <Slider label="α" min={-1} max={1} step={0.01} value={alpha} onChange={setAlpha} />
        <span style={{ color: 'var(--fg-muted)', fontSize: '0.85em' }}>
          α = −1: m-접속 | α = 0: 레비-치비타 | α = +1: e-접속
        </span>
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch10Viz />, el); }
