// 9장 — 측지 원판의 넓이와 스칼라 곡률.
// 곡률 K 인 곡면의 반지름 ε 측지 원판: 넓이를 평면 원판 πε² 과 비교하고, 부피 공식 1 − Rε²/24 (R = 2K) 와 대조한다.
// 색: K = gauss, R = scalar (palette.json).
import { render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas } from './shared/canvas-utils.jsx';
import { Slider } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { usePalette, HEX } from './shared/palette.js';
import { Tex } from './shared/tex.jsx';

const TAU = 2 * Math.PI;

// 곡률 K 에서 측지 원의 둘레/2π 와 원판 넓이
function sK(K, e) {
  if (Math.abs(K) < 1e-6) return e;
  return K > 0 ? Math.sin(Math.sqrt(K) * e) / Math.sqrt(K) : Math.sinh(Math.sqrt(-K) * e) / Math.sqrt(-K);
}
function areaK(K, e) {
  if (Math.abs(K) < 1e-6) return Math.PI * e * e;
  return K > 0 ? (TAU / K) * (1 - Math.cos(Math.sqrt(K) * e)) : (TAU / -K) * (Math.cosh(Math.sqrt(-K) * e) - 1);
}
const areaApprox = (K, e) => Math.PI * e * e * (1 - (K * e * e) / 12);
const eMax = (K) => (K > 0 ? Math.min(2.5, 0.97 * Math.PI / Math.sqrt(K)) : 2.5);

// 둘레가 L 인 물결 원 ρ(φ) = ε + A sin(mφ) 의 진폭 A (이분법)
function wavyAmp(e, L, m) {
  const len = (A) => {
    let s = 0; const N = 400;
    for (let i = 0; i < N; i++) {
      const f = (i / N) * TAU;
      const r = e + A * Math.sin(m * f), dr = A * m * Math.cos(m * f);
      s += Math.sqrt(r * r + dr * dr) * (TAU / N);
    }
    return s;
  };
  let lo = 0, hi = e * 0.6;
  if (len(hi) < L) return hi;
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (len(mid) < L) lo = mid; else hi = mid; }
  return lo;
}

