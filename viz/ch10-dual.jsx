// 10장 — 확률 심플렉스 위의 m-측지선, e-측지선, α-곡선.
// P, Q 를 끌어 옮기고 α 를 바꾼다. 오른쪽 막대는 t = 1/2 지점의 분포.
// 색: e-측지선 = conn(∇), m-측지선 = dual(∇*), α = alpha, 확률분포 = dist.
import { render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { Slider } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { usePalette, HEX } from './shared/palette.js';
import { Tex } from './shared/tex.jsx';

const TAU = 2 * Math.PI;
const norm = (r) => { const s = r[0] + r[1] + r[2]; return r.map(v => v / s); };
const mGeo = (p, q, t) => p.map((v, i) => (1 - t) * v + t * q[i]);
const eGeo = (p, q, t) => norm(p.map((v, i) => Math.pow(v, 1 - t) * Math.pow(q[i], t)));
// α-표현 x^{(1−α)/2} 에서 직선을 긋고 확률로 되돌린다 (α = ±1, 0 에서는 측지선의 경로와 같다)
function aGeo(p, q, t, alpha) {
  const a = (1 - alpha) / 2;
  if (Math.abs(a) < 1e-3) return eGeo(p, q, t);
  const r = p.map((v, i) => Math.pow((1 - t) * Math.pow(v, a) + t * Math.pow(q[i], a), 1 / a));
  return norm(r);
}

function tri(L) {
  // 꼭짓점: p₁ 위, p₂ 왼쪽 아래, p₃ 오른쪽 아래
  const s = L.s;
  return [[L.cx, L.cy - s * 0.62], [L.cx - s * 0.62, L.cy + s * 0.46], [L.cx + s * 0.62, L.cy + s * 0.46]];
}
const toXY = (V, p) => [p[0] * V[0][0] + p[1] * V[1][0] + p[2] * V[2][0], p[0] * V[0][1] + p[1] * V[1][1] + p[2] * V[2][1]];
function toBary(V, x, y) {
  const [[x1, y1], [x2, y2], [x3, y3]] = V;
  const d = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
  const a = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / d;
  const b = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / d;
  const m = 0.02;
  return norm([Math.max(m, a), Math.max(m, b), Math.max(m, 1 - a - b)]);
}
function layout(w, h) {
  if (w >= 600) return { tri: { cx: w * 0.3, cy: h * 0.55, s: Math.min(w * 0.5, h) * 0.76 }, bars: { x: w * 0.6, y: 24, w: w * 0.38, h: h - 40 } };
  return { tri: { cx: w / 2, cy: h * 0.34, s: Math.min(w, h * 0.55) * 0.74 }, bars: { x: 8, y: h * 0.64, w: w - 16, h: h * 0.34 } };
}

function Ch10Viz() {
  const colors = useThemeColors();
  const pal = usePalette();
  const [alpha, setAlpha] = useState(0);
  const P = useRef([0.6, 0.3, 0.1]);
  const Q = useRef([0.1, 0.2, 0.7]);
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
    const L = layout(w, h), V = tri(L.tri);
    const p = P.current, q = Q.current;
    // 삼각형
    ctx.fillStyle = colors.bg; ctx.strokeStyle = colors.border; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(...V[0]); ctx.lineTo(...V[1]); ctx.lineTo(...V[2]); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = colors.fgMuted; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('결과 1 확실', V[0][0], V[0][1] - 8);
    ctx.fillText('결과 2 확실', V[1][0], V[1][1] + 18);
    ctx.fillText('결과 3 확실', V[2][0], V[2][1] + 18);
    ctx.textAlign = 'left';
    // 곡선들
    const curve = (fn, color, width, dash) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) { const [x, y] = toXY(V, fn(i / 80)); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke(); ctx.setLineDash([]);
    };
    curve(t => mGeo(p, q, t), pal.dual, 2, [6, 4]);
    curve(t => eGeo(p, q, t), pal.conn, 2, [6, 4]);
    curve(t => aGeo(p, q, t, alpha), pal.alpha, 3);
    // 중간점
    for (const [pt, c] of [[mGeo(p, q, 0.5), pal.dual], [eGeo(p, q, 0.5), pal.conn], [aGeo(p, q, 0.5, alpha), pal.alpha]]) {
      const [x, y] = toXY(V, pt); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill();
    }
    // 끝점
    for (const [pt, name] of [[p, 'P'], [q, 'Q']]) {
      const [x, y] = toXY(V, pt);
      ctx.fillStyle = pal.dist; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill();
      ctx.strokeStyle = colors.bg; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = colors.bg; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(name, x, y + 4); ctx.textAlign = 'left';
    }

    // 막대: 분포 다섯 개
    const B = L.bars;
    const rows = [['P', p, pal.dist], ['m-중간점', mGeo(p, q, 0.5), pal.dual], [`α = ${alpha.toFixed(2)} 중간점`, aGeo(p, q, 0.5, alpha), pal.alpha], ['e-중간점', eGeo(p, q, 0.5), pal.conn], ['Q', q, pal.dist]];
    if (w < 600) {
      // 좁은 화면: 분포 다섯 개를 가로로 나란히, 각각 막대 세 개
      const gw = B.w / rows.length;
      rows.forEach(([name, d, c], k) => {
        const gx = B.x + k * gw + 4, bw = (gw - 16) / 3, bh = B.h - 30;
        for (let i = 0; i < 3; i++) {
          const x = gx + i * (bw + 2), hh = d[i] * bh;
          ctx.fillStyle = colors.border; ctx.fillRect(x, B.y, bw, bh);
          ctx.fillStyle = c; ctx.fillRect(x, B.y + bh - hh, bw, hh);
        }
        ctx.fillStyle = colors.fgMuted; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(name.startsWith('α') ? 'α 중간점' : name, gx + (gw - 12) / 2, B.y + bh + 14);
        ctx.textAlign = 'left';
      });
      return;
    }
    const rh = B.h / rows.length;
    rows.forEach(([name, d, c], k) => {
      const y0 = B.y + k * rh;
      ctx.fillStyle = colors.fgMuted; ctx.font = '12px sans-serif';
      ctx.fillText(name, B.x, y0 + 12);
      const bw = (B.w - 20) / 3, top = y0 + 18, bh = rh - 26;
      for (let i = 0; i < 3; i++) {
        const x = B.x + i * (bw + 10) - 0, hh = d[i] * bh;
        ctx.fillStyle = colors.border; ctx.fillRect(x, top, bw, bh);
        ctx.fillStyle = c; ctx.fillRect(x, top + bh - hh, bw, hh);
        ctx.fillStyle = colors.fg; ctx.font = '10px sans-serif';
        ctx.fillText(d[i].toFixed(2), x + 3, top + 11);
      }
    });
  };

  const canvasRef = useCanvas(drawRef);
  usePointer(canvasRef, {
    onDown: (pos) => {
      const c = canvasRef.current, L = layout(c.clientWidth, c.clientHeight), V = tri(L.tri);
      const dist = (pt) => { const [x, y] = toXY(V, pt); return Math.hypot(x - pos.x, y - pos.y); };
      const dp = dist(P.current), dq = dist(Q.current);
      drag.current = Math.min(dp, dq) < 24 ? (dp < dq ? P : Q) : null;
    },
    onDrag: (pos) => {
      if (!drag.current) return;
      const c = canvasRef.current, V = tri(layout(c.clientWidth, c.clientHeight).tri);
      drag.current.current = toBary(V, pos.x, pos.y);
      refresh();
    },
    onUp: () => { drag.current = null; },
  });

  const A = HEX.alpha, Cn = HEX.conn, D = HEX.dual, Pc = HEX.dist;
  const p = P.current, q = Q.current;
  const v3 = (d) => `(${d.map(x => x.toFixed(2)).join(',\\ ')})`;
  const name = Math.abs(alpha - 1) < 0.02 ? '\\text{ (e-접속)}' : Math.abs(alpha + 1) < 0.02 ? '\\text{ (m-접속)}' : Math.abs(alpha) < 0.02 ? '\\text{ (레비-치비타)}' : '';

  return (
    <div class="viz-inner">
      <div class="viz-message">
        같은 두 분포 사이에도 "직선"이 둘이다. 확률을 더해 섞는 m-측지선과 확률을 곱해 섞는 e-측지선은 다른 길로 가고, e-중간점은 한쪽 분포라도 낮게 보는 결과의 확률을 더 깎는다(곱에서는 작은 쪽이 이긴다).
      </div>
      <canvas ref={canvasRef} />
      <div class="viz-formula">
        <div><Tex>{`\\textcolor{${D}}{\\text{m}}: (1-t)\\textcolor{${Pc}}{P} + t\\textcolor{${Pc}}{Q} \\;\\xrightarrow{t = 1/2}\\; ${v3(mGeo(p, q, 0.5))}`}</Tex></div>
        <div><Tex>{`\\textcolor{${Cn}}{\\text{e}}: \\frac{\\textcolor{${Pc}}{P}^{1-t}\\,\\textcolor{${Pc}}{Q}^{t}}{Z(t)} \\;\\xrightarrow{t = 1/2}\\; ${v3(eGeo(p, q, 0.5))}`}</Tex></div>
        <div><Tex>{`\\textcolor{${A}}{\\alpha} = ${alpha.toFixed(2)}${name}: \\big((1-t)\\textcolor{${Pc}}{P}^{a} + t\\textcolor{${Pc}}{Q}^{a}\\big)^{1/a},\\ a = \\tfrac{1-\\textcolor{${A}}{\\alpha}}{2} \\;\\xrightarrow{t = 1/2}\\; ${v3(aGeo(p, q, 0.5, alpha))}`}</Tex></div>
        <div style={{ color: 'var(--fg-muted)', fontSize: '0.85em' }}>α 곡선은 α-표현에서 직선을 긋고 합이 1이 되게 되돌린 것이다. α = −1, 0, +1에서는 각 접속의 측지선과 같은 경로이고, 그 사이 값은 두 극단을 잇는 보간이다.</div>
      </div>
      <div class="viz-controls">
        <Slider label={<Tex>{`\\textcolor{${A}}{\\alpha}`}</Tex>} min={-1} max={1} step={0.01} value={alpha} onChange={setAlpha} />
        <button class="viz-btn" onClick={() => setAlpha(-1)}>m (α = −1)</button>
        <button class="viz-btn" onClick={() => setAlpha(0)}>레비-치비타 (α = 0)</button>
        <button class="viz-btn" onClick={() => setAlpha(1)}>e (α = +1)</button>
        <span style={{ color: 'var(--fg-muted)', fontSize: '0.85em' }}>P, Q 를 끌어 옮기기</span>
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch10Viz />, el); }
