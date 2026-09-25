// 3장 — 포앙카레 원판의 "늘어나는 자".
// 점 P 를 끌면 P 둘레의 쌍곡 반지름 0.5 원, 중심→P 방향 눈금(쌍곡 거리 0.5 간격), 실제 거리를 보여 준다.
// 쌍곡 원은 유클리드 원이다: 중심에서 쌍곡 거리 s 인 점의 유클리드 반지름은 tanh(s/2).
// 색: 좌표 x, y = coord / 계량·실제 거리 눈금 = metric (palette.json).
import { render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { usePalette, HEX } from './shared/palette.js';
import { Tex } from './shared/tex.jsx';

const TAU = 2 * Math.PI;
const RHO = 0.5;       // 쌍곡 반지름
const MAXR = 0.995;
const dist0 = (r) => Math.log((1 + r) / (1 - r)); // 중심에서의 쌍곡 거리
const rOf = (d) => Math.tanh(d / 2);

function Ch03Poincare() {
  const colors = useThemeColors();
  const pal = usePalette();
  const pRef = useRef([0.45, 0.25]);
  const [readP, setReadP] = useState(pRef.current);
  const pending = useRef(false);
  const drag = useRef(false);

  function setP(p) {
    const r = Math.hypot(...p);
    if (r > MAXR) p = p.map(v => v * MAXR / r);
    pRef.current = p;
    if (!pending.current) {
      pending.current = true;
      requestAnimationFrame(() => { pending.current = false; setReadP(pRef.current); });
    }
  }

  const geo = (w, h) => {
    const Rd = Math.min(w, h) / 2 - 16;
    return { cx: w / 2, cy: h / 2, Rd };
  };

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const { cx, cy, Rd } = geo(w, h);
    const S = ([x, y]) => [cx + x * Rd, cy - y * Rd];
    ctx.fillStyle = colors.bg;
    ctx.beginPath(); ctx.arc(cx, cy, Rd, 0, TAU); ctx.fill();

    // 중심에서 쌍곡 거리 1, 2, 3, 4, 5 인 원
    ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
    ctx.fillStyle = colors.fgMuted; ctx.font = '11px sans-serif';
    for (let d = 1; d <= 5; d++) {
      const r = rOf(d);
      ctx.beginPath(); ctx.arc(cx, cy, r * Rd, 0, TAU); ctx.stroke();
      if (d <= 3) ctx.fillText(`${d}`, cx + 3, cy - r * Rd - 3);
    }
    // 지름 몇 개 (측지선)
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * Rd, cy - Math.sin(a) * Rd);
      ctx.lineTo(cx - Math.cos(a) * Rd, cy + Math.sin(a) * Rd);
      ctx.stroke();
    }
    ctx.strokeStyle = colors.fgMuted; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, Rd, 0, TAU); ctx.stroke();

    // 같은 쌍곡 반지름 0.5 인 원들을 한 지름 위에 늘어놓기 (크기 비교)
    for (let d = -4; d <= 4; d++) {
      const s0 = d * 1.0;
      const a = Math.tanh((s0 - RHO) / 2), b = Math.tanh((s0 + RHO) / 2);
      const [x] = S([(a + b) / 2, 0]);
      ctx.strokeStyle = pal.metric; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, cy + Rd * 0.0, ((b - a) / 2) * Rd, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const p = pRef.current;
    const r = Math.hypot(...p);
    const u = r > 1e-6 ? [p[0] / r, p[1] / r] : [1, 0];
    const s = dist0(r);

    // 중심 → P 방향의 자: 쌍곡 거리 0.5 마다 눈금
    const [ox, oy] = S([0, 0]);
    const [px, py] = S(p);
    ctx.strokeStyle = pal.metric; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(px, py); ctx.stroke();
    ctx.lineWidth = 1.5;
    for (let t = 0.5; t < s + 1e-9; t += 0.5) {
      const rr = rOf(t);
      const [tx, ty] = S([u[0] * rr, u[1] * rr]);
      const nx = -u[1] * 6, ny = -u[0] * 6;
      ctx.beginPath(); ctx.moveTo(tx - nx, ty - ny); ctx.lineTo(tx + nx, ty + ny); ctx.stroke();
    }

    // P 둘레의 쌍곡 반지름 0.5 원 (유클리드 중심은 P 보다 바깥쪽)
    const a = Math.tanh((s - RHO) / 2), b = Math.tanh((s + RHO) / 2);
    const ec = (a + b) / 2, er = (b - a) / 2;
    const [ecx, ecy] = S([u[0] * ec, u[1] * ec]);
    ctx.fillStyle = pal.metric; ctx.globalAlpha = 0.18;
    ctx.beginPath(); ctx.arc(ecx, ecy, er * Rd, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = pal.metric; ctx.lineWidth = 2; ctx.stroke();

    ctx.fillStyle = pal.coord;
    ctx.beginPath(); ctx.arc(px, py, 6, 0, TAU); ctx.fill();
    ctx.strokeStyle = colors.bg; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = colors.fg; ctx.font = 'italic 14px serif';
    ctx.fillText('P', px + 8, py - 8);

    ctx.fillStyle = colors.fgMuted; ctx.font = '12px sans-serif';
    ctx.fillText('점 P 를 끌기', 10, h - 10);
  };

  const canvasRef = useCanvas(drawRef);
  function pick(q) {
    const c = canvasRef.current;
    const { cx, cy, Rd } = geo(c.clientWidth, c.clientHeight);
    setP([(q.x - cx) / Rd, -(q.y - cy) / Rd]);
  }
  usePointer(canvasRef, {
    onDown: (q) => { drag.current = true; pick(q); },
    onDrag: (q) => { if (drag.current) pick(q); },
    onUp: () => { drag.current = false; },
  });

  const C = HEX.coord, M = HEX.metric;
  const r = Math.hypot(...readP);
  const lam = 2 / (1 - r * r);
  const d = dist0(r);

  return (
    <div class="viz-inner">
      <div class="viz-message">
        점을 가장자리로 끌어 보자. 쌍곡 거리 0.5짜리 원이 점점 작아지고, 중심에서의 실제 거리는 끝없이 커진다. 옅은 원들은 모두 반지름이 똑같이 0.5인 원이다.
      </div>
      <canvas ref={canvasRef} />
      <div class="viz-formula">
        <div>
          <Tex>{`\\textcolor{${M}}{ds} = \\frac{2}{1-\\textcolor{${C}}{x}^2-\\textcolor{${C}}{y}^2}\\sqrt{d\\textcolor{${C}}{x}^2+d\\textcolor{${C}}{y}^2},\\qquad P = (\\textcolor{${C}}{${readP[0].toFixed(2)}},\\ \\textcolor{${C}}{${readP[1].toFixed(2)}})`}</Tex>
        </div>
        <div>
          <Tex>{`\\text{눈금 배율 } \\frac{2}{1 - r^2} = ${lam.toFixed(2)}\\quad(r = ${r.toFixed(3)})`}</Tex>
          <span style={{ color: 'var(--fg-muted)', marginLeft: '0.6em', fontSize: '0.9em' }}>그림 위 1칸이 실제로는 이만큼</span>
        </div>
        <div>
          <Tex>{`\\text{중심에서 실제 거리 } \\ln\\frac{1+r}{1-r} = ${d.toFixed(2)}`}</Tex>
          <span style={{ color: 'var(--fg-muted)', marginLeft: '0.6em', fontSize: '0.9em' }}>눈금 하나 = 실제 거리 0.5</span>
        </div>
      </div>
      <div class="viz-controls">
        {[[0, 0], [0.5, 0], [0.9, 0], [0.99, 0]].map(q => (
          <button class="viz-btn" onClick={() => setP(q)}>{`r = ${q[0]}`}</button>
        ))}
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch03Poincare />, el); }
