import { h, render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { Slider } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { drawArrow } from './shared/math.js';

// Torsion visualization: does the infinitesimal parallelogram close?
// Two vectors u, v at a point. Extend u along v and v along u.
// Torsion-free: the parallelogram closes. With torsion: a gap appears.

function Ch04TorsionViz() {
  const colors = useThemeColors();
  const [torsion, setTorsion] = useState(0); // torsion amount
  const [vAngle, setVAngle] = useState(2.0); // angle of v relative to u
  const dragRef = useRef(null);
  const rot = useRef({ angle: 0 }); // drag to rotate view

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    const S = Math.min(w, h) * 0.25;

    // Two tangent vectors at origin
    const ux = 1, uy = 0;
    const vx = Math.cos(vAngle), vy = Math.sin(vAngle);

    // The four corners of the would-be parallelogram
    // P: origin
    const Px = 0, Py = 0;
    // A: go along u
    const Ax = ux, Ay = uy;
    // B: go along v
    const Bx = vx, By = vy;
    // C (no torsion): go along u then v = go along v then u
    const Cx_notorsion = ux + vx, Cy_notorsion = uy + vy;
    // C (with torsion): the two paths don't meet — gap = torsion vector
    // Torsion T(u,v) = ∇_u v - ∇_v u - [u,v]
    // For visualization: the gap is proportional to torsion, perpendicular to the parallelogram
    const torsionVecX = -torsion * (vy - uy) * 0.5;
    const torsionVecY = torsion * (vx - ux) * 0.5;

    // Path 1: P → A → C1 (go along u, then transport v)
    const C1x = Cx_notorsion + torsionVecX;
    const C1y = Cy_notorsion + torsionVecY;

    // Path 2: P → B → C2 (go along v, then transport u)
    const C2x = Cx_notorsion - torsionVecX;
    const C2y = Cy_notorsion - torsionVecY;

    function toScreen(x, y) {
      return { x: cx + x * S, y: cy - y * S };
    }

    // Draw faint grid
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.2;
    for (let i = -4; i <= 4; i++) {
      const a = toScreen(i, -4), b = toScreen(i, 4);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      const c = toScreen(-4, i), d = toScreen(4, i);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const P = toScreen(Px, Py);
    const A = toScreen(Ax, Ay);
    const B = toScreen(Bx, By);
    const C1 = toScreen(C1x, C1y);
    const C2 = toScreen(C2x, C2y);
    const Cno = toScreen(Cx_notorsion, Cy_notorsion);

    // Path 1: P→A→C1 (blue, solid)
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(P.x, P.y); ctx.lineTo(A.x, A.y);
    ctx.stroke();
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(A.x, A.y); ctx.lineTo(C1.x, C1.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Path 2: P→B→C2 (orange, solid)
    ctx.strokeStyle = '#FF9800';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(P.x, P.y); ctx.lineTo(B.x, B.y);
    ctx.stroke();
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(B.x, B.y); ctx.lineTo(C2.x, C2.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Vector labels
    ctx.font = 'bold 14px sans-serif';
    const uMid = toScreen(ux * 0.5, uy * 0.5);
    ctx.fillStyle = colors.accent;
    ctx.fillText('u', uMid.x, uMid.y - 10);
    const vMid = toScreen(vx * 0.5, vy * 0.5);
    ctx.fillStyle = '#FF9800';
    ctx.fillText('v', vMid.x - 14, vMid.y - 4);

    // Transported vector labels (dashed parts)
    ctx.font = '12px sans-serif';
    const tuvMid = toScreen((Ax + C1x) / 2, (Ay + C1y) / 2);
    ctx.fillStyle = '#FF9800';
    ctx.fillText('v 이동', tuvMid.x + 4, tuvMid.y - 6);
    const tuvMid2 = toScreen((Bx + C2x) / 2, (By + C2y) / 2);
    ctx.fillStyle = colors.accent;
    ctx.fillText('u 이동', tuvMid2.x + 4, tuvMid2.y + 16);

    // Dots
    for (const [pt, col] of [[P, colors.fg], [A, colors.accent], [B, '#FF9800']]) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 5, 0, TAU); ctx.fill();
    }

    // If torsion != 0, show the gap
    if (Math.abs(torsion) > 0.01) {
      // Gap line C1 → C2
      ctx.strokeStyle = '#e53935';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(C1.x, C1.y); ctx.lineTo(C2.x, C2.y);
      ctx.stroke();

      // Gap dots
      ctx.fillStyle = '#e53935';
      ctx.beginPath(); ctx.arc(C1.x, C1.y, 5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(C2.x, C2.y, 5, 0, TAU); ctx.fill();

      // Label
      const gapMid = { x: (C1.x + C2.x) / 2, y: (C1.y + C2.y) / 2 };
      ctx.fillStyle = '#e53935';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('틈! (비틀림)', gapMid.x + 8, gapMid.y - 4);
    } else {
      // They meet at the same point
      ctx.fillStyle = '#43A047';
      ctx.beginPath(); ctx.arc(Cno.x, Cno.y, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#43A047';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('만남! ✓', Cno.x + 10, Cno.y - 4);
    }

    // Title and explanation
    ctx.fillStyle = colors.fg;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('비틀림(Torsion): 평행사변형이 닫히는가?', 12, 22);

    ctx.fillStyle = colors.fgMuted;
    ctx.font = '12px sans-serif';

    if (Math.abs(torsion) < 0.01) {
      ctx.fillText('비틀림 = 0: u를 따라 간 뒤 v로 가든, v를 따라 간 뒤 u로 가든 같은 점에 도착', 12, h - 28);
      ctx.fillText('레비-치비타 접속은 항상 이 조건을 만족한다', 12, h - 10);
    } else {
      ctx.fillText(`비틀림 ≠ 0: 두 경로의 끝점이 어긋남 (틈 = T(u,v))`, 12, h - 28);
      ctx.fillText('비틀림이 있으면 좌표 격자가 "꼬여" 있다 — 레비-치비타는 이를 금지', 12, h - 10);
    }
  };

  const canvasRef = useCanvas(drawRef);

  return (
    <div class="viz-inner">
      <canvas ref={canvasRef} />
      <div class="viz-controls">
        <Slider label="비틀림 T" min={-1.5} max={1.5} step={0.01} value={torsion} onChange={setTorsion} />
        <Slider label="v 방향" min={0.5} max={2.8} step={0.01} value={vAngle} onChange={setVAngle} />
      </div>
    </div>
  );
}

const TAU = 2 * Math.PI;

export function mount(el) { render(<Ch04TorsionViz />, el); }
