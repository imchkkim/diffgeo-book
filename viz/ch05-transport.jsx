// 5장 — 구면 위 닫힌 경로를 따른 평행이동과 홀로노미.
// 경로: 구면 삼각형(북극 → B → C → 북극) 또는 위도선 한 바퀴. 한 바퀴 뒤 측정한 회전각을 ∬K dA 와 비교.
// 색: 경로 γ = curve, 옮겨지는 벡터 V = field, 홀로노미 Δθ = holo, 곡률이 적분되는 영역 = gauss (palette.json).
import { render } from 'preact';
import { useState, useRef, useMemo } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { Slider } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { usePalette, HEX } from './shared/palette.js';
import { Tex } from './shared/tex.jsx';
import {
  project3D, slerp, vecNormalize, vecCross, vecScale, vecSub, vecDot, vecAdd,
  drawArrow, rotationMatrix, matVec3,
} from './shared/math.js';

const TAU = 2 * Math.PI;
const DEG = 180 / Math.PI;
const sph = (t, f) => [Math.sin(t) * Math.cos(f), Math.sin(t) * Math.sin(f), Math.cos(t)];

// 경로 점 목록
function buildPath(mode, t0, lam) {
  if (mode === 'lat') {
    const n = 720;
    return Array.from({ length: n + 1 }, (_, i) => sph(t0, (TAU * i) / n));
  }
  const A = [0, 0, 1], B = sph(t0, 0), C = sph(t0, lam);
  const pts = [];
  for (const [p, q] of [[A, B], [B, C], [C, A]]) {
    for (let i = 0; i < 240; i++) pts.push(vecNormalize(slerp(p, q, i / 240)));
  }
  pts.push(A);
  return pts;
}

function initialVector(mode, pts) {
  const p = pts[0];
  if (mode === 'lat') {
    // 북쪽(북극 방향)을 가리키게: −e_θ
    const [x, y, z] = p;
    const r = Math.hypot(x, y);
    return [-(z * x) / r, -(z * y) / r, r];
  }
  const q = pts[240]; // B
  return vecNormalize(vecSub(q, vecScale(p, vecDot(p, q))));
}

// 짧은 측지 조각마다 회전 → 접평면 사영. 누적 벡터 배열을 돌려준다.
function transportAll(v0, pts) {
  const out = [v0];
  let v = v0;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i];
    const d = Math.max(-1, Math.min(1, vecDot(p0, p1)));
    if (d < 1 - 1e-15) v = matVec3(rotationMatrix(vecCross(p0, p1), Math.acos(d)), v);
    v = vecNormalize(vecSub(v, vecScale(p1, vecDot(v, p1))));
    out.push(v);
  }
  return out;
}

// 부호 있는 각도 (출발점 바깥 법선 기준, 반시계 +), [0, 2π)
function signedAngle(v0, v1, n) {
  let a = Math.atan2(vecDot(vecCross(v0, v1), n), vecDot(v0, v1));
  if (a < -1e-9) a += TAU;
  return Math.max(0, a);
}

// 구면 삼각형 넓이 (륄리에 공식)
function triArea(A, B, C) {
  const ang = (p, q) => Math.acos(Math.max(-1, Math.min(1, vecDot(p, q))));
  const a = ang(B, C), b = ang(A, C), c = ang(A, B), s = (a + b + c) / 2;
  const t = Math.tan(s / 2) * Math.tan((s - a) / 2) * Math.tan((s - b) / 2) * Math.tan((s - c) / 2);
  return 4 * Math.atan(Math.sqrt(Math.max(0, t)));
}

