// 4장 — 공변미분 = 성분의 편미분 + Γ 보정. 극좌표 평면 위의 벡터장 세 가지로 비교한다.
// 왼쪽: 극좌표 격자 위 벡터장(끌 수 있는 점 P, 그 자리의 기저 ∂_r·∂_θ). 오른쪽: 성분별 막대 — 편미분, 보정 항, 합(공변미분).
// 동쪽 균일: 편미분 ≠ 0 인데 합 = 0 (가짜 변화). 회전 흐름: 편미분 = 0 인데 합 ≠ 0 (놓친 진짜 변화).
// 색: 방향 v·기저 = dir, 벡터장 W = field, Γ·∇ = conn, 좌표 = coord (palette.json).
import { h, render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { usePalette, HEX } from './shared/palette.js';
import { Tex } from './shared/tex.jsx';
import { drawArrow } from './shared/math.js';

const TAU = 2 * Math.PI;
const RMAX = 2.4;

// 좌표 기저 성분 (W^r, W^θ) 와 그 편미분. Γ^r_θθ = −r, Γ^θ_rθ = Γ^θ_θr = 1/r.
const FIELDS = {
  east: {
    label: '동쪽 균일 (어디서나 동쪽으로 1)',
    W: (r, t) => [Math.cos(t), -Math.sin(t) / r],
    dr: (r, t) => [0, Math.sin(t) / (r * r)],
    dt: (r, t) => [-Math.sin(t), -Math.cos(t) / r],
  },
  rot: {
    label: '회전 흐름 (W = ∂θ)',
    W: () => [0, 1],
    dr: () => [0, 0],
    dt: () => [0, 0],
  },
  radial: {
    label: '퍼지는 흐름 (W = r ∂r)',
    W: (r) => [r, 0],
    dr: () => [1, 0],
    dt: () => [0, 0],
  },
};
// 보정 항 Γ^i_{jk} W^k (j = 미분 방향)
function corr(dir, r, W) {
  if (dir === 'r') return [0, W[1] / r];
  return [-r * W[1], W[0] / r];
}
// 좌표 기저 성분 → 평면 벡터
const toXY = (r, t, [a, b]) => [a * Math.cos(t) - b * r * Math.sin(t), a * Math.sin(t) + b * r * Math.cos(t)];
const f2 = (v) => (Math.abs(v) < 5e-3 ? '0' : v.toFixed(2));

function layout(w, h) {
  const wide = w >= 640;
  const pw = wide ? Math.min(w * 0.55, h - 20) : Math.min(w - 20, h * 0.58);
  return {
    wide,
    plane: { cx: wide ? pw / 2 + 10 : w / 2, cy: wide ? h / 2 : pw / 2 + 8, S: pw / 2 / RMAX * 0.95 },
    bars: wide ? { x: pw + 40, y: 30, w: w - pw - 60, h: h - 60 } : { x: 30, y: pw + 24, w: w - 50, h: h - pw - 40 },
  };
}

function Ch04CovViz() {
  const colors = useThemeColors();
  const pal = usePalette();
  const [field, setField] = useState('east');
  const [dir, setDir] = useState('t');
  const P = useRef({ r: 1.4, t: 0.7 });
  const [readP, setReadP] = useState({ r: 1.4, t: 0.7 });
  const drag = useRef(false);
  const pending = useRef(false);
  const fRef = useRef(field); fRef.current = field;
  const dRef = useRef(dir); dRef.current = dir;

  function setPoint(p) {
    P.current = p;
    if (!pending.current) {
      pending.current = true;
      requestAnimationFrame(() => { pending.current = false; setReadP({ ...P.current }); });
    }
  }

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const L = layout(w, h);
    const { cx, cy, S } = L.plane;
    const F = FIELDS[fRef.current];
    const scr = (x, y) => [cx + x * S, cy - y * S];

    // 극좌표 격자
    ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
    for (let k = 1; k <= 4; k++) { ctx.beginPath(); ctx.arc(cx, cy, k * 0.6 * S, 0, TAU); ctx.stroke(); }
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * RMAX * S, cy - Math.sin(a) * RMAX * S); ctx.stroke();
    }
    // 벡터장
    ctx.strokeStyle = pal.field; ctx.lineWidth = 1.3; ctx.globalAlpha = 0.55;
    const unit = 0.32;
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
      const x = i * 0.65, y = j * 0.65, r = Math.hypot(x, y);
      if (r < 0.3 || r > RMAX - 0.1) continue;
      const t = Math.atan2(y, x);
      const [vx, vy] = toXY(r, t, F.W(r, t));
      const n = Math.hypot(vx, vy) || 1, s = unit * Math.min(1, 1.6 / n);
      const [x0, y0] = scr(x, y), [x1, y1] = scr(x + vx * s, y + vy * s);
      drawArrow(ctx, x0, y0, x1, y1, 5);
    }
    ctx.globalAlpha = 1;

    // 점 P 와 그 자리의 기저, 벡터장, 공변미분
    const { r, t } = P.current;
    const px = r * Math.cos(t), py = r * Math.sin(t);
    const [sx, sy] = scr(px, py);
    const k = 0.45;
    const eR = [Math.cos(t), Math.sin(t)], eT = [-r * Math.sin(t), r * Math.cos(t)];
    ctx.strokeStyle = pal.dir; ctx.lineWidth = 2;
    for (const [e, nm] of [[eR, '∂r'], [eT, '∂θ']]) {
      const [ex, ey] = scr(px + e[0] * k, py + e[1] * k);
      drawArrow(ctx, sx, sy, ex, ey, 7);
      ctx.fillStyle = pal.dir; ctx.font = 'italic 13px serif'; ctx.fillText(nm, ex + 4, ey - 4);
    }
    // 미분 방향 강조: 그 방향의 좌표선
    ctx.strokeStyle = pal.coord; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.6;
    ctx.beginPath();
    if (dRef.current === 't') ctx.arc(cx, cy, r * S, -t - 0.5, -t + 0.5);
    else { const [a0, b0] = scr((r - 0.5) * Math.cos(t), (r - 0.5) * Math.sin(t)), [a1, b1] = scr((r + 0.5) * Math.cos(t), (r + 0.5) * Math.sin(t)); ctx.moveTo(a0, b0); ctx.lineTo(a1, b1); }
    ctx.stroke(); ctx.globalAlpha = 1;
    // W(P)
    const Wp = F.W(r, t);
    const [wx, wy] = toXY(r, t, Wp);
    ctx.strokeStyle = pal.field; ctx.lineWidth = 3;
    const ws = 0.5 / Math.max(1, Math.hypot(wx, wy) / 1.6);
    const [qx, qy] = scr(px + wx * ws, py + wy * ws);
    drawArrow(ctx, sx, sy, qx, qy, 9);
    // ∇W
    const d = dRef.current;
    const part = d === 'r' ? F.dr(r, t) : F.dt(r, t);
    const c = corr(d, r, Wp);
    const cov = [part[0] + c[0], part[1] + c[1]];
    const [gx, gy] = toXY(r, t, cov);
    if (Math.hypot(gx, gy) > 1e-3) {
      ctx.strokeStyle = pal.conn; ctx.lineWidth = 3; ctx.setLineDash([5, 3]);
      const [ux, uy] = scr(px + gx * 0.4, py + gy * 0.4);
      drawArrow(ctx, sx, sy, ux, uy, 9); ctx.setLineDash([]);
    }
    ctx.fillStyle = colors.fg;
    ctx.beginPath(); ctx.arc(sx, sy, 6, 0, TAU); ctx.fill();
    ctx.strokeStyle = colors.bg; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = 'bold 13px sans-serif'; ctx.fillText('P', sx + 8, sy + 16);

    // ── 막대 ──
    const B = L.bars;
    const groups = [['r 성분', 0], ['θ 성분', 1]];
    const vals = groups.map(([, i]) => [part[i], c[i], cov[i]]);
    const vmax = Math.max(1, ...vals.flat().map(Math.abs));
    const zeroY = B.y + B.h / 2, sc = (B.h / 2 - 34) / vmax;
    ctx.strokeStyle = colors.fgMuted; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(B.x, zeroY); ctx.lineTo(B.x + B.w, zeroY); ctx.stroke();
    const gw = B.w / 2, bw = Math.min(34, gw / 4.2);
    const cols = [colors.fgMuted, pal.conn, pal.conn];
    const names = ['편미분', 'Γ 보정', '합 = ∇'];
    groups.forEach(([gname], gi) => {
      const gx0 = B.x + gi * gw + gw / 2 - 1.5 * bw - 6;
      vals[gi].forEach((v, bi) => {
        const x = gx0 + bi * (bw + 6), hgt = v * sc;
        ctx.fillStyle = cols[bi]; ctx.globalAlpha = bi === 1 ? 0.45 : 0.9;
        ctx.fillRect(x, hgt >= 0 ? zeroY - hgt : zeroY, bw, Math.abs(hgt) || 1);
        ctx.globalAlpha = 1;
        ctx.fillStyle = colors.fg; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(f2(v), x + bw / 2, hgt >= 0 ? zeroY - hgt - 4 : zeroY - hgt + 12);
        ctx.fillStyle = colors.fgMuted;
        ctx.fillText(names[bi], x + bw / 2, B.y + B.h + 2);
      });
      ctx.fillStyle = colors.fg; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(gname, B.x + gi * gw + gw / 2, B.y + 4);
    });
    ctx.textAlign = 'left';
  };

  const canvasRef = useCanvas(drawRef);
  usePointer(canvasRef, {
    onDown: (pos) => { drag.current = true; moveTo(pos); },
    onDrag: (pos) => { if (drag.current) moveTo(pos); },
    onUp: () => { drag.current = false; },
  });
  function moveTo(pos) {
    const c = canvasRef.current;
    const L = layout(c.clientWidth, c.clientHeight);
    const x = (pos.x - L.plane.cx) / L.plane.S, y = -(pos.y - L.plane.cy) / L.plane.S;
    const r = Math.hypot(x, y);
    if (r > RMAX + 0.2) return;
    setPoint({ r: Math.max(0.4, Math.min(RMAX - 0.1, r)), t: Math.atan2(y, x) });
  }

  // ── 수식 패널 ──
  const F = FIELDS[field];
  const { r, t } = readP;
  const Wp = F.W(r, t);
  const part = dir === 'r' ? F.dr(r, t) : F.dt(r, t);
  const c = corr(dir, r, Wp);
  const cov = [part[0] + c[0], part[1] + c[1]];
  const D = HEX.dir, Wc = HEX.field, G = HEX.conn, C = HEX.coord;
  const xj = dir === 'r' ? `\\textcolor{${C}}{r}` : `\\textcolor{${C}}{\\theta}`;
  const pair = (u) => `(${f2(u[0])},\\ ${f2(u[1])})`;
  const verdict = Math.hypot(...toXY(r, t, cov)) < 1e-3
    ? (Math.hypot(...part) > 1e-3 ? '편미분은 변했다고 하지만, 보정하고 나면 0 — 기저가 돈 몫뿐인 가짜 변화다' : '편미분도 0, 공변미분도 0 — 이 방향으로는 변하지 않는다')
    : (Math.hypot(...part) < 1e-3 ? '편미분은 0이라 변하지 않는다고 하지만, 공변미분은 0이 아니다 — 편미분이 진짜 변화를 놓쳤다' : '보정하고 나서도 0이 아니다 — 벡터장이 이 방향으로 정말 변한다');

  return (
    <div class="viz-inner">
      <div class="viz-message">
        점 P를 끌어 보자. 성분의 편미분(회색)에 Γ 보정(보라)을 더한 합이 공변미분이다. 동쪽 균일 흐름에서는 둘이 늘 상쇄되고, 회전 흐름에서는 편미분이 0인데도 합이 남는다.
      </div>
      <canvas ref={canvasRef} style={{ height: '420px' }} />
      <div class="viz-formula">
        <div>
          <Tex>{`P = (\\textcolor{${C}}{r}, \\textcolor{${C}}{\\theta}) = (${r.toFixed(2)},\\ ${t.toFixed(2)}),\\quad \\textcolor{${Wc}}{W}(P) = ${pair(Wp)}`}</Tex>
          <span style={{ color: 'var(--fg-muted)', marginLeft: '0.6em', fontSize: '0.9em' }}>좌표 기저 성분</span>
        </div>
        <div>
          <Tex>{`\\textcolor{${G}}{\\nabla}_{\\textcolor{${D}}{\\partial_{${dir === 'r' ? 'r' : '\\theta'}}}}\\textcolor{${Wc}}{W} = \\underbrace{${pair(part)}}_{\\partial \\textcolor{${Wc}}{W}/\\partial ${xj}} + \\underbrace{${pair(c)}}_{\\textcolor{${G}}{\\Gamma}\\,\\textcolor{${Wc}}{W}} = ${pair(cov)}`}</Tex>
        </div>
        <div style={{ color: 'var(--fg-muted)', fontSize: '0.9em' }}>{verdict}</div>
      </div>
      <div class="viz-controls">
        {Object.entries(FIELDS).map(([k, f]) => (
          <button class={'viz-btn' + (field === k ? ' active' : '')} onClick={() => setField(k)}>{f.label}</button>
        ))}
        <span class="viz-inputs">
          미분 방향
          <button class={'viz-btn' + (dir === 't' ? ' active' : '')} onClick={() => setDir('t')}>θ 방향</button>
          <button class={'viz-btn' + (dir === 'r' ? ' active' : '')} onClick={() => setDir('r')}>r 방향</button>
        </span>
        <span style={{ color: 'var(--fg-muted)', fontSize: '0.85em' }}>파랑 = 그 자리의 기저 ∂r·∂θ · 주황 = 벡터장 W · 보라 점선 = 공변미분 ∇W · 초록 = 미분하는 좌표선</span>
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch04CovViz />, el); }
