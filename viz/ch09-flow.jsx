// 9장 — 둥근 구의 리치 흐름: r(t)² = r0² − 2(n−1)t, 스칼라 곡률 R = n(n−1)/r².
// 구면(드래그 회전) | r² 와 R 의 시간 그래프. 재생 중 시간은 ref 로만 갱신한다.
// 색: 계량(r² 에 비례) = metric, 스칼라 곡률 = scalar.
import { render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { usePalette, HEX } from './shared/palette.js';
import { Tex } from './shared/tex.jsx';
import { project3D, sphereToCart } from './shared/math.js';

const TAU = 2 * Math.PI;
const R0 = 1;

const tEnd = (n) => (R0 * R0) / (2 * (n - 1));
const r2At = (n, t) => Math.max(0, R0 * R0 - 2 * (n - 1) * t);

function Ch09Flow() {
  const colors = useThemeColors();
  const pal = usePalette();
  const [n, setN] = useState(2);
  const [shown, setShown] = useState(0);   // 수식 패널용 시간 (프레임당 한 번)
  const [playing, setPlaying] = useState(false);
  const tRef = useRef(0);
  const nRef = useRef(2);
  const playRef = useRef(false);
  const lastRef = useRef(null);
  const rot = useRef({ y: 0.5, x: 0.35 });
  const drag = useRef(null);
  const pending = useRef(false);

  function setT(t) {
    tRef.current = t;
    if (!pending.current) {
      pending.current = true;
      requestAnimationFrame(() => { pending.current = false; setShown(tRef.current); });
    }
  }

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const nn = nRef.current, T = tEnd(nn);
    // 재생: 소멸 시각까지 약 5초
    const now = performance.now();
    if (playRef.current) {
      const dt = lastRef.current ? (now - lastRef.current) / 1000 : 0;
      let t = tRef.current + dt * T / 5;
      if (t >= T * 0.995) { t = T * 0.995; playRef.current = false; setPlaying(false); }
      setT(t);
    }
    lastRef.current = now;
    const t = tRef.current;
    const r = Math.sqrt(r2At(nn, t));

    const wide = w >= 560;
    const L = wide ? { x: 0, w: w * 0.42, h } : { x: 0, w, h: h * 0.5 };
    const G = wide ? { x: w * 0.42 + 44, y: 28, w: w * 0.58 - 64, h: h - 66 } : { x: 36, y: h * 0.5 + 34, w: w - 52, h: h * 0.5 - 66 };

    // ── 구면 ──
    const cx = L.x + L.w / 2, cy = (wide ? h : L.h) / 2;
    const S = Math.min(L.w, wide ? h : L.h) * (wide ? 0.4 : 0.34);
    const { y: ry, x: rx } = rot.current;
    ctx.strokeStyle = colors.border; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, S * R0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = pal.metric; ctx.lineWidth = 1;
    const line = (fn) => {
      let on = false; ctx.beginPath();
      for (let j = 0; j <= 48; j++) {
        const q = project3D(fn(j / 48), cx, cy, 1, ry, rx);
        if (q.z >= 0) { if (on) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); on = true; } else on = false;
      }
      ctx.stroke();
    };
    for (let i = 1; i < 6; i++) line(s => sphereToCart((i / 6) * Math.PI, s * TAU, r * S));
    for (let i = 0; i < 12; i++) line(s => sphereToCart(s * Math.PI, (i / 12) * TAU, r * S));
    ctx.strokeStyle = pal.metric; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r * S, 0, TAU); ctx.stroke();
    ctx.fillStyle = colors.fgMuted; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(nn === 2 ? '구면 S² (끌어서 회전)' : `S${nn === 3 ? '³' : '⁴'} 의 한 단면 (끌어서 회전)`, cx, cy + S + (wide ? 22 : 14));
    ctx.fillText('점선 = 처음 크기', cx, 16);
    ctx.textAlign = 'left';

    // ── 그래프: r² (계량) 와 R (스칼라 곡률) ──
    const X = (v) => G.x + (v / tEnd(2)) * G.w; // 가로축은 n=2 의 소멸 시각까지 고정
    const Yr = (v) => G.y + G.h - (v / 1.1) * G.h;
    const Rmax = 40;
    const YR = (v) => G.y + G.h - (Math.min(v, Rmax) / Rmax) * G.h;
    ctx.strokeStyle = colors.border; ctx.lineWidth = 1; ctx.strokeRect(G.x, G.y, G.w, G.h);
    ctx.fillStyle = colors.fgMuted; ctx.font = '11px sans-serif';
    for (const v of [0, 0.25, 0.5]) ctx.fillText(v.toFixed(2), X(v) - 10, G.y + G.h + 14);
    ctx.fillText('시간 t', G.x + G.w - 34, G.y + G.h + 28);
    ctx.fillStyle = pal.metric; ctx.fillText('1', G.x - 14, Yr(1) + 4); ctx.fillText('0', G.x - 14, Yr(0));

    ctx.save(); ctx.beginPath(); ctx.rect(G.x, G.y, G.w, G.h); ctx.clip();
    const Tn = tEnd(nn);
    ctx.strokeStyle = pal.metric; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(0), Yr(1)); ctx.lineTo(X(Tn), Yr(0)); ctx.stroke();
    ctx.strokeStyle = pal.scalar; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 300; i++) {
      const tt = (i / 300) * Tn * 0.999, v = (nn * (nn - 1)) / r2At(nn, tt);
      if (i === 0) ctx.moveTo(X(tt), YR(v)); else ctx.lineTo(X(tt), YR(v));
    }
    ctx.stroke();
    ctx.strokeStyle = colors.fgMuted; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(X(Tn), G.y); ctx.lineTo(X(Tn), G.y + G.h); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    ctx.fillStyle = colors.fgMuted; ctx.fillText('소멸', X(Tn) - 12, G.y - 6);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = pal.metric; ctx.fillText(wide ? '— r²  (계량의 크기, 왼쪽 눈금)' : '— r²', G.x + 8, G.y + 16);
    ctx.fillStyle = pal.scalar; ctx.fillText(wide ? `— R  스칼라 곡률 (위 끝 = ${Rmax})` : `— R (위 끝 ${Rmax})`, wide ? G.x + 8 : G.x + 60, wide ? G.y + 32 : G.y + 16);
    // 현재 시각
    ctx.fillStyle = pal.metric; ctx.beginPath(); ctx.arc(X(t), Yr(r * r), 5, 0, TAU); ctx.fill();
    const Rv = (nn * (nn - 1)) / Math.max(r * r, 1e-9);
    if (Rv <= Rmax) { ctx.fillStyle = pal.scalar; ctx.beginPath(); ctx.arc(X(t), YR(Rv), 5, 0, TAU); ctx.fill(); }
  };

  const canvasRef = useCanvas(drawRef);
  usePointer(canvasRef, {
    onDown: (p) => { drag.current = { mx: p.x, my: p.y, ...rot.current }; },
    onDrag: (p) => {
      const d = drag.current; if (!d) return;
      rot.current = { y: d.y + (p.x - d.mx) * 0.01, x: Math.max(-1.4, Math.min(1.4, d.x + (p.y - d.my) * 0.01)) };
    },
    onUp: () => { drag.current = null; },
  });

  function choose(k) { nRef.current = k; setN(k); setT(Math.min(tRef.current, tEnd(k) * 0.995)); }
  function toggle() {
    if (!playRef.current && tRef.current >= tEnd(nRef.current) * 0.99) setT(0);
    playRef.current = !playRef.current; lastRef.current = null; setPlaying(playRef.current);
  }

  const M = HEX.metric, Rc = HEX.scalar;
  const T = tEnd(n), r2 = r2At(n, shown), Rv = (n * (n - 1)) / r2;

  return (
    <div class="viz-inner">
      <div class="viz-message">
        둥근 구에 리치 흐름을 걸면 모양은 그대로 둔 채 반지름의 제곱만 일정한 속도로 줄어들고, 곡률은 점점 커지다가 소멸 순간에 무한대가 된다.
      </div>
      <canvas ref={canvasRef} />
      <div class="viz-formula">
        <div><Tex>{`\\frac{\\partial \\textcolor{${M}}{g}_{ij}}{\\partial t} = -2\\,\\textcolor{${HEX.ricci}}{R}_{ij} = -\\frac{2(n-1)}{r^2}\\,\\textcolor{${M}}{g}_{ij} \\;\\Rightarrow\\; r(t)^2 = 1 - ${2 * (n - 1)}t`}</Tex></div>
        <div><Tex>{`t = ${shown.toFixed(3)}, \\quad r^2 = ${r2.toFixed(3)}, \\quad \\textcolor{${Rc}}{R} = \\frac{n(n-1)}{r^2} = ${Rv.toFixed(2)}, \\quad \\text{소멸 시각 } T = \\frac{1}{2(n-1)} = ${T.toFixed(3)}`}</Tex></div>
      </div>
      <div class="viz-controls">
        <button class="viz-btn" onClick={toggle}>{playing ? '멈춤' : '흐름 재생'}</button>
        <label class="viz-slider">
          <span>시간 <Tex>t</Tex></span>
          <input type="range" min={0} max={T * 0.995} step={T / 500} value={shown}
            onInput={(e) => { playRef.current = false; setPlaying(false); setT(parseFloat(e.target.value)); }} />
        </label>
        {[2, 3, 4].map(k => (
          <button class={'viz-btn' + (n === k ? ' active' : '')} onClick={() => choose(k)}>{`n = ${k}`}</button>
        ))}
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch09Flow />, el); }
