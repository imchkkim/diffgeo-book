// 10장 — 정규분포족의 (μ, σ) 평면에서 e-측지선, m-측지선, 레비-치비타(피셔) 측지선.
// P, Q 를 끌어 옮기고 비율 t 를 바꾼다. 오른쪽(모바일은 아래)은 세 측지선 위 점의 밀도.
// 색: e = conn(∇), m = dual(∇*), 레비-치비타 = 회색 점선(보조), 분포 = dist, θ = coord, η = dualcoord.
import { render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { Slider } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { usePalette, HEX } from './shared/palette.js';
import { Tex } from './shared/tex.jsx';

const TAU = 2 * Math.PI;
const MU = [-4, 4], SG = [0.25, 3.5];

const toTheta = ([m, s]) => [m / (s * s), -1 / (2 * s * s)];
const fromTheta = ([a, b]) => { const v = -1 / (2 * b); return [a * v, Math.sqrt(v)]; };
const toEta = ([m, s]) => [m, m * m + s * s];
const fromEta = ([a, b]) => [a, Math.sqrt(Math.max(1e-9, b - a * a))];
const lerp2 = (a, b, t) => [(1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1]];
const eAt = (P, Q, t) => fromTheta(lerp2(toTheta(P), toTheta(Q), t));
const mAt = (P, Q, t) => fromEta(lerp2(toEta(P), toEta(Q), t));
// 피셔 계량 (dμ² + 2dσ²)/σ² = 2(du² + dσ²)/σ², u = μ/√2 : 상반평면 측지선, 호의 길이에 비례하게 t 를 준다
function lcAt(P, Q, t) {
  const u1 = P[0] / Math.SQRT2, s1 = P[1], u2 = Q[0] / Math.SQRT2, s2 = Q[1];
  if (Math.abs(u1 - u2) < 1e-6) return [P[0], s1 * Math.pow(s2 / s1, t)];
  const c = (u1 * u1 + s1 * s1 - u2 * u2 - s2 * s2) / (2 * (u1 - u2));
  const r = Math.hypot(u1 - c, s1);
  const tau1 = Math.atanh((u1 - c) / r), tau2 = Math.atanh((u2 - c) / r);
  const tau = (1 - t) * tau1 + t * tau2;
  return [(c + r * Math.tanh(tau)) * Math.SQRT2, r / Math.cosh(tau)];
}
const pdf = (x, [m, s]) => Math.exp(-((x - m) ** 2) / (2 * s * s)) / (s * Math.sqrt(TAU));

function layout(w, h) {
  if (w >= 600) return { A: { x: 44, y: 22, w: w * 0.5 - 60, h: h - 58 }, B: { x: w * 0.5 + 20, y: 22, w: w * 0.5 - 34, h: h - 58 } };
  return { A: { x: 40, y: 18, w: w - 56, h: h * 0.52 - 40 }, B: { x: 16, y: h * 0.52 + 18, w: w - 32, h: h * 0.48 - 42 } };
}

function Ch10Gauss() {
  const colors = useThemeColors();
  const pal = usePalette();
  const [t, setT] = useState(0.5);
  const P = useRef([-2, 1]);
  const Q = useRef([2, 1]);
  const [, bump] = useState(0);
  const drag = useRef(null);
  const pending = useRef(false);
  const refresh = () => {
    if (pending.current) return;
    pending.current = true;
    requestAnimationFrame(() => { pending.current = false; bump(x => x + 1); });
  };

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const { A, B } = layout(w, h);
    const p = P.current, q = Q.current;
    const X = (m) => A.x + ((m - MU[0]) / (MU[1] - MU[0])) * A.w;
    const Y = (s) => A.y + A.h - ((s - 0) / SG[1]) * A.h;

    // ── (μ, σ) 평면 ──
    ctx.fillStyle = colors.bg; ctx.fillRect(A.x, A.y, A.w, A.h);
    ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
    for (let m = -4; m <= 4; m += 1) { ctx.beginPath(); ctx.moveTo(X(m), A.y); ctx.lineTo(X(m), A.y + A.h); ctx.stroke(); }
    for (let s = 0.5; s <= 3.5; s += 0.5) { ctx.beginPath(); ctx.moveTo(A.x, Y(s)); ctx.lineTo(A.x + A.w, Y(s)); ctx.stroke(); }
    ctx.strokeRect(A.x, A.y, A.w, A.h);
    ctx.fillStyle = colors.fgMuted; ctx.font = '11px sans-serif';
    for (const m of [-4, -2, 0, 2, 4]) ctx.fillText(String(m), X(m) - 4, A.y + A.h + 13);
    for (const s of [1, 2, 3]) ctx.fillText(String(s), A.x - 14, Y(s) + 4);
    ctx.fillText('평균 μ', A.x + A.w - 34, A.y + A.h + 26);
    ctx.fillText('표준편차 σ', A.x - 36, A.y - 8);

    ctx.save(); ctx.beginPath(); ctx.rect(A.x, A.y, A.w, A.h); ctx.clip();
    const curve = (fn, color, width, dash) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) { const [m, s] = fn(i / 120); if (i === 0) ctx.moveTo(X(m), Y(s)); else ctx.lineTo(X(m), Y(s)); }
      ctx.stroke(); ctx.setLineDash([]);
    };
    curve(u => lcAt(p, q, u), colors.fgMuted, 1.5, [4, 4]);
    curve(u => mAt(p, q, u), pal.dual, 2.5);
    curve(u => eAt(p, q, u), pal.conn, 2.5);
    const pts = [[mAt(p, q, t), pal.dual], [eAt(p, q, t), pal.conn], [lcAt(p, q, t), colors.fgMuted]];
    for (const [[m, s], c] of pts) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(X(m), Y(s), 5, 0, TAU); ctx.fill(); }
    for (const [pt, nm] of [[p, 'P'], [q, 'Q']]) {
      ctx.fillStyle = pal.dist; ctx.beginPath(); ctx.arc(X(pt[0]), Y(pt[1]), 9, 0, TAU); ctx.fill();
      ctx.strokeStyle = colors.bg; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = colors.bg; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(nm, X(pt[0]), Y(pt[1]) + 4); ctx.textAlign = 'left';
    }
    ctx.restore();

    // ── 밀도 그래프 ──
    const xs = [-7, 7];
    const peak = Math.max(...[p, q, ...pts.map(z => z[0])].map(d => pdf(d[0], d)));
    const yMax = Math.min(1.8, peak * 1.1);
    const XB = (x) => B.x + ((x - xs[0]) / (xs[1] - xs[0])) * B.w;
    const YB = (v) => B.y + B.h - (v / yMax) * B.h;
    ctx.strokeStyle = colors.border; ctx.lineWidth = 1; ctx.strokeRect(B.x, B.y, B.w, B.h);
    ctx.fillStyle = colors.fgMuted; ctx.font = '11px sans-serif';
    for (const x of [-6, -3, 0, 3, 6]) ctx.fillText(String(x), XB(x) - 4, B.y + B.h + 13);
    ctx.fillText('x', B.x + B.w - 8, B.y + B.h + 26);
    const dens = (d, color, width, dash) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      ctx.beginPath();
      for (let i = 0; i <= 240; i++) { const x = xs[0] + (i / 240) * (xs[1] - xs[0]); const y = YB(pdf(x, d)); if (i === 0) ctx.moveTo(XB(x), y); else ctx.lineTo(XB(x), y); }
      ctx.stroke(); ctx.setLineDash([]);
    };
    ctx.save(); ctx.beginPath(); ctx.rect(B.x, B.y, B.w, B.h); ctx.clip();
    dens(p, pal.dist, 1.5, [2, 3]); dens(q, pal.dist, 1.5, [2, 3]);
    dens(pts[2][0], colors.fgMuted, 1.5, [4, 4]);
    dens(pts[0][0], pal.dual, 2.5); dens(pts[1][0], pal.conn, 2.5);
    ctx.restore();
    ctx.font = '12px sans-serif';
    ctx.fillStyle = pal.conn; ctx.fillText('— e-측지선 위의 점', B.x + 8, B.y + 16);
    ctx.fillStyle = pal.dual; ctx.fillText('— m-측지선 위의 점', B.x + 8, B.y + 32);
    ctx.fillStyle = colors.fgMuted; ctx.fillText('- - 레비-치비타 · ⋯ P, Q', B.x + 8, B.y + 48);
  };

  const canvasRef = useCanvas(drawRef);
  usePointer(canvasRef, {
    onDown: (pos) => {
      const c = canvasRef.current, { A } = layout(c.clientWidth, c.clientHeight);
      const sx = (m) => A.x + ((m - MU[0]) / (MU[1] - MU[0])) * A.w, sy = (s) => A.y + A.h - (s / SG[1]) * A.h;
      const d = (pt) => Math.hypot(sx(pt[0]) - pos.x, sy(pt[1]) - pos.y);
      const dp = d(P.current), dq = d(Q.current);
      drag.current = Math.min(dp, dq) < 26 ? (dp < dq ? P : Q) : null;
    },
    onDrag: (pos) => {
      if (!drag.current) return;
      const c = canvasRef.current, { A } = layout(c.clientWidth, c.clientHeight);
      const m = MU[0] + ((pos.x - A.x) / A.w) * (MU[1] - MU[0]);
      const s = ((A.y + A.h - pos.y) / A.h) * SG[1];
      drag.current.current = [Math.max(MU[0] + 0.2, Math.min(MU[1] - 0.2, m)), Math.max(SG[0], Math.min(SG[1] - 0.1, s))];
      refresh();
    },
    onUp: () => { drag.current = null; },
  });

  const Th = HEX.coord, Et = HEX.dualcoord, Cn = HEX.conn, D = HEX.dual;
  const Tt = `\\textcolor{${HEX.time}}{t}`;
  const p = P.current, q = Q.current, e = eAt(p, q, t), m = mAt(p, q, t), lc = lcAt(p, q, t);
  const N = ([mu, s]) => `N(${mu.toFixed(2)},\\ ${(s * s).toFixed(2)})`;
  const th = toTheta(e), et = toEta(m);

  return (
    <div class="viz-inner">
      <div class="viz-message">
        e-측지선은 <Tex>{`\\textcolor{${Th}}{\\theta}`}</Tex> 좌표에서, m-측지선은 <Tex>{`\\textcolor{${Et}}{\\eta}`}</Tex> 좌표에서 곧은 직선이다. 분산이 같고 평균만 다른 두 분포 사이에서 e-측지선은 분산을 그대로 둔 채 가고, m-측지선은 분산을 키우며 위로 돌아간다.
      </div>
      <canvas ref={canvasRef} />
      <div class="viz-formula">
        <div><Tex>{`\\textcolor{${Cn}}{\\text{e}}: \\textcolor{${Th}}{\\theta} = (1-${Tt})\\textcolor{${Th}}{\\theta}_P + ${Tt}\\,\\textcolor{${Th}}{\\theta}_Q = (${th[0].toFixed(3)},\\ ${th[1].toFixed(3)}) \\;\\Rightarrow\\; ${N(e)}`}</Tex></div>
        <div><Tex>{`\\textcolor{${D}}{\\text{m}}: \\textcolor{${Et}}{\\eta} = (1-${Tt})\\textcolor{${Et}}{\\eta}_P + ${Tt}\\,\\textcolor{${Et}}{\\eta}_Q = (${et[0].toFixed(3)},\\ ${et[1].toFixed(3)}) \\;\\Rightarrow\\; ${N(m)}`}</Tex></div>
        <div><Tex>{`\\text{레비-치비타 (피셔 계량의 측지선)}: ${N(lc)}`}</Tex></div>
      </div>
      <div class="viz-controls">
        <Slider label={<Tex>{Tt}</Tex>} min={0} max={1} step={0.01} value={t} onChange={setT} />
        <button class="viz-btn" onClick={() => { P.current = [-2, 1]; Q.current = [2, 1]; refresh(); }}>N(−2,1) ↔ N(2,1)</button>
        <button class="viz-btn" onClick={() => { P.current = [-1, 0.5]; Q.current = [2, 2]; refresh(); }}>N(−1,0.25) ↔ N(2,4)</button>
        <span style={{ color: 'var(--fg-muted)', fontSize: '0.85em' }}>P, Q 를 끌어 옮기기</span>
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch10Gauss />, el); }