function Ch09Viz() {
  const colors = useThemeColors();
  const pal = usePalette();
  const [K, setK] = useState(0.8);
  const [eps, setEps] = useState(1.5);
  const e = Math.min(eps, eMax(K));

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const wide = w >= 560;
    const left = wide ? { x: 0, y: 0, w: w * 0.42, h } : { x: 0, y: 0, w, h: h * 0.5 };
    const right = wide ? { x: w * 0.42, y: 0, w: w * 0.58, h } : { x: 0, y: h * 0.5, w, h: h * 0.5 };

    // ── 왼쪽: 원판을 평면에 펴 보기 ──
    const cx = left.x + left.w / 2, cy = left.y + left.h / 2 + 6;
    const scale = (Math.min(left.w, left.h) * 0.36) / 2.5;
    const R0 = e * scale;
    // 평면 원판 (같은 반지름)
    ctx.strokeStyle = colors.fgMuted; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, R0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    // 실제 원판: 둘레 2π s_K(ε)
    const circ = TAU * sK(K, e);
    ctx.fillStyle = pal.gauss; ctx.strokeStyle = pal.gauss; ctx.lineWidth = 2;
    ctx.beginPath();
    if (K >= 0) {
      const gap = TAU * (1 - circ / (TAU * e)); // 모자란 각도
      const a0 = -Math.PI / 2 + gap / 2, a1 = -Math.PI / 2 + TAU - gap / 2;
      ctx.moveTo(cx, cy); ctx.arc(cx, cy, R0, a0, a1); ctx.closePath();
    } else {
      const m = 12, A = wavyAmp(e, circ, m);
      for (let i = 0; i <= 360; i++) {
        const f = (i / 360) * TAU, r = (e + A * Math.sin(m * f)) * scale;
        const x = cx + r * Math.cos(f), y = cy + r * Math.sin(f);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    ctx.globalAlpha = 0.18; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
    ctx.fillStyle = colors.fg; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, TAU); ctx.fill();
    ctx.font = '12px sans-serif'; ctx.fillStyle = colors.fgMuted; ctx.textAlign = 'center';
    ctx.fillText(K > 0.01 ? '둘레가 모자라 쐐기가 빈다' : K < -0.01 ? '둘레가 남아 가장자리가 주름진다' : '평면과 똑같다', cx, left.y + left.h - 12);
    ctx.fillText('점선 = 같은 반지름의 평면 원', cx, left.y + 16);
    ctx.textAlign = 'left';

    // ── 오른쪽: 넓이 비율 그래프 ──
    const P = { x: right.x + 44, y: right.y + 26, w: right.w - 60, h: right.h - 60 };
    const eM = eMax(K);
    let yMin = 0.6, yMax = 1.4;
    const X = (v) => P.x + (v / 2.5) * P.w;
    const Y = (v) => P.y + P.h - ((v - yMin) / (yMax - yMin)) * P.h;
    ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
    ctx.strokeRect(P.x, P.y, P.w, P.h);
    ctx.fillStyle = colors.fgMuted; ctx.font = '11px sans-serif';
    for (const v of [0.6, 0.8, 1.0, 1.2, 1.4]) {
      ctx.fillText(v.toFixed(1), P.x - 30, Y(v) + 4);
      ctx.beginPath(); ctx.moveTo(P.x, Y(v)); ctx.lineTo(P.x + P.w, Y(v)); ctx.stroke();
    }
    for (const v of [0, 0.5, 1, 1.5, 2, 2.5]) ctx.fillText(v.toString(), X(v) - 6, P.y + P.h + 14);
    ctx.fillText('반지름 ε', P.x + P.w - 50, P.y + P.h + 28);
    ctx.fillText('넓이 ÷ πε²', P.x, P.y - 8);

    ctx.save(); ctx.beginPath(); ctx.rect(P.x, P.y, P.w, P.h); ctx.clip();
    // 평면 기준 1
    ctx.strokeStyle = colors.fgMuted; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(P.x, Y(1)); ctx.lineTo(P.x + P.w, Y(1)); ctx.stroke();
    // 근사 1 − Kε²/12
    ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const v = (i / 200) * 2.5; const y = Y(1 - K * v * v / 12); if (i === 0) ctx.moveTo(X(v), y); else ctx.lineTo(X(v), y); }
    ctx.stroke(); ctx.setLineDash([]);
    // 정확한 값
    ctx.strokeStyle = pal.scalar; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 1; i <= 300; i++) { const v = (i / 300) * eM; const y = Y(areaK(K, v) / (Math.PI * v * v)); if (i === 1) ctx.moveTo(X(v), y); else ctx.lineTo(X(v), y); }
    ctx.stroke();
    ctx.restore();
    // 현재 ε
    const yr = areaK(K, e) / (Math.PI * e * e);
    ctx.fillStyle = pal.scalar;
    ctx.beginPath(); ctx.arc(X(e), Math.max(P.y, Math.min(P.y + P.h, Y(yr))), 5, 0, TAU); ctx.fill();
    ctx.strokeStyle = colors.bg; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = '11px sans-serif';
    ctx.fillStyle = pal.scalar; ctx.fillText('— 정확한 넓이', P.x + 8, P.y + 16);
    ctx.fillStyle = colors.fgMuted; ctx.fillText('- - 부피 공식 (ε² 항까지)', P.x + 8, P.y + 32);
  };

  const canvasRef = useCanvas(drawRef);

  const Kc = HEX.gauss, Rc = HEX.scalar;
  const exact = areaK(K, e), approx = areaApprox(K, e), flat = Math.PI * e * e;
  const errPct = Math.abs(approx - exact) / exact * 100;

  return (
    <div class="viz-inner">
      <div class="viz-message">
        스칼라 곡률 <Tex>{`\\textcolor{${Rc}}{R}`}</Tex>가 양수이면 같은 반지름의 원판이 평면보다 좁고, 음수이면 넓다. 반지름이 작을수록 부피 공식의 보정 항이 정확해진다.
      </div>
      <canvas ref={canvasRef} />
      <div class="viz-formula">
        <div><Tex>{`\\textcolor{${Rc}}{R} = 2\\textcolor{${Kc}}{K} = ${(2 * K).toFixed(2)}`}</Tex><span style={{ color: 'var(--fg-muted)', marginLeft: '0.6em', fontSize: '0.9em' }}>2차원 곡면에서</span></div>
        <div><Tex>{`\\text{정확한 넓이} = ${exact.toFixed(4)}, \\qquad \\pi\\epsilon^2 = ${flat.toFixed(4)}`}</Tex></div>
        <div><Tex>{`\\pi\\epsilon^2\\left(1 - \\frac{\\textcolor{${Rc}}{R}}{24}\\epsilon^2\\right) = ${flat.toFixed(4)} \\times (1 ${-2 * K * e * e / 24 >= 0 ? '+' : '-'} ${Math.abs(2 * K * e * e / 24).toFixed(4)}) = ${approx.toFixed(4)}`}</Tex></div>
        <div style={{ color: 'var(--fg-muted)', fontSize: '0.9em' }}>근사의 상대 오차 {errPct.toFixed(2)}%</div>
      </div>
      <div class="viz-controls">
        <Slider label={<Tex>{`\\textcolor{${Kc}}{K}`}</Tex>} min={-1.5} max={1.5} step={0.01} value={K} onChange={setK} />
        <Slider label={<Tex>{`\\epsilon`}</Tex>} min={0.1} max={2.5} step={0.01} value={e} onChange={setEps} />
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch09Viz />, el); }
