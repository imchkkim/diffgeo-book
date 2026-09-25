// 7장 — 작은 사각형 고리를 따라 벡터를 평행이동하면 돌아간다. 회전각 ÷ 넓이 = 곡률 K = 1/r².
// 고리 변은 측지선(대원 호)이라, 넓이는 내각 초과분으로 정확히 계산된다(가우스-보네).
// 색: 방향 u, v = dir, 벡터 W = field, 회전각 Δθ = holo, K = gauss, R = riem (palette.json).
import { h, render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { Slider } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { usePalette, HEX } from './shared/palette.js';
import { Tex } from './shared/tex.jsx';
import {
  project3D, vecAdd, vecSub, vecScale, vecDot, vecCross, vecNormalize,
  slerp, drawArrow,
} from './shared/math.js';

const TAU = 2 * Math.PI;
const R_MAX = 1.6;
// 기준점 p (단위구 위) 와 그 점의 두 방향 u(동쪽), v(북쪽)
const TH0 = 1.0, PH0 = 0.35;
const P0 = [Math.sin(TH0) * Math.cos(PH0), Math.sin(TH0) * Math.sin(PH0), Math.cos(TH0)];
const U0 = [-Math.sin(PH0), Math.cos(PH0), 0];
const V0 = vecNormalize(vecCross(P0, U0)); // p × u = 북쪽

// 단위구 위 측지선: p 에서 접벡터 d 방향으로 거리 s
function expS2(p, d, s) {
  const n = Math.hypot(...d);
  if (n < 1e-12) return p;
  const e = vecScale(d, 1 / n);
  return vecAdd(vecScale(p, Math.cos(s)), vecScale(e, Math.sin(s)));
}
// a → b 대원 호를 따른 평행이동 = 축 a×b 둘레의 회전 (로드리게스, 짧은 호에서도 정확)
function transport(W, a, b) {
  const ax = vecCross(a, b);
  const sn = Math.hypot(...ax), cs = vecDot(a, b);
  if (sn < 1e-15) return W;
  const k = vecScale(ax, 1 / sn);
  return vecAdd(vecAdd(vecScale(W, cs), vecScale(vecCross(k, W), sn)), vecScale(k, vecDot(k, W) * (1 - cs)));
}
function tangentTo(x, y) { return vecNormalize(vecSub(y, vecScale(x, vecDot(x, y)))); }

// 고리 계산: 꼭짓점, 평행이동 결과, 부호 있는 회전각, 단위구 넓이
function loop(s, uFirst) {
  const A = P0;
  const B = expS2(P0, U0, s);
  const C = expS2(P0, vecAdd(U0, V0), s);
  const D = expS2(P0, V0, s);
  const path = uFirst ? [A, B, C, D, A] : [A, D, C, B, A];
  const W0 = vecScale(vecNormalize(vecAdd(U0, vecScale(V0, 0.35))), 1);
  let W = [...W0];
  const snaps = [];
  for (let k = 0; k < 4; k++) {
    const from = path[k], to = path[k + 1];
    const n = 24;
    for (let i = 0; i < n; i++) {
      const a = vecNormalize(slerp(from, to, i / n));
      const b = vecNormalize(slerp(from, to, (i + 1) / n));
      W = transport(W, a, b);
    }
    snaps.push({ at: to, W: [...W] });
  }
  const dTheta = Math.atan2(vecDot(P0, vecCross(W0, W)), vecDot(W0, W));
  // 내각 합 - 2π = 넓이 (단위구)
  const quad = [A, B, C, D];
  let sum = 0;
  for (let k = 0; k < 4; k++) {
    const X = quad[k], prev = quad[(k + 3) % 4], next = quad[(k + 1) % 4];
    sum += Math.acos(Math.max(-1, Math.min(1, vecDot(tangentTo(X, prev), tangentTo(X, next)))));
  }
  return { quad, path, W0, W, snaps, dTheta, areaUnit: sum - TAU };
}

function Ch07Viz() {
  const colors = useThemeColors();
  const pal = usePalette();
  const [eps, setEps] = useState(0.5);
  const [r, setR] = useState(1.0);
  const [uFirst, setUFirst] = useState(true);
  const rot = useRef({ y: -1.92, x: 0.5 }); // 기준점 p 가 정면에 오도록
  const dragRef = useRef(null);

  const s = Math.min(eps / r, 1.2); // 단위구에서의 변 길이(라디안)
  const L = loop(s, uFirst);
  const area = L.areaUnit * r * r;
  const stateRef = useRef(null);
  stateRef.current = { L, r };

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const { L, r } = stateRef.current;
    const cx = w / 2, cy = h / 2;
    // 화면 속 구의 크기는 고정. 반지름 r 이 커지면 같은 ε 의 고리가 구에서 차지하는 몫이 작아진다.
    const Rs = Math.min(w, h) * 0.45;
    const { y: ry, x: rx } = rot.current;
    // z 축을 화면 위로. (x, z, −y) 로 보내야 오른손 좌표계가 유지되어 반시계가 반시계로 보인다
    const pr = (q, k = 1) => project3D([q[0] * Rs * k, q[2] * Rs * k, -q[1] * Rs * k], cx, cy, 1, ry, rx);

    ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, Rs, 0, TAU); ctx.stroke();
    // 위도선·경도선 (회전 반영)
    function curve3(fn, n, style, width, dash) {
      ctx.strokeStyle = style; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      let on = false; ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const q = pr(fn(i / n));
        if (q.z >= 0) { if (!on) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); on = true; } else on = false;
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.globalAlpha = 0.9;
    for (const Z of [-0.75, -0.4, 0, 0.4, 0.75]) {
      const rr = Math.sqrt(1 - Z * Z);
      curve3(t => [rr * Math.cos(TAU * t), rr * Math.sin(TAU * t), Z], 80, colors.border, 1);
    }
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI;
      curve3(t => [Math.cos(a) * Math.sin(TAU * t), Math.sin(a) * Math.sin(TAU * t), Math.cos(TAU * t)], 100, colors.border, 1);
    }
    ctx.globalAlpha = 1;

    // 고리 내부
    const [A, B, C, D] = L.quad;
    const ring = [[A, B], [B, C], [C, D], [D, A]];
    ctx.fillStyle = pal.gauss; ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ring.forEach(([a, b], k) => {
      for (let i = 0; i <= 16; i++) {
        const q = pr(vecNormalize(slerp(a, b, i / 16)));
        if (k === 0 && i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
      }
    });
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;

    // 변: A→B, D→C 는 u 방향, A→D, B→C 는 v 방향
    const edges = [[A, B, 'u'], [D, C, 'u'], [A, D, 'v'], [B, C, 'v']];
    for (const [a, b, name] of edges) {
      ctx.strokeStyle = pal.dir; ctx.lineWidth = 2.5; ctx.setLineDash(name === 'v' ? [6, 4] : []);
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const q = pr(vecNormalize(slerp(a, b, i / 20)));
        if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    // u, v 라벨 (첫 두 변 중간 바깥쪽)
    ctx.font = 'italic bold 15px serif'; ctx.fillStyle = pal.dir;
    const mu = pr(vecNormalize(slerp(A, B, 0.5)), 1.0);
    const mv = pr(vecNormalize(slerp(A, D, 0.5)), 1.0);
    const pa = pr(A);
    ctx.fillText('u', mu.x + (mu.x - pa.x) * 0.0 + 2, mu.y + 16);
    ctx.fillText('v', mv.x - 14, mv.y);

    // 도는 방향 화살표 (첫 변 위)
    const first = L.path[1];
    const t1 = pr(vecNormalize(slerp(A, first, 0.55))), t2 = pr(vecNormalize(slerp(A, first, 0.75)));
    ctx.strokeStyle = colors.fg; ctx.lineWidth = 1.5;
    drawArrow(ctx, t1.x, t1.y, t2.x, t2.y, 7);

    // 각 꼭짓점에서 옮겨진 W (옅게)
    const wl = 0.28;
    for (const sn of L.snaps.slice(0, 3)) {
      const a = pr(sn.at), b = pr(vecAdd(sn.at, vecScale(sn.W, wl)));
      ctx.strokeStyle = pal.field; ctx.globalAlpha = 0.45; ctx.lineWidth = 2;
      drawArrow(ctx, a.x, a.y, b.x, b.y, 7);
      ctx.globalAlpha = 1;
    }
    // 처음 W (점선), 돌아온 W (굵게)
    const a0 = pr(A);
    const b0 = pr(vecAdd(A, vecScale(L.W0, wl)));
    const b1 = pr(vecAdd(A, vecScale(L.W, wl)));
    ctx.strokeStyle = pal.field; ctx.lineWidth = 1.8; ctx.setLineDash([4, 4]);
    drawArrow(ctx, a0.x, a0.y, b0.x, b0.y, 8); ctx.setLineDash([]);
    ctx.lineWidth = 3;
    drawArrow(ctx, a0.x, a0.y, b1.x, b1.y, 10);
    // 회전각 호
    ctx.strokeStyle = pal.holo; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const ang = (i / 20) * L.dTheta;
      const dir = vecAdd(vecScale(L.W0, Math.cos(ang)), vecScale(vecCross(P0, L.W0), Math.sin(ang)));
      const q = pr(vecAdd(A, vecScale(dir, wl * 0.72)));
      if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
    ctx.fillStyle = colors.fg;
    ctx.beginPath(); ctx.arc(a0.x, a0.y, 4, 0, TAU); ctx.fill();
    ctx.font = 'italic 14px serif'; ctx.fillText('p', a0.x - 14, a0.y + 14);

    ctx.fillStyle = colors.fgMuted; ctx.font = '12px sans-serif';
    ctx.fillText('끌어서 회전', 10, h - 10);
  };

  const canvasRef = useCanvas(drawRef);
  usePointer(canvasRef, {
    onDown: (pos) => { dragRef.current = { mx: pos.x, my: pos.y, ry: rot.current.y, rx: rot.current.x }; },
    onDrag: (pos) => {
      const d = dragRef.current; if (!d) return;
      rot.current = { y: d.ry + (pos.x - d.mx) * 0.01, x: Math.max(-1.4, Math.min(1.4, d.rx + (pos.y - d.my) * 0.01)) };
    },
    onUp: () => { dragRef.current = null; },
  });

  const Hh = HEX;
  const K = 1 / (r * r);
  const ratio = Math.abs(L.dTheta) / area;
  const Rt = `\\textcolor{${Hh.riem}}{R}`;
  const u = `\\textcolor{${Hh.dir}}{u}`, v = `\\textcolor{${Hh.dir}}{v}`, W = `\\textcolor{${Hh.field}}{W}`;
  const dT = `\\textcolor{${Hh.holo}}{\\Delta\\theta}`, Kt = `\\textcolor{${Hh.gauss}}{K}`;

  return (
    <div class="viz-inner">
      <div class="viz-message">
        고리를 한 바퀴 돌면 <Tex>{W}</Tex> 가 <Tex>{dT}</Tex> 만큼 돌아간다. 고리 크기를 바꿔도 <Tex>{`${dT} \\div \\text{넓이}`}</Tex> 는 늘 <Tex>{`1/r^2`}</Tex> — 그것이 곡률이다. 도는 순서를 바꾸면 회전 방향이 뒤집힌다.
      </div>
      <canvas ref={canvasRef} />
      <div class="viz-formula">
        <div><Tex>{`${dT} = ${L.dTheta >= 0 ? '+' : '-'}${Math.abs(L.dTheta).toFixed(4)}\\ \\text{rad}`}</Tex>
          <span style={{ color: 'var(--fg-muted)', marginLeft: '0.6em', fontSize: '0.9em' }}>
            ({uFirst ? '반시계, u 먼저' : '시계, v 먼저'})</span></div>
        <div><Tex>{`\\text{넓이} = ${area.toFixed(4)}, \\qquad \\epsilon^2 = ${(eps * eps).toFixed(4)}`}</Tex></div>
        <div><Tex>{`\\frac{|${dT}|}{\\text{넓이}} = ${ratio.toFixed(4)} \\qquad ${Kt} = \\frac{1}{r^2} = ${K.toFixed(4)}`}</Tex></div>
        <div><Tex>{`${Rt}(${uFirst ? u : v}, ${uFirst ? v : u})${W} = -${Rt}(${uFirst ? v : u}, ${uFirst ? u : v})${W}`}</Tex>
          <span style={{ color: 'var(--fg-muted)', marginLeft: '0.6em', fontSize: '0.9em' }}>순서를 바꾸면 부호가 바뀐다</span></div>
      </div>
      <div class="viz-controls">
        <Slider label={<span>고리 한 변 <Tex>{'\\epsilon'}</Tex></span>} min={0.1} max={1.0} step={0.01} value={eps} onChange={setEps} />
        <Slider label={<span>구의 반지름 <Tex>{'r'}</Tex></span>} min={0.6} max={R_MAX} step={0.01} value={r} onChange={setR} />
        <button class={'viz-btn' + (uFirst ? ' active' : '')} onClick={() => setUFirst(true)}>u 먼저</button>
        <button class={'viz-btn' + (!uFirst ? ' active' : '')} onClick={() => setUFirst(false)}>v 먼저</button>
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch07Viz />, el); }