function Ch05Viz() {
  const colors = useThemeColors();
  const pal = usePalette();
  const [mode, setMode] = useState('tri');
  const [t0, setT0] = useState(Math.PI / 2);
  const [lam, setLam] = useState(Math.PI / 2);
  const [shown, setShown] = useState(0);     // 슬라이더 표시용 진행률 (프레임마다 갱신하지 않음)
  const [playing, setPlaying] = useState(false);
  const prog = useRef(0);                    // 실제 진행률 0..1
  const playRef = useRef(false);
  const lastT = useRef(0);
  const rot = useRef({ y: -2.36, x: 0.6 });
  const drag = useRef(null);

  const path = useMemo(() => {
    const pts = buildPath(mode, t0, lam);
    const v0 = initialVector(mode, pts);
    const vecs = transportAll(v0, pts);
    const measured = signedAngle(v0, vecs[vecs.length - 1], pts[0]);
    const predicted = mode === 'lat'
      ? TAU * (1 - Math.cos(t0))
      : triArea([0, 0, 1], sph(t0, 0), sph(t0, lam));
    return { pts, vecs, measured, predicted };
  }, [mode, t0, lam]);

  function reset() { prog.current = 0; setShown(0); }
  function setPlay(on) { playRef.current = on; setPlaying(on); lastT.current = performance.now(); }

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    // 재생: 캔버스 루프에서 ref 로 진행
    if (playRef.current) {
      const now = performance.now();
      prog.current = Math.min(1, prog.current + (now - lastT.current) / 6000);
      lastT.current = now;
      if (prog.current >= 1) { setPlay(false); setShown(1); }
      else if (Math.floor(prog.current * 40) !== Math.floor(shown * 40)) setShown(prog.current);
    }

    const wide = w >= 600;
    const cx = wide ? w * 0.4 : w / 2, cy = h / 2;
    const R = Math.min(wide ? w * 0.36 : w * 0.44, h * 0.43);
    const { y: ry, x: rx } = rot.current;
    // 구면 (X, Y, Z) → 화면: Z 가 위쪽, 오른손계 유지
    const pr = (q, s = R) => project3D([q[0] * s, q[2] * s, -q[1] * s], cx, cy, 1, ry, rx);

    // 윤곽과 격자
    ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    function curve3(fn, n, style, lw, dash) {
      ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.setLineDash(dash || []);
      let on = false; ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const q = pr(fn(i / n));
        if (q.z >= 0) { on ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); on = true; } else on = false;
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    for (let k = 1; k < 6; k++) curve3(t => sph((k / 6) * Math.PI, TAU * t), 72, colors.border, 0.8);
    for (let k = 0; k < 6; k++) curve3(t => sph(TAU * t, (k / 6) * Math.PI), 96, colors.border, 0.8);

    // 영역 Ω: 곡률을 적분하는 곳 (앞면 조각만)
    ctx.fillStyle = pal.gauss; ctx.globalAlpha = 0.16;
    const nt = 18, nf = 48;
    const m = vecCross(sph(t0, 0), sph(t0, lam));
    const edge = (f) => {
      if (mode === 'lat') return t0;
      let t = Math.atan2(-m[2], m[0] * Math.cos(f) + m[1] * Math.sin(f));
      if (t < 0) t += Math.PI;
      return t;
    };
    const f1 = mode === 'lat' ? TAU : lam;
    for (let i = 0; i < nf; i++) {
      const fa = (i / nf) * f1, fb = ((i + 1) / nf) * f1;
      const ea = edge(fa), eb = edge(fb);
      for (let j = 0; j < nt; j++) {
        const q = [
          sph((j / nt) * ea, fa), sph((j / nt) * eb, fb),
          sph(((j + 1) / nt) * eb, fb), sph(((j + 1) / nt) * ea, fa),
        ].map(v => pr(v));
        if (q[0].z + q[1].z + q[2].z + q[3].z < 0) continue;
        ctx.beginPath(); ctx.moveTo(q[0].x, q[0].y);
        for (let k = 1; k < 4; k++) ctx.lineTo(q[k].x, q[k].y);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // 경로 γ
    const { pts, vecs } = path;
    ctx.strokeStyle = pal.curve; ctx.lineWidth = 2.5;
    let on = false; ctx.beginPath();
    for (const p of pts) {
      const q = pr(p);
      if (q.z >= 0) { on ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); on = true; } else on = false;
    }
    ctx.stroke();

    // 출발점의 처음 벡터(점선)
    const L = 0.32;
    const tipOf = (p, v) => vecAdd(p, vecScale(v, L));
    const s0 = pr(pts[0]), g0 = pr(tipOf(pts[0], vecs[0]));
    if (s0.z >= 0) {
      ctx.strokeStyle = colors.fgMuted; ctx.lineWidth = 1.8; ctx.setLineDash([4, 4]);
      drawArrow(ctx, s0.x, s0.y, g0.x, g0.y, 9); ctx.setLineDash([]);
    }

    // 현재 위치의 벡터 V
    const idx = Math.round(prog.current * (pts.length - 1));
    const p = pts[idx], v = vecs[idx];
    const ps = pr(p), ts = pr(tipOf(p, v));
    ctx.globalAlpha = ps.z >= 0 ? 1 : 0.35;
    ctx.strokeStyle = pal.field; ctx.lineWidth = 3;
    drawArrow(ctx, ps.x, ps.y, ts.x, ts.y, 11);
    ctx.fillStyle = pal.field;
    ctx.beginPath(); ctx.arc(ps.x, ps.y, 4.5, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;

    // 북극 표시
    const np = pr([0, 0, 1]);
    if (np.z >= 0) {
      ctx.fillStyle = colors.fgMuted; ctx.font = '12px sans-serif';
      ctx.fillText('북극', np.x + 6, np.y - 6);
    }

    // 오른쪽 위: 출발점 접평면에서 본 처음/마지막 벡터
    const done = prog.current >= 1;
    const bx = wide ? w * 0.84 : w - 70, by = wide ? h * 0.3 : 64, br = wide ? Math.min(w * 0.12, 70) : 44;
    ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.stroke();
    ctx.fillStyle = colors.fgMuted; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('출발점에서 비교', bx, by + br + 16);
    ctx.textAlign = 'left';
    // 접평면 기저: e1 = 처음 벡터, e2 = n × e1
    const n0 = pts[0], e1 = vecs[0], e2 = vecCross(n0, e1);
    const inPlane = (u) => [vecDot(u, e1), vecDot(u, e2)];
    const arrow2 = (u, style, dash) => {
      const [a, b] = inPlane(u);
      ctx.strokeStyle = style; ctx.lineWidth = 2.5; ctx.setLineDash(dash || []);
      drawArrow(ctx, bx, by, bx + a * br * 0.9, by - b * br * 0.9, 9); ctx.setLineDash([]);
    };
    arrow2(e1, colors.fgMuted, [4, 4]);
    if (done) {
      const ang = path.measured;
      ctx.strokeStyle = pal.holo; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, by, br * 0.45, 0, -ang, true); ctx.stroke();
      arrow2(vecs[vecs.length - 1], pal.field);
      ctx.fillStyle = pal.holo; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`Δθ = ${(ang * DEG).toFixed(1)}°`, bx, by - br - 8);
      ctx.textAlign = 'left';
    }

    ctx.fillStyle = colors.fgMuted; ctx.font = '12px sans-serif';
    ctx.fillText('끌어서 회전', 10, h - 10);
  };

  const canvasRef = useCanvas(drawRef);
  usePointer(canvasRef, {
    onDown: (pos) => { drag.current = { mx: pos.x, my: pos.y, ry: rot.current.y, rx: rot.current.x }; },
    onDrag: (pos) => {
      const d = drag.current; if (!d) return;
      rot.current = { y: d.ry + (pos.x - d.mx) * 0.01, x: Math.max(-1.4, Math.min(1.4, d.rx + (pos.y - d.my) * 0.01)) };
    },
    onUp: () => { drag.current = null; },
  });

  const HO = HEX.holo, K = HEX.gauss, C = HEX.coord, OM = HEX.aux4, DA = HEX.area;
  const done = shown >= 1;
  const meas = (path.measured * DEG).toFixed(1);
  const pred = (path.predicted * DEG).toFixed(1);
  const area = path.predicted.toFixed(3);

  return (
    <div class="viz-inner">
      <div class="viz-message">
        어떤 경로를 고르든, 한 바퀴 돌아온 화살표가 어긋난 각도 <Tex>{`\\textcolor{${HO}}{\\Delta\\theta}`}</Tex>는 경로가 둘러싼 넓이(반지름 1인 구에서 <Tex>{`\\textcolor{${K}}{K}=1`}</Tex>)와 같다.
      </div>
      <canvas ref={canvasRef} />
      <div class="viz-formula">
        <div>
          <Tex>{`\\textcolor{${HO}}{\\Delta\\theta}_{\\text{측정}} = ${done ? meas + '^\\circ' : '\\text{(한 바퀴를 다 돌면 표시)}'}`}</Tex>
        </div>
        <div>
          <Tex>{`\\iint_{\\textcolor{${OM}}{\\Omega}} \\textcolor{${K}}{K}\\,\\textcolor{${DA}}{dA} = 1 \\times \\text{넓이}(\\textcolor{${OM}}{\\Omega}) = ${area}\\ \\text{rad} = ${pred}^\\circ`}</Tex>
        </div>
        {mode === 'lat' && (
          <div>
            <Tex>{`2\\pi(1-\\cos\\textcolor{${C}}{\\theta}_0) = ${pred}^\\circ, \\qquad \\text{푸코(땅 기준)}:\\ 2\\pi - \\textcolor{${HO}}{\\Delta\\theta} = 2\\pi\\cos\\textcolor{${C}}{\\theta}_0 = ${(360 * Math.cos(t0)).toFixed(1)}^\\circ`}</Tex>
          </div>
        )}
      </div>
      <div class="viz-controls">
        <button class={'viz-btn' + (mode === 'tri' ? ' active' : '')} onClick={() => { setMode('tri'); setT0(Math.PI / 2); reset(); setPlay(false); }}>구면 삼각형</button>
        <button class={'viz-btn' + (mode === 'lat' ? ' active' : '')} onClick={() => { setMode('lat'); setT0(Math.PI / 6); reset(); setPlay(false); }}>위도선 한 바퀴</button>
        <button class="viz-btn" onClick={() => {
          if (prog.current >= 1) { reset(); setPlay(true); } else setPlay(!playRef.current);
        }}>{playing ? '⏸ 멈춤' : done ? '↻ 다시' : '▶ 재생'}</button>
        <Slider label="진행" min={0} max={1} step={0.005} value={shown}
          onChange={(v) => { setPlay(false); prog.current = v; setShown(v); }} />
        <Slider label={<Tex>{`\\textcolor{${C}}{\\theta}_0\\ (\\text{여위도, 도})`}</Tex>}
          min={mode === 'lat' ? 10 : 20} max={mode === 'lat' ? 170 : 90} step={1} value={String(Math.round(t0 * DEG))}
          onChange={(v) => { setT0(v / DEG); reset(); setPlay(false); }} />
        {mode === 'tri' && (
          <Slider label="경도 폭 (도)" min={10} max={170} step={1} value={String(Math.round(lam * DEG))}
            onChange={(v) => { setLam(v / DEG); reset(); setPlay(false); }} />
        )}
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch05Viz />, el); }
