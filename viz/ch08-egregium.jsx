// 8장 — 한 점 근처 곡면을 두 주곡률 κ₁, κ₂ 로 빚는다: z = (κ₁x² + κ₂y²)/2.
// K = κ₁κ₂ 와 "종이로 만들 수 있는가"를 보여 준다. 종이 모드에서는 K = 0 을 지켜야 하므로
// 한 방향을 굽히면 다른 방향이 0 에 묶인다(피자 정리).
// 색: κ₁, κ₂, K = gauss, 법선 n = normal (palette.json).
import { h, render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { Slider } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { usePalette, HEX } from './shared/palette.js';
import { Tex } from './shared/tex.jsx';
import { project3D, drawArrow } from './shared/math.js';

const TAU = 2 * Math.PI;
const RHO = 0.5; // 둘레를 재는 작은 원의 반지름

const PRESETS = [
  { label: '피자 (종이)', k1: 1.4, k2: 0, paper: true },
  { label: '공', k1: 1, k2: 1, paper: false },
  { label: '말안장', k1: 1, k2: -1, paper: false },
  { label: '평면', k1: 0, k2: 0, paper: false },
];

function Ch08Viz() {
  const colors = useThemeColors();
  const pal = usePalette();
  const [k1, setK1] = useState(1);
  const [k2, setK2] = useState(1);
  const [paper, setPaper] = useState(false);
  const rot = useRef({ y: 0.6, x: 0.55 });
  const drag = useRef(null);
  const cur = useRef({ k1, k2 });
  cur.current = { k1, k2 };

  // 종이 모드: 방금 움직인 쪽이 0 이 아니면 다른 쪽은 0 으로 묶인다
  function changeK1(v) { setK1(v); if (paper && Math.abs(v) > 1e-9) setK2(0); }
  function changeK2(v) { setK2(v); if (paper && Math.abs(v) > 1e-9) setK1(0); }
  function togglePaper() {
    const on = !paper; setPaper(on);
    if (on && Math.abs(k1) > 1e-9 && Math.abs(k2) > 1e-9) setK2(0);
  }

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const { k1, k2 } = cur.current;
    const cx = w / 2, cy = h * 0.55;
    const S = Math.min(w, h) * 0.34;
    const { y: ry, x: rx } = rot.current;
    // 곡면 좌표 (x, y, z) → 화면: z 를 위로
    const surf = (x, y) => [x, y, (k1 * x * x + k2 * y * y) / 2];
    const pr = (q) => project3D([q[0] * S, q[2] * S, -q[1] * S], cx, cy, 1, ry, rx); // (x, z, −y): 오른손 좌표계 유지
    const N = 14, lim = 1;

    function poly(fn, n, style, width, dash) {
      ctx.strokeStyle = style; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      ctx.beginPath();
      for (let i = 0; i <= n; i++) { const q = pr(fn(i / n)); if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); }
      ctx.stroke(); ctx.setLineDash([]);
    }
    // 격자
    for (let i = 0; i <= N; i++) {
      const c = -lim + (2 * lim * i) / N;
      poly(t => surf(-lim + 2 * lim * t, c), 30, colors.border, 1);
      poly(t => surf(c, -lim + 2 * lim * t), 30, colors.border, 1);
    }
    // 주곡률 방향 두 곡선
    poly(t => surf(-lim + 2 * lim * t, 0), 40, pal.gauss, 3);
    poly(t => surf(0, -lim + 2 * lim * t), 40, pal.gauss, 3, [7, 5]);
    ctx.font = 'italic bold 15px serif'; ctx.fillStyle = pal.gauss;
    const e1 = pr(surf(lim * 1.08, 0)), e2 = pr(surf(0, lim * 1.08));
    ctx.fillText('κ₁', e1.x + 4, e1.y); ctx.fillText('κ₂', e2.x + 4, e2.y);
    // 작은 원 (둘레를 재는 원)
    poly(t => surf(RHO * Math.cos(TAU * t), RHO * Math.sin(TAU * t)), 60, colors.fgMuted, 1.5, [4, 3]);
    // 법선 n
    const o = pr([0, 0, 0]), nn = pr([0, 0, 0.55]);
    ctx.strokeStyle = pal.normal; ctx.lineWidth = 2.5;
    drawArrow(ctx, o.x, o.y, nn.x, nn.y, 9);
    ctx.fillStyle = pal.normal; ctx.font = 'italic bold 15px serif';
    ctx.fillText('n', nn.x + 6, nn.y);
    ctx.fillStyle = colors.fg; ctx.beginPath(); ctx.arc(o.x, o.y, 4, 0, TAU); ctx.fill();

    ctx.fillStyle = colors.fgMuted; ctx.font = '12px sans-serif';
    ctx.fillText('끌어서 회전 · 점선 원 = 둘레를 재는 작은 원', 10, h - 10);
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

  const G = HEX.gauss;
  const K = k1 * k2;
  const ratio = 1 - K * RHO * RHO / 6;
  const Kt = `\\textcolor{${G}}{K}`, a1 = `\\textcolor{${G}}{\\kappa_1}`, a2 = `\\textcolor{${G}}{\\kappa_2}`;
  const f = (x) => (Math.abs(x) < 5e-3 ? '0.00' : x.toFixed(2));
  let verdict;
  if (Math.abs(K) < 1e-6) verdict = '종이로 만들 수 있다: 굽히기만 하면 되고 늘이거나 찢을 필요가 없다.';
  else if (K > 0) verdict = '종이로는 안 된다: 곡면 위 원의 둘레가 종이 위 원보다 짧아서, 종이가 남아 주름이 진다.';
  else verdict = '종이로는 안 된다: 곡면 위 원의 둘레가 종이 위 원보다 길어서, 종이가 모자라 찢어진다.';

  return (
    <div class="viz-inner">
      <div class="viz-message">
        두 방향을 얼마나 굽히든 종이가 따지는 것은 곱 <Tex>{`${Kt} = ${a1}${a2}`}</Tex> 하나뿐이다. 종이 모드에서 한 방향을 굽히면 다른 방향은 0에 묶인다 — 접은 피자가 처지지 않는 이유.
      </div>
      <canvas ref={canvasRef} />
      <div class="viz-formula">
        <div><Tex>{`${Kt} = ${a1}\\,${a2} = (${f(k1)})(${f(k2)}) = ${f(K)}`}</Tex></div>
        <div><Tex>{`\\frac{C(\\rho)}{2\\pi\\rho} \\approx 1 - \\frac{${Kt}\\rho^2}{6} = ${ratio.toFixed(4)} \\quad (\\rho = ${RHO})`}</Tex></div>
        <div style={{ fontSize: '0.92em' }}>{verdict}{paper && <span> (종이 모드: <Tex>{Kt}</Tex> = 0 유지)</span>}</div>
      </div>
      <div class="viz-controls">
        <Slider label={<Tex>{a1}</Tex>} min={-1.5} max={1.5} step={0.01} value={k1} onChange={changeK1} />
        <Slider label={<Tex>{a2}</Tex>} min={-1.5} max={1.5} step={0.01} value={k2} onChange={changeK2} />
        <button class={'viz-btn' + (paper ? ' active' : '')} onClick={togglePaper}>종이 모드 {paper ? '켜짐' : '꺼짐'}</button>
        {PRESETS.map(p => (
          <button class="viz-btn" onClick={() => { setPaper(p.paper); setK1(p.k1); setK2(p.k2); }}>{p.label}</button>
        ))}
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch08Viz />, el); }
