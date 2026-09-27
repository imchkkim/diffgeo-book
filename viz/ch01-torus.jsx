// 1장 — 팩맨 화면 두 장(φ_A, φ_B)으로 토러스 덮기.
// 토러스(드래그 회전) | 화면 A | 화면 B. 화면에서 팩맨을 끌거나 좌표를 넣으면 세 곳이 함께 움직인다.
// 화면 B 는 화면 A 를 가로·세로로 5칸씩 옮긴 것: 각 좌표마다 5보다 작으면 +5, 크면 −5.
// 색: 차트 사상 φ = chart, 차트 좌표 (x, y) = coord, A 의 이음매 = aux3, B 의 이음매 = aux2 (palette.json).
import { h, render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { usePalette, HEX } from './shared/palette.js';
import { Tex } from './shared/tex.jsx';
import { project3D } from './shared/math.js';

const TAU = 2 * Math.PI;
const L = 10;            // 화면 한 변의 길이
const RB = 1, RS = 0.42; // 토러스의 큰 반지름, 튜브 반지름
const EPS = 1e-9;

const wrap = (v) => ((v % L) + L) % L;               // 토러스 위 위치를 [0, 10) 으로
const toB = ([x, y]) => [wrap(x + L / 2), wrap(y + L / 2)];
const fromB = ([x, y]) => [wrap(x - L / 2), wrap(y - L / 2)];
const onSeam = (v) => v < EPS || L - v < EPS;           // 화면 가장자리(이음매) 위인가
// 화면 A 좌표 (x, y) → 토러스 위 3차원 점. x 는 큰 원을 따라, y 는 튜브를 따라 돈다.
function torusPt(x, y, lift = 0) {
  const t = (x / L) * TAU, f = (y / L) * TAU, r = RS + lift;
  return [(RB + r * Math.cos(f)) * Math.cos(t), (RB + r * Math.cos(f)) * Math.sin(t), r * Math.sin(f)];
}
const torusN = (x, y) => {
  const t = (x / L) * TAU, f = (y / L) * TAU;
  return [Math.cos(f) * Math.cos(t), Math.cos(f) * Math.sin(t), Math.sin(f)];
};

const START = [8, 3];

function layout(w, h) {
  if (w >= 640) {
    const cw = w / 3;
    const s = Math.min(cw - 30, h - 70);
    return {
      col: cw,
      torus: { cx: cw / 2, cy: h / 2 - 6, R: Math.min(cw / 2 - 12, h / 2 - 30) / (RB + RS) },
      A: { x: cw + (cw - s) / 2, y: (h - s) / 2 + 6, s },
      B: { x: 2 * cw + (cw - s) / 2, y: (h - s) / 2 + 6, s },
    };
  }
  const half = w / 2;
  const s = Math.min(half - 30, h / 2 - 40);
  return {
    col: half,
    torus: { cx: half / 2, cy: h / 2, R: Math.min(half / 2 - 8, h / 2 - 30) / (RB + RS) },
    A: { x: half + (half - s) / 2, y: 26, s },
    B: { x: half + (half - s) / 2, y: h / 2 + 26, s },
  };
}
// 화면 좌표 (0~10, 위쪽이 +y) ↔ 캔버스
const toScr = (P, [x, y]) => [P.x + (x / L) * P.s, P.y + P.s - (y / L) * P.s];
const fromScr = (P, sx, sy) => [((sx - P.x) / P.s) * L, ((P.y + P.s - sy) / P.s) * L];
const inside = (P, sx, sy) => sx >= P.x && sx <= P.x + P.s && sy >= P.y && sy <= P.y + P.s;

const fmt = (v) => (Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(1));

function Ch01TorusViz() {
  const colors = useThemeColors();
  const pal = usePalette();
  const pRef = useRef(START);          // 화면 A 기준 위치 [0, 10)²
  const trail = useRef([START]);       // 지나온 자취 (화면 A 기준, 감기 전 값)
  const rot = useRef({ y: 0.3, x: 0.95 });
  const drag = useRef(null);
  const [readP, setReadP] = useState(START);
  const [inp, setInp] = useState(['8', '3']);
  const pending = useRef(false);

  function setPoint(p, keepTrail) {
    const q = [wrap(p[0]), wrap(p[1])];
    pRef.current = q;
    trail.current = keepTrail ? [...trail.current, p].slice(-60) : [q];
    if (!pending.current) {
      pending.current = true;
      requestAnimationFrame(() => { pending.current = false; setReadP(pRef.current); });
    }
  }
  // 한 칸 이동: 자취는 감기 전 값으로 이어 붙여 두 화면에서 각각 끊김을 판단한다
  function step(dx, dy) {
    const last = trail.current[trail.current.length - 1] || pRef.current;
    const n = 8;
    const pts = [];
    for (let i = 1; i <= n; i++) pts.push([last[0] + (dx * i) / n, last[1] + (dy * i) / n]);
    trail.current = [...trail.current, ...pts].slice(-80);
    const end = pts[pts.length - 1];
    pRef.current = [wrap(end[0]), wrap(end[1])];
    setReadP(pRef.current);
  }

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const Ly = layout(w, h);
    const p = pRef.current;
    const { y: ry, x: rx } = rot.current;
    const { cx, cy, R } = Ly.torus;
    // Z 를 화면 위쪽으로
    const pr = (q) => project3D([q[0] * R, q[2] * R, q[1] * R], cx, cy, 1, ry, rx);
    const facing = (x, y) => project3D(((n) => [n[0], n[2], n[1]])(torusN(x, y)), 0, 0, 1, ry, rx).z;

    // ── 토러스 면: 사각형 조각을 먼 것부터 칠하고(화가 알고리즘), 격자·이음매는 조각의 변으로 그린다 ──
    const NT = 60, NF = 30;               // 가로 10칸 × 6, 세로 10칸 × 3
    const quads = [];
    for (let i = 0; i < NT; i++) for (let j = 0; j < NF; j++) {
      const x0 = (i / NT) * L, x1 = ((i + 1) / NT) * L, y0 = (j / NF) * L, y1 = ((j + 1) / NF) * L;
      const c = [pr(torusPt(x0, y0)), pr(torusPt(x1, y0)), pr(torusPt(x1, y1)), pr(torusPt(x0, y1))];
      quads.push({ i, j, c, z: (c[0].z + c[1].z + c[2].z + c[3].z) / 4, f: facing((x0 + x1) / 2, (y0 + y1) / 2) });
    }
    quads.sort((a, b) => a.z - b.z);
    const edge = (P0, P1, style, width, dash) => {
      ctx.strokeStyle = style; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      ctx.beginPath(); ctx.moveTo(P0.x, P0.y); ctx.lineTo(P1.x, P1.y); ctx.stroke(); ctx.setLineDash([]);
    };
    for (const q of quads) {
      const { c, i, j } = q;
      const shade = 0.35 + 0.65 * Math.max(0, q.f);
      ctx.fillStyle = colors.bg;
      ctx.beginPath(); ctx.moveTo(c[0].x, c[0].y); for (let k = 1; k < 4; k++) ctx.lineTo(c[k].x, c[k].y); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.28 * (1 - shade) + 0.04;
      ctx.fillStyle = colors.fg; ctx.fill();
      ctx.globalAlpha = 1;
      // 세로선 x = i/6 (왼쪽 변), 가로선 y = j/3 (아래 변)
      if (i === 0) edge(c[0], c[3], pal.aux3, 2.5);
      else if (i === NT / 2) edge(c[0], c[3], pal.aux2, 2.5, [5, 3]);
      else if (i % 6 === 0) edge(c[0], c[3], colors.border, 1);
      if (j === 0) edge(c[0], c[1], pal.aux3, 2.5);
      else if (j === NF / 2) edge(c[0], c[1], pal.aux2, 2.5, [5, 3]);
      else if (j % 3 === 0) edge(c[0], c[1], colors.border, 1);
    }

    // 자취
    const tr = trail.current;
    ctx.strokeStyle = colors.fg; ctx.lineWidth = 2;
    for (let i = 1; i < tr.length; i++) {
      const a = pr(torusPt(tr[i - 1][0], tr[i - 1][1], 0.02)), b = pr(torusPt(tr[i][0], tr[i][1], 0.02));
      ctx.globalAlpha = facing(tr[i][0], tr[i][1]) >= 0 ? 0.8 : 0.25;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 팩맨 위치
    const ps = pr(torusPt(p[0], p[1], 0.03));
    ctx.globalAlpha = facing(p[0], p[1]) >= 0 ? 1 : 0.45;
    ctx.fillStyle = '#f5c400';
    ctx.beginPath(); ctx.arc(ps.x, ps.y, 7, 0, TAU); ctx.fill();
    ctx.strokeStyle = colors.fg; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.fgMuted; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('토러스 (끌어서 회전)', cx, h - 12);
    ctx.textAlign = 'left';

    // ── 화면 두 장 ──
    function screen(P, which) {
      const conv = which === 'A' ? (q) => q : toB;
      const u = conv(p);
      ctx.save();
      ctx.beginPath(); ctx.rect(P.x, P.y, P.s, P.s); ctx.clip();
      ctx.fillStyle = colors.bg; ctx.fillRect(P.x, P.y, P.s, P.s);
      // 격자
      ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
      for (let k = 1; k < L; k++) {
        const [gx] = toScr(P, [k, 0]); const [, gy] = toScr(P, [0, k]);
        ctx.beginPath(); ctx.moveTo(gx, P.y); ctx.lineTo(gx, P.y + P.s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(P.x, gy); ctx.lineTo(P.x + P.s, gy); ctx.stroke();
      }
      // 다른 화면의 이음매가 이 화면 안에서는 한가운데 십자로 보인다
      const other = which === 'A' ? pal.aux2 : pal.aux3;
      ctx.strokeStyle = other; ctx.lineWidth = 2; ctx.setLineDash(which === 'A' ? [6, 4] : []);
      const [mx, my] = toScr(P, [5, 5]);
      ctx.beginPath(); ctx.moveTo(mx, P.y); ctx.lineTo(mx, P.y + P.s); ctx.moveTo(P.x, my); ctx.lineTo(P.x + P.s, my); ctx.stroke();
      ctx.setLineDash([]);
      // 자취: 이 화면의 좌표로 옮겨 그리고, 한 걸음에 5 넘게 뛰면 이음매를 넘은 것이라 끊는다
      const pts = trail.current.map(q => conv([wrap(q[0]), wrap(q[1])]));
      ctx.strokeStyle = colors.fg; ctx.lineWidth = 2; ctx.globalAlpha = 0.75;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        if (Math.abs(a[0] - b[0]) > L / 2 || Math.abs(a[1] - b[1]) > L / 2) {
          // 끊긴 자리 표시
          ctx.globalAlpha = 1;
          for (const q of [a, b]) {
            const [sx, sy] = toScr(P, q);
            const cxm = Math.min(Math.max(sx, P.x + 7), P.x + P.s - 7), cym = Math.min(Math.max(sy, P.y + 7), P.y + P.s - 7);
            ctx.strokeStyle = pal.aux3; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(cxm - 5, cym - 5); ctx.lineTo(cxm + 5, cym + 5); ctx.moveTo(cxm + 5, cym - 5); ctx.lineTo(cxm - 5, cym + 5); ctx.stroke();
          }
          ctx.textAlign = 'left'; ctx.globalAlpha = 0.75;
          continue;
        }
        const [ax, ay] = toScr(P, a), [bx, by] = toScr(P, b);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // 팩맨
      const missing = onSeam(u[0]) || onSeam(u[1]);
      const [sx, sy] = toScr(P, u);
      if (missing) {
        ctx.strokeStyle = colors.fgMuted; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(sx, sy, 8, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      } else {
        const a = 0.6;
        ctx.fillStyle = '#f5c400';
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.arc(sx, sy, 9, a / 2, TAU - a / 2); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = colors.fg; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.restore();
      // 테두리 = 이 화면의 이음매
      ctx.strokeStyle = which === 'A' ? pal.aux3 : pal.aux2; ctx.lineWidth = 3;
      ctx.setLineDash(which === 'A' ? [] : [6, 4]);
      ctx.strokeRect(P.x, P.y, P.s, P.s); ctx.setLineDash([]);
      // 눈금 숫자
      ctx.fillStyle = colors.fgMuted; ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      for (const k of [0, 5, 10]) { const [gx] = toScr(P, [k, 0]); ctx.fillText(String(k), gx, P.y + P.s + 13); }
      ctx.textAlign = 'right';
      for (const k of [5, 10]) { const [, gy] = toScr(P, [0, k]); ctx.fillText(String(k), P.x - 4, gy + 4); }
      ctx.textAlign = 'left';
      // 제목
      ctx.fillStyle = pal.chart; ctx.font = 'italic bold 15px serif';
      ctx.fillText('φ', P.x, P.y - 8);
      const fw = ctx.measureText('φ').width;
      ctx.font = 'italic bold 10px serif'; ctx.fillText(which, P.x + fw + 1, P.y - 4);
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(which === 'A' ? '화면 A' : '화면 B (5칸씩 옮김)', P.x + fw + 14, P.y - 8);
    }
    screen(Ly.A, 'A');
    screen(Ly.B, 'B');
  };

  const canvasRef = useCanvas(drawRef);

  usePointer(canvasRef, {
    onDown: (pos) => {
      const c = canvasRef.current;
      const Ly = layout(c.clientWidth, c.clientHeight);
      if (inside(Ly.A, pos.x, pos.y)) drag.current = { kind: 'A', P: Ly.A };
      else if (inside(Ly.B, pos.x, pos.y)) drag.current = { kind: 'B', P: Ly.B };
      else drag.current = { kind: 'rot', mx: pos.x, my: pos.y, ry: rot.current.y, rx: rot.current.x };
      if (drag.current.kind !== 'rot') moveTo(pos, false);
    },
    onDrag: (pos) => {
      const d = drag.current;
      if (!d) return;
      if (d.kind === 'rot') {
        rot.current = { y: d.ry + (pos.x - d.mx) * 0.01, x: Math.max(-1.5, Math.min(1.5, d.rx + (pos.y - d.my) * 0.01)) };
      } else moveTo(pos, true);
    },
    onUp: () => { drag.current = null; },
  });

  function moveTo(pos, keep) {
    const d = drag.current;
    let u = fromScr(d.P, pos.x, pos.y).map(v => Math.max(0.01, Math.min(L - 0.01, v)));
    const q = d.kind === 'A' ? u : fromB(u);
    // 끌기는 화면 안에서만 움직이므로 자취도 감긴 값 그대로 쌓는다
    pRef.current = q;
    trail.current = keep ? [...trail.current, q].slice(-80) : [q];
    if (!pending.current) {
      pending.current = true;
      requestAnimationFrame(() => { pending.current = false; setReadP(pRef.current); });
    }
  }

  function applyInput() {
    const q = inp.map(v => parseFloat(v));
    if (q.some(v => !isFinite(v))) return;
    setPoint(q, false);
  }

  // ── 수식 패널 ──
  const C = HEX.coord, H = HEX.chart;
  const uA = readP, uB = toB(readP);
  const inA = !(onSeam(uA[0]) || onSeam(uA[1]));
  const inB = !(onSeam(uB[0]) || onSeam(uB[1]));
  const xy = (u) => `(\\textcolor{${C}}{${fmt(u[0])}},\\ \\textcolor{${C}}{${fmt(u[1])}})`;
  const rule = (v) => (v < L / 2 ? `${fmt(v)} + 5` : `${fmt(v)} - 5`);
  const muted = { color: 'var(--fg-muted)', marginLeft: '0.6em', fontSize: '0.9em' };

  return (
    <div class="viz-inner">
      <div class="viz-message">
        팩맨을 이음매 너머로 옮기면 한 화면의 좌표는 10 근처에서 0 근처로 튀지만, 다른 화면의 좌표는 매끄럽게 이어진다. 두 화면 어디에도 없는 점이 있는지도 찾아보자.
      </div>
      <canvas ref={canvasRef} />
      <div class="viz-formula">
        <div>
          <Tex>{`\\textcolor{${H}}{\\varphi_A} = ${inA ? xy(uA) : '\\text{(화면 A의 이음매 위)}'}`}</Tex>
          {!inA && <span style={muted}>이 점은 화면 A에 없다</span>}
        </div>
        <div>
          <Tex>{`\\textcolor{${H}}{\\varphi_B} = ${inB ? xy(uB) : '\\text{(화면 B의 이음매 위)}'}`}</Tex>
          {!inB && <span style={muted}>이 점은 화면 B에 없다</span>}
          {!inA && !inB && <span style={{ ...muted, color: 'var(--accent)' }}>두 화면 모두에 없다 — 세 번째 화면이 필요하다</span>}
        </div>
        <div>
          {inA && inB
            ? <Tex>{`\\textcolor{${H}}{\\varphi_B}\\circ\\textcolor{${H}}{\\varphi_A}^{-1}(\\textcolor{${C}}{x},\\textcolor{${C}}{y}) = (${rule(uA[0])},\\ ${rule(uA[1])}) = ${xy(uB)}`}</Tex>
            : <span style={{ color: 'var(--fg-muted)' }}>전이함수는 두 화면이 겹치는 곳에서만 쓴다</span>}
        </div>
      </div>
      <div class="viz-controls">
        <button class="viz-btn" onClick={() => { setInp(['8', '3']); setPoint(START, false); }}>문제 3 불러오기</button>
        <span class="viz-inputs">
          화면 A 좌표
          {['x', 'y'].map((nm, i) => (
            <label>{nm} <input class="viz-num" type="number" step="0.5" value={inp[i]}
              onInput={(e) => { const v = inp.slice(); v[i] = e.target.value; setInp(v); }}
              onKeyDown={(e) => { if (e.key === 'Enter') applyInput(); }} /></label>
          ))}
          <button class="viz-btn" onClick={applyInput}>이 점 찍기</button>
        </span>
        <span class="viz-inputs">
          한 칸 이동
          <button class="viz-btn" onClick={() => step(-1, 0)}>←</button>
          <button class="viz-btn" onClick={() => step(1, 0)}>→</button>
          <button class="viz-btn" onClick={() => step(0, 1)}>↑</button>
          <button class="viz-btn" onClick={() => step(0, -1)}>↓</button>
        </span>
        <span style={{ color: 'var(--fg-muted)', fontSize: '0.85em' }}>화면에서 팩맨 끌기 · 토러스를 끌어 회전 · 실선 = 화면 A의 이음매 · 점선 = 화면 B의 이음매 · ✕ = 좌표가 튄 자리</span>
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch01TorusViz />, el); }
