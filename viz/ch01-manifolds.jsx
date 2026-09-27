// 1장 — 두 입체사영 차트로 구면 덮기.
// 구면(드래그 회전) | φ_N 평면 | φ_S 평면. 평면에서 점을 끌면 구면 위 점이 따라온다.
// 색: 차트 사상 φ = chart, 차트 좌표 (x, y) = coord (palette.json).
import { h, render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { usePalette, HEX } from './shared/palette.js';
import { Tex } from './shared/tex.jsx';
import { project3D } from './shared/math.js';

const TAU = 2 * Math.PI;
const WIN = 3.2;          // 차트 평면에 보이는 범위 [-WIN, WIN]
const FAR = 1e3;          // 이보다 크면 "무한대로 달아남"

// φ_N(p) = (X, Y)/(1 − Z),  φ_S(p) = (X, Y)/(1 + Z)
const phiN = ([X, Y, Z]) => [X / (1 - Z), Y / (1 - Z)];
const phiS = ([X, Y, Z]) => [X / (1 + Z), Y / (1 + Z)];
function invN([x, y]) {
  const r2 = x * x + y * y;
  return [2 * x / (1 + r2), 2 * y / (1 + r2), (r2 - 1) / (r2 + 1)];
}
function invS([x, y]) {
  const r2 = x * x + y * y;
  return [2 * x / (1 + r2), 2 * y / (1 + r2), (1 - r2) / (1 + r2)];
}
const normalize = (p) => { const n = Math.hypot(...p); return p.map(v => v / n); };

const PRESETS = [
  { label: '점 A', p: [0.6, 0, 0.8] },
  { label: '점 B', p: [0, -0.8, -0.6] },
  { label: '북극 가까이', p: normalize([0.03, 0.01, 1]) },
  { label: '남극 가까이', p: normalize([0.03, 0.01, -1]) },
];

function fmt(v) {
  if (!isFinite(v) || Math.abs(v) > FAR) return v > 0 ? '+\\infty' : '-\\infty';
  return v.toFixed(2);
}

function layout(w, h) {
  if (w >= 640) {
    const cw = w / 3;
    const s = Math.min(cw - 14, h - 64);
    return {
      col: cw,
      sphere: { cx: cw / 2, cy: h / 2, R: Math.min(cw / 2 - 16, h / 2 - 40) },
      N: { x: cw + (cw - s) / 2, y: (h - s) / 2 + 8, s },
      S: { x: 2 * cw + (cw - s) / 2, y: (h - s) / 2 + 8, s },
    };
  }
  const half = w / 2;
  const s = Math.min(half - 16, h / 2 - 34);
  return {
    col: half,
    sphere: { cx: half / 2, cy: h / 2, R: Math.min(half / 2 - 10, h / 2 - 30) },
    N: { x: half + (half - s) / 2, y: 24, s },
    S: { x: half + (half - s) / 2, y: h / 2 + 24, s },
  };
}

// 차트 평면 좌표 ↔ 화면
const toScr = (P, [x, y]) => [P.x + P.s / 2 + (x / WIN) * P.s / 2, P.y + P.s / 2 - (y / WIN) * P.s / 2];
const fromScr = (P, sx, sy) => [((sx - P.x - P.s / 2) / (P.s / 2)) * WIN, -((sy - P.y - P.s / 2) / (P.s / 2)) * WIN];
const inside = (P, sx, sy) => sx >= P.x && sx <= P.x + P.s && sy >= P.y && sy <= P.y + P.s;

function Ch01Viz() {
  const colors = useThemeColors();
  const pal = usePalette();
  const pRef = useRef(PRESETS[0].p);
  const rot = useRef({ y: -0.5, x: 0.35 });
  const drag = useRef(null);
  const [readP, setReadP] = useState(PRESETS[0].p);
  const [inp, setInp] = useState(['0.6', '0', '0.8']);
  const [inpNote, setInpNote] = useState('');
  const pending = useRef(false);

  // 수식 패널은 프레임당 한 번만 갱신
  function setPoint(p) {
    pRef.current = p;
    if (!pending.current) {
      pending.current = true;
      requestAnimationFrame(() => { pending.current = false; setReadP(pRef.current); });
    }
  }

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const L = layout(w, h);
    const p = pRef.current;
    const { y: ry, x: rx } = rot.current;
    const { cx, cy, R } = L.sphere;
    const pr = (q) => project3D([q[0] * R, q[2] * R, q[1] * R], cx, cy, 1, ry, rx); // Z 를 화면 위쪽으로

    // ── 구면 ──
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();

    function curve3(fn, n, style, width, dash) {
      ctx.strokeStyle = style; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      let on = false;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const q = pr(fn(i / n));
        if (q.z >= 0) { if (!on) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); on = true; }
        else on = false;
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    for (const Z of [-0.866, -0.5, 0.5, 0.866]) {
      const r = Math.sqrt(1 - Z * Z);
      curve3(t => [r * Math.cos(TAU * t), r * Math.sin(TAU * t), Z], 72, colors.border, 1);
    }
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI;
      curve3(t => [Math.cos(a) * Math.sin(TAU * t), Math.sin(a) * Math.sin(TAU * t), Math.cos(TAU * t)], 96, colors.border, 1);
    }
    curve3(t => [Math.cos(TAU * t), Math.sin(TAU * t), 0], 96, colors.fgMuted, 1.5, [5, 4]); // 적도

    // 극점
    for (const [q, name] of [[[0, 0, 1], 'N'], [[0, 0, -1], 'S']]) {
      const s = pr(q);
      ctx.globalAlpha = s.z >= 0 ? 1 : 0.35;
      ctx.fillStyle = pal.chart;
      ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, TAU); ctx.fill();
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(name === 'N' ? '북극' : '남극', s.x + 7, s.y + (name === 'N' ? -4 : 12));
      ctx.globalAlpha = 1;
    }

    // 북극에서 비춘 빛: 북극 → p → 적도면 위 φ_N(p)
    const uN = phiN(p);
    const rN = Math.hypot(...uN);
    if (rN < 6) {
      // 남반구 점은 광선이 적도면을 먼저 지나 p 에 닿는다
      const a = pr([0, 0, 1]), b = pr([uN[0], uN[1], 0]), end = p[2] < 0 ? pr(p) : b;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, L.col, h); ctx.clip();
      ctx.strokeStyle = pal.chart; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(end.x, end.y); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal.coord;
      ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // 점 p
    const ps = pr(p);
    ctx.fillStyle = colors.fg;
    ctx.globalAlpha = ps.z >= 0 ? 1 : 0.4;
    ctx.beginPath(); ctx.arc(ps.x, ps.y, 6, 0, TAU); ctx.fill();
    ctx.strokeStyle = colors.bg; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.fgMuted;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('구면 (끌어서 회전)', cx, cy + R + 26);
    ctx.textAlign = 'left';

    // ── 차트 평면 두 장 ──
    function chartPanel(P, which) {
      const u = which === 'N' ? phiN(p) : phiS(p);
      ctx.save();
      ctx.beginPath(); ctx.rect(P.x, P.y, P.s, P.s); ctx.clip();
      ctx.fillStyle = colors.bg; ctx.fillRect(P.x, P.y, P.s, P.s);

      // 북반구 영역 음영: φ_N 에서는 단위원 밖, φ_S 에서는 단위원 안
      const [ox, oy] = toScr(P, [0, 0]);
      const unit = P.s / 2 / WIN;
      ctx.fillStyle = colors.fgMuted; ctx.globalAlpha = 0.09;
      ctx.beginPath();
      if (which === 'N') { ctx.rect(P.x, P.y, P.s, P.s); ctx.arc(ox, oy, unit, 0, TAU, true); }
      else ctx.arc(ox, oy, unit, 0, TAU);
      ctx.fill(); ctx.globalAlpha = 1;

      // 축과 격자
      ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
      for (let k = -3; k <= 3; k++) {
        const [gx] = toScr(P, [k, 0]); const [, gy] = toScr(P, [0, k]);
        ctx.beginPath(); ctx.moveTo(gx, P.y); ctx.lineTo(gx, P.y + P.s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(P.x, gy); ctx.lineTo(P.x + P.s, gy); ctx.stroke();
      }
      // 위도선의 그림자
      for (const Z of [-0.866, -0.5, 0.5, 0.866]) {
        const r = which === 'N' ? Math.sqrt((1 + Z) / (1 - Z)) : Math.sqrt((1 - Z) / (1 + Z));
        ctx.beginPath(); ctx.arc(ox, oy, r * unit, 0, TAU); ctx.stroke();
      }
      // 적도 = 단위원
      ctx.strokeStyle = colors.fgMuted; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.arc(ox, oy, unit, 0, TAU); ctx.stroke(); ctx.setLineDash([]);

      // 점
      const r = Math.hypot(...u);
      if (isFinite(r) && Math.abs(u[0]) < WIN && Math.abs(u[1]) < WIN) {
        const [sx, sy] = toScr(P, u);
        ctx.fillStyle = pal.coord;
        ctx.beginPath(); ctx.arc(sx, sy, 6, 0, TAU); ctx.fill();
        ctx.strokeStyle = colors.bg; ctx.lineWidth = 2; ctx.stroke();
      } else {
        // 화면 밖: 가장자리에 화살표
        const ang = isFinite(r) && r > 0 ? Math.atan2(u[1], u[0]) : 0;
        const ex = ox + Math.cos(ang) * (P.s / 2 - 12), ey = oy - Math.sin(ang) * (P.s / 2 - 12);
        ctx.fillStyle = pal.coord;
        ctx.save(); ctx.translate(ex, ey); ctx.rotate(-ang);
        ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      ctx.strokeStyle = pal.chart; ctx.lineWidth = 2;
      ctx.strokeRect(P.x, P.y, P.s, P.s);
      // 제목: φ 에 아래첨자
      ctx.fillStyle = pal.chart;
      ctx.font = 'italic bold 15px serif';
      ctx.fillText('φ', P.x, P.y - 8);
      const fw = ctx.measureText('φ').width;
      ctx.font = 'italic bold 10px serif';
      ctx.fillText(which, P.x + fw + 1, P.y - 4);
      ctx.font = 'bold 12px sans-serif';
      const wide = w >= 640;
      ctx.fillText(which === 'N' ? (wide ? '평면 · 북극에서 비춤' : '북극에서') : (wide ? '평면 · 남극에서 비춤' : '남극에서'), P.x + fw + 14, P.y - 8);
    }
    chartPanel(L.N, 'N');
    chartPanel(L.S, 'S');
  };

  const canvasRef = useCanvas(drawRef);

  usePointer(canvasRef, {
    onDown: (pos) => {
      const c = canvasRef.current;
      const L = layout(c.clientWidth, c.clientHeight);
      if (inside(L.N, pos.x, pos.y)) drag.current = { kind: 'N', P: L.N };
      else if (inside(L.S, pos.x, pos.y)) drag.current = { kind: 'S', P: L.S };
      else drag.current = { kind: 'rot', mx: pos.x, my: pos.y, ry: rot.current.y, rx: rot.current.x };
      if (drag.current.kind !== 'rot') moveTo(pos);
    },
    onDrag: (pos) => {
      const d = drag.current;
      if (!d) return;
      if (d.kind === 'rot') {
        rot.current = {
          y: d.ry + (pos.x - d.mx) * 0.01,
          x: Math.max(-1.4, Math.min(1.4, d.rx + (pos.y - d.my) * 0.01)),
        };
      } else moveTo(pos);
    },
    onUp: () => { drag.current = null; },
  });

  function moveTo(pos) {
    const d = drag.current;
    const u = fromScr(d.P, pos.x, pos.y);
    setPoint(d.kind === 'N' ? invN(u) : invS(u));
  }

  // 문제 2 풀이 비교용: (X, Y, Z) 를 직접 넣어 점을 찍는다. 단위구 밖이면 단위구로 끌어당긴다.
  function applyInput() {
    const q = inp.map(v => parseFloat(v));
    if (q.some(v => !isFinite(v))) { setInpNote('숫자 세 개를 넣어 주세요'); return; }
    const n = Math.hypot(...q);
    if (n === 0) { setInpNote('(0, 0, 0)은 구면 위의 점이 아닙니다'); return; }
    setInpNote(Math.abs(n - 1) > 1e-3 ? `길이가 ${n.toFixed(3)}이라 단위구 위로 옮겼습니다` : '');
    setPoint(q.map(v => v / n));
  }

  // ── 수식 패널 ──
  const C = HEX.coord, H = HEX.chart;
  const uN = phiN(readP), uS = phiS(readP);
  const nFar = !(Math.hypot(...uN) < FAR);
  const r2 = uN[0] * uN[0] + uN[1] * uN[1];
  const tr = [uN[0] / r2, uN[1] / r2];
  const xy = (u) => `(\\textcolor{${C}}{${fmt(u[0])}},\\ \\textcolor{${C}}{${fmt(u[1])}})`;

  return (
    <div class="viz-inner">
      <div class="viz-message">
        점을 북극으로 끌고 가면 <Tex>{`\\textcolor{${H}}{\\varphi_N}`}</Tex> 좌표는 무한대로 달아나지만 <Tex>{`\\textcolor{${H}}{\\varphi_S}`}</Tex> 좌표는 멀쩡하다. 겹치는 곳에서 두 좌표는 언제나 반전 규칙으로 이어진다.
      </div>
      <canvas ref={canvasRef} />
      <div class="viz-formula">
        <div>
          <Tex>{`p = (${readP.map(v => v.toFixed(2)).join(',\\ ')})`}</Tex>
          <span style={{ color: 'var(--fg-muted)', marginLeft: '0.6em', fontSize: '0.9em' }}>구면 위 점의 3차원 위치</span>
        </div>
        <div>
          <Tex>{`\\textcolor{${H}}{\\varphi_N}(p) = ${xy(uN)}`}</Tex>
          {nFar && <span style={{ color: 'var(--fg-muted)', marginLeft: '0.6em', fontSize: '0.9em' }}>북극은 이 차트에 없다</span>}
        </div>
        <div><Tex>{`\\textcolor{${H}}{\\varphi_S}(p) = ${xy(uS)}`}</Tex></div>
        <div>
          <Tex>{`\\textcolor{${H}}{\\varphi_S}\\circ\\textcolor{${H}}{\\varphi_N}^{-1}(\\textcolor{${C}}{x},\\textcolor{${C}}{y}) = \\frac{(\\textcolor{${C}}{x},\\textcolor{${C}}{y})}{\\textcolor{${C}}{x}^2+\\textcolor{${C}}{y}^2} = ${isFinite(r2) && r2 > 0 ? xy(tr) : '\\text{(정의되지 않음)}'}`}</Tex>
        </div>
      </div>
      <div class="viz-controls">
        {PRESETS.map(pr => (
          <button class="viz-btn" onClick={() => setPoint(pr.p)}>{pr.label}</button>
        ))}
        <span class="viz-inputs">
          {['X', 'Y', 'Z'].map((nm, i) => (
            <label>{nm} <input class="viz-num" type="number" step="0.1" value={inp[i]}
              onInput={(e) => { const v = inp.slice(); v[i] = e.target.value; setInp(v); }}
              onKeyDown={(e) => { if (e.key === 'Enter') applyInput(); }} /></label>
          ))}
          <button class="viz-btn" onClick={applyInput}>이 점 찍기</button>
          {inpNote && <span style={{ color: 'var(--fg-muted)', fontSize: '0.85em' }}>{inpNote}</span>}
        </span>
        <span style={{ color: 'var(--fg-muted)', fontSize: '0.85em' }}>평면에서 점을 끌기 · 구면을 끌어 회전 · 회색 음영 = 북반구 · 점선 = 적도</span>
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch01Viz />, el); }
