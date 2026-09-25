// 11장 — 확률 삼각형 위의 두 분포 p, q.
// D(p‖q), D(q‖p), ½ g δδ 를 비교하고, p 주변에서 세 값이 같은 수준(c)인 곡선을 그린다.
// 색: 발산 D = div, 분포 p·q = dist, 피셔 계량 = metric (palette.json).
import { h, render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { usePalette, HEX } from './shared/palette.js';
import { Tex } from './shared/tex.jsx';

const TAU = 2 * Math.PI;
const EPS = 1e-4;

const kl = (a, b) => a.reduce((s, ai, i) => s + (ai > 0 ? ai * Math.log(ai / b[i]) : 0), 0);
// 범주형 분포의 피셔 계량: ds² = Σ δᵢ²/pᵢ
const quad = (p, q) => 0.5 * p.reduce((s, pi, i) => s + (q[i] - pi) ** 2 / pi, 0);

// 삼각형 안의 접선 방향 두 개 (성분 합 0, 서로 직교)
const E1 = [1 / Math.SQRT2, -1 / Math.SQRT2, 0];
const E2 = [1 / Math.sqrt(6), 1 / Math.sqrt(6), -2 / Math.sqrt(6)];

function tri(w, h) {
  const wide = w >= 520;
  const side = Math.min(wide ? w * 0.62 : w * 0.78, (h - 44) / 0.866);
  const cx = wide ? w * 0.36 : w / 2, top = (h - side * 0.866) / 2;
  return [
    [cx - side / 2, top + side * 0.866], // x₁ (왼쪽 아래)
    [cx + side / 2, top + side * 0.866], // x₂ (오른쪽 아래)
    [cx, top],                           // x₃ (위)
  ];
}
const toScr = (V, p) => [p[0] * V[0][0] + p[1] * V[1][0] + p[2] * V[2][0], p[0] * V[0][1] + p[1] * V[1][1] + p[2] * V[2][1]];
function fromScr(V, x, y) {
  const [[x1, y1], [x2, y2], [x3, y3]] = V;
  const det = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
  let a = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / det;
  let b = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / det;
  let c = 1 - a - b;
  const m = 0.02; // 가장자리에 붙지 않게
  a = Math.max(m, a); b = Math.max(m, b); c = Math.max(m, c);
  const s = a + b + c;
  return [a / s, b / s, c / s];
}

// p 에서 방향 u 로 f(q) = c 가 되는 점. 삼각형 밖으로 나가면 경계점.
function levelPoint(p, u, f, c) {
  let tMax = Infinity;
  for (let i = 0; i < 3; i++) if (u[i] < 0) tMax = Math.min(tMax, (p[i] - EPS) / -u[i]);
  const at = t => p.map((pi, i) => pi + t * u[i]);
  if (f(at(tMax)) < c) return { q: at(tMax), clipped: true };
  let lo = 0, hi = tMax;
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (f(at(mid)) < c) lo = mid; else hi = mid; }
  return { q: at(lo), clipped: false };
}

