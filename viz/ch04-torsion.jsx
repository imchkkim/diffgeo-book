// 4장 — 비틀림: 아주 작은 평행사변형이 닫히는가?
// 평면 위에 비틀림이 있는 접속 Γ^k_12 = τ^k/2, Γ^k_21 = −τ^k/2 를 둔다.
// u 로 간 뒤 옮겨 온 v' = v − ½det(u,v)τ 로 가는 길과, 순서를 바꾼 길의 끝점 차이가
// 정확히 T(u,v) = det(u,v)·τ 이다 (ε = 1 로 그린 그림).
// 색: u·v = dir, 옮겨 온 벡터 = dir 점선, 비틀림 T = torsion.
import { h, render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { Slider } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { usePalette, HEX } from './shared/palette.js';
import { Tex } from './shared/tex.jsx';
import { drawArrow } from './shared/math.js';

const TAU = 2 * Math.PI;

function Ch04TorsionViz() {
  const colors = useThemeColors();
  const pal = usePalette();
  const tcol = pal.torsion;
  const [tau, setTau] = useState(0.35);      // 비틀림 크기
  const [beta, setBeta] = useState(1.2);     // 비틀림 방향 τ 의 각도
  const vec = useRef({ u: [1.1, 0.0], v: [0.35, 0.95] });
  const [view, setView] = useState({ ...vec.current });
  const drag = useRef(null);
  const pending = useRef(false);

  function update() {
    if (!pending.current) {
      pending.current = true;
      requestAnimationFrame(() => { pending.current = false; setView({ ...vec.current }); });
    }
  }

  function geom(w, h) {
    const unit = Math.min(w / 4.2, h / 2.9);
    return { ox: w / 2 - 0.8 * unit, oy: h / 2 + 0.7 * unit, unit };
  }

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const { u, v } = vec.current;
    const { ox, oy, unit } = geom(w, h);
    const S = ([x, y]) => [ox + x * unit, oy - y * unit];
    const tv = [tau * Math.cos(beta), tau * Math.sin(beta)];
    const det = u[0] * v[1] - u[1] * v[0];
    const vp = [v[0] - 0.5 * det * tv[0], v[1] - 0.5 * det * tv[1]]; // u 를 따라 옮겨 온 v
    const up = [u[0] + 0.5 * det * tv[0], u[1] + 0.5 * det * tv[1]]; // v 를 따라 옮겨 온 u
    const C1 = [u[0] + vp[0], u[1] + vp[1]];
    const C2 = [v[0] + up[0], v[1] + up[1]];

    // 격자
    ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
    for (let k = -6; k <= 6; k++) {
      const [x] = S([k * 0.5, 0]); const [, y] = S([0, k * 0.5]);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    // 비틀림이 없을 때의 평행사변형 (참고용 회색)
    const P0 = S([0, 0]), A = S(u), B = S(v), Cn = S([u[0] + v[0], u[1] + v[1]]);
    ctx.fillStyle = colors.fgMuted; ctx.globalAlpha = 0.08;
    ctx.beginPath(); ctx.moveTo(...P0); ctx.lineTo(...A); ctx.lineTo(...Cn); ctx.lineTo(...B); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;

    // 두 길
    ctx.strokeStyle = pal.dir; ctx.lineWidth = 3;
    drawArrow(ctx, ...P0, ...A, 10);
    drawArrow(ctx, ...P0, ...B, 10);
    ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    drawArrow(ctx, ...A, ...S(C1), 8);
    drawArrow(ctx, ...B, ...S(C2), 8);
    ctx.setLineDash([]);

    ctx.fillStyle = pal.dir; ctx.font = 'bold italic 16px serif';
    const lab = (p, q, t, dx, dy) => { const m = S([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]); ctx.fillText(t, m[0] + dx, m[1] + dy); };
    lab([0, 0], u, 'u', 0, 18);
    lab([0, 0], v, 'v', -16, 0);
    ctx.font = 'italic 14px serif';
    lab(u, C1, "v′", 8, 0);
    lab(v, C2, "u′", 0, -8);

    // 끌 수 있는 끝점
    for (const p of [A, B]) {
      ctx.fillStyle = colors.bg; ctx.strokeStyle = pal.dir; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = colors.fg;
    ctx.beginPath(); ctx.arc(P0[0], P0[1], 4.5, 0, TAU); ctx.fill();

    // 틈 = T(u, v)
    const gap = Math.hypot(C2[0] - C1[0], C2[1] - C1[1]);
    const s1 = S(C1), s2 = S(C2);
    if (gap * unit > 3) {
      ctx.strokeStyle = tcol; ctx.fillStyle = tcol; ctx.lineWidth = 3;
      drawArrow(ctx, ...s1, ...s2, 9);
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('틈 = T(u, v)', Math.max(s1[0], s2[0]) + 10, (s1[1] + s2[1]) / 2);
    } else {
      ctx.fillStyle = colors.fg; ctx.font = 'bold 14px sans-serif';
      ctx.fillText('닫힘 ✓', s1[0] + 10, s1[1] - 6);
    }
    // τ 방향 표시 (왼쪽 위)
    const tx = 44, ty = 44;
    ctx.strokeStyle = tcol; ctx.fillStyle = tcol; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(tx, ty, 26, 0, TAU); ctx.globalAlpha = 0.25; ctx.stroke(); ctx.globalAlpha = 1;
    if (tau !== 0) drawArrow(ctx, tx, ty, tx + 26 * Math.sign(tau) * Math.cos(beta), ty - 26 * Math.sign(tau) * Math.sin(beta), 7);
    ctx.font = '12px sans-serif';
    ctx.fillText('비틀림 방향', tx - 30, ty + 44);

    ctx.fillStyle = colors.fgMuted; ctx.font = '12px sans-serif';
    ctx.fillText('u, v 의 끝점을 끌어 보기', 10, h - 10);
  };

  const canvasRef = useCanvas(drawRef);

  usePointer(canvasRef, {
    onDown: (pos) => {
      const c = canvasRef.current;
      const { ox, oy, unit } = geom(c.clientWidth, c.clientHeight);
      const { u, v } = vec.current;
      const du = Math.hypot(pos.x - (ox + u[0] * unit), pos.y - (oy - u[1] * unit));
      const dv = Math.hypot(pos.x - (ox + v[0] * unit), pos.y - (oy - v[1] * unit));
      drag.current = Math.min(du, dv) < 28 ? (du < dv ? 'u' : 'v') : null;
    },
    onDrag: (pos) => {
      if (!drag.current) return;
      const c = canvasRef.current;
      const { ox, oy, unit } = geom(c.clientWidth, c.clientHeight);
      let p = [(pos.x - ox) / unit, -(pos.y - oy) / unit];
      const n = Math.hypot(...p);
      if (n > 1.6) p = p.map(x => x * 1.6 / n);
      vec.current[drag.current] = p;
      update();
    },
    onUp: () => { drag.current = null; },
  });

  const { u, v } = view;
  const det = u[0] * v[1] - u[1] * v[0];
  const T = [det * tau * Math.cos(beta), det * tau * Math.sin(beta)];
  const D = HEX.dir, Tc = HEX.torsion, Cn = HEX.conn;
  const uu = `\\textcolor{${D}}{u}`, vv = `\\textcolor{${D}}{v}`;
  const TT = `\\textcolor{${Tc}}{T}`;

  return (
    <div class="viz-inner">
      <div class="viz-message">
        비틀림이 있는 접속에서는 두 길의 끝이 어긋나고, 그 틈 <Tex>{`${TT}(${uu},${vv})`}</Tex>는 <Tex>{`${uu}`}</Tex>와 <Tex>{`${vv}`}</Tex>가 만드는 넓이에 비례한다. 두 벡터를 나란히 놓거나 비틀림을 0으로 하면 틈이 사라진다.
      </div>
      <canvas ref={canvasRef} />
      <div class="viz-formula">
        <div>
          <Tex>{`${TT}(${uu},${vv}) = \\textcolor{${Cn}}{\\nabla}_{${uu}}${vv} - \\textcolor{${Cn}}{\\nabla}_{${vv}}${uu} - [${uu},${vv}] = \\det(${uu},${vv})\\,\\tau`}</Tex>
        </div>
        <div>
          <Tex>{`\\det(${uu},${vv}) = ${det.toFixed(2)}\\ \\text{(평행사변형의 넓이)}`}</Tex>
        </div>
        <div>
          <Tex>{`${TT}(${uu},${vv}) = (${T[0].toFixed(2)},\\ ${T[1].toFixed(2)}),\\qquad |${TT}| = ${Math.hypot(...T).toFixed(2)}`}</Tex>
        </div>
      </div>
      <div class="viz-controls">
        <Slider label={<Tex>{`\\text{비틀림 크기 } \\tau`}</Tex>} min={-0.8} max={0.8} step={0.01} value={tau} onChange={setTau} />
        <Slider label="비틀림 방향" min={0} max={TAU} step={0.01} value={beta} onChange={setBeta} />
        <button class="viz-btn" onClick={() => setTau(0)}>레비-치비타 (τ = 0)</button>
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch04TorsionViz />, el); }