function Ch11Viz() {
  const colors = useThemeColors();
  const pal = usePalette();
  const pts = useRef({ p: [0.5, 0.3, 0.2], q: [0.2, 0.5, 0.3] });
  const [read, setRead] = useState(pts.current);
  const [logc, setLogc] = useState(Math.log10(0.05));
  const levelRef = useRef(0.05);
  levelRef.current = 10 ** logc;
  const drag = useRef(null);
  const pending = useRef(false);

  function publish() {
    if (pending.current) return;
    pending.current = true;
    requestAnimationFrame(() => { pending.current = false; setRead({ ...pts.current }); });
  }

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const V = tri(w, h);
    const { p, q } = pts.current;
    const c = levelRef.current;

    // 삼각형
    ctx.fillStyle = colors.bg;
    ctx.strokeStyle = colors.fgMuted; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(...V[0]); ctx.lineTo(...V[1]); ctx.lineTo(...V[2]); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = colors.fgMuted; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('x₁ 확실', V[0][0] - 4, V[0][1] + 18);
    ctx.fillText('x₂ 확실', V[1][0] + 4, V[1][1] + 18);
    ctx.fillText('x₃ 확실', V[2][0], V[2][1] - 8);
    ctx.textAlign = 'left';

    // 수준 곡선 세 개
    function level(f, style, width, dash) {
      ctx.strokeStyle = style; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      ctx.beginPath();
      const N = 180;
      for (let k = 0; k <= N; k++) {
        const a = (k / N) * TAU;
        const u = E1.map((e, i) => Math.cos(a) * e + Math.sin(a) * E2[i]);
        const [x, y] = toScr(V, levelPoint(p, u, f, c).q);
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    level(qq => quad(p, qq), pal.metric, 2, [2, 3]);
    level(qq => kl(p, qq), pal.div, 2);
    level(qq => kl(qq, p), pal.div, 2, [7, 4]);

    // p → q 선분
    const P = toScr(V, p), Q = toScr(V, q);
    ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(...P); ctx.lineTo(...Q); ctx.stroke();

    // 점
    ctx.fillStyle = pal.dist;
    ctx.beginPath(); ctx.arc(P[0], P[1], 7, 0, TAU); ctx.fill();
    ctx.strokeStyle = colors.bg; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = pal.dist; ctx.lineWidth = 3;
    ctx.fillStyle = colors.bg;
    ctx.beginPath(); ctx.arc(Q[0], Q[1], 6, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.dist; ctx.font = 'italic bold 16px serif';
    ctx.fillText('p', P[0] + 10, P[1] - 8);
    ctx.fillText('q', Q[0] + 10, Q[1] - 8);

    // 막대: 두 분포의 세 성분
    const bx = w * 0.72, bw = w * 0.25, by = h * 0.18, bh = h * 0.5;
    if (w >= 520) {
      const colW = bw / 3;
      ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const x0 = bx + i * colW;
        const hp = p[i] * bh, hq = q[i] * bh;
        ctx.fillStyle = pal.dist; ctx.globalAlpha = 0.85;
        ctx.fillRect(x0 + colW * 0.12, by + bh - hp, colW * 0.34, hp);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = pal.dist; ctx.lineWidth = 2;
        ctx.strokeRect(x0 + colW * 0.54, by + bh - hq, colW * 0.34, hq);
        ctx.fillStyle = colors.fgMuted; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`x${'₁₂₃'[i]}`, x0 + colW / 2, by + bh + 16);
      }
      ctx.fillText('채움 = p, 테두리 = q', bx + bw / 2, by - 10);
      ctx.textAlign = 'left';
    }
  };

  const canvasRef = useCanvas(drawRef);

  usePointer(canvasRef, {
    onDown: (pos) => {
      const cv = canvasRef.current;
      const V = tri(cv.clientWidth, cv.clientHeight);
      const P = toScr(V, pts.current.p), Q = toScr(V, pts.current.q);
      const dp = Math.hypot(pos.x - P[0], pos.y - P[1]), dq = Math.hypot(pos.x - Q[0], pos.y - Q[1]);
      drag.current = Math.min(dp, dq) < 36 ? (dp < dq ? 'p' : 'q') : null;
    },
    onDrag: (pos) => {
      if (!drag.current) return;
      const cv = canvasRef.current;
      pts.current = { ...pts.current, [drag.current]: fromScr(tri(cv.clientWidth, cv.clientHeight), pos.x, pos.y) };
      publish();
    },
    onUp: () => { drag.current = null; },
  });

  function preset(q) { pts.current = { p: [0.5, 0.3, 0.2], q }; publish(); }

  const D = HEX.div, P = HEX.dist, G = HEX.metric;
  const { p, q } = read;
  const dpq = kl(p, q), dqp = kl(q, p), qd = quad(p, q);
  const vec = v => `(${v.map(x => x.toFixed(2)).join(',\\,')})`;
  const c = 10 ** logc;

  return (
    <div class="viz-inner">
      <div class="viz-message">
        <Tex>{`\\textcolor{${P}}{q}`}</Tex>를 <Tex>{`\\textcolor{${P}}{p}`}</Tex> 가까이 끌어오면 두 방향의 발산이 같아지고, 둘 다 피셔 계량의 이차식 <Tex>{`\\tfrac12\\textcolor{${G}}{g}_{ij}\\delta^i\\delta^j`}</Tex>에 붙는다. 멀어질수록 세 값이 갈라진다.
      </div>
      <canvas ref={canvasRef} />
      <div class="viz-formula">
        <div>
          <Tex>{`\\textcolor{${P}}{p} = ${vec(p)},\\quad \\textcolor{${P}}{q} = ${vec(q)}`}</Tex>
        </div>
        <div><Tex>{`\\textcolor{${D}}{D}(\\textcolor{${P}}{p}\\,\\|\\,\\textcolor{${P}}{q}) = \\sum_i \\textcolor{${P}}{p}_i \\log\\frac{\\textcolor{${P}}{p}_i}{\\textcolor{${P}}{q}_i} = ${dpq.toFixed(4)}`}</Tex></div>
        <div><Tex>{`\\textcolor{${D}}{D}(\\textcolor{${P}}{q}\\,\\|\\,\\textcolor{${P}}{p}) = \\sum_i \\textcolor{${P}}{q}_i \\log\\frac{\\textcolor{${P}}{q}_i}{\\textcolor{${P}}{p}_i} = ${dqp.toFixed(4)}`}</Tex></div>
        <div><Tex>{`\\tfrac12 \\textcolor{${G}}{g}_{ij}\\delta^i\\delta^j = \\tfrac12\\sum_i \\frac{(\\textcolor{${P}}{q}_i - \\textcolor{${P}}{p}_i)^2}{\\textcolor{${P}}{p}_i} = ${qd.toFixed(4)}`}</Tex></div>
        <div>
          <Tex>{`\\textcolor{${D}}{D}(\\textcolor{${P}}{p}\\|\\textcolor{${P}}{q}) \\,/\\, \\textcolor{${D}}{D}(\\textcolor{${P}}{q}\\|\\textcolor{${P}}{p}) = ${dqp > 1e-9 ? (dpq / dqp).toFixed(3) : '\\text{—}'}`}</Tex>
        </div>
      </div>
      <div class="viz-controls">
        <label class="viz-slider">
          <span>곡선 수준 <Tex>{'c'}</Tex></span>
          <input type="range" min={-3} max={Math.log10(0.8)} step={0.01} value={logc}
            onInput={e => setLogc(parseFloat(e.target.value))} />
          <span class="viz-slider-val">{c.toFixed(c < 0.01 ? 4 : 3)}</span>
        </label>
        <button class="viz-btn" onClick={() => preset([0.2, 0.5, 0.3])}>멀리</button>
        <button class="viz-btn" onClick={() => preset([0.46, 0.33, 0.21])}>가까이</button>
        <span style={{ color: 'var(--fg-muted)', fontSize: '0.85em' }}>
          점 끌기 · 실선 <Tex>{`\\textcolor{${D}}{D}(\\textcolor{${P}}{p}\\|\\cdot)=c`}</Tex> · 긴 점선 <Tex>{`\\textcolor{${D}}{D}(\\cdot\\|\\textcolor{${P}}{p})=c`}</Tex> · 잔 점선 <Tex>{`\\tfrac12\\textcolor{${G}}{g}\\delta\\delta=c`}</Tex>
        </span>
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch11Viz />, el); }
