import { h, render } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { useCanvas } from './shared/canvas-utils.jsx';
import { Slider } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { drawArrow } from './shared/math.js';

const TAU = 2 * Math.PI;

function Ch04Viz() {
  const colors = useThemeColors();
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [initAngle, setInitAngle] = useState(Math.PI / 2);
  const animRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    function tick(now) {
      const dt = (now - last) / 1000;
      last = now;
      setT(prev => {
        const next = prev + dt * 0.25;
        if (next >= 1) { setPlaying(false); return 1; }
        return next;
      });
      animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing]);

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const theta = t * Math.PI / 2;
    const splitX = w * 0.52;

    // === LEFT PANEL: Animation ===
    const lcx = splitX * 0.5, lcy = h * 0.5;
    const R = Math.min(splitX, h) * 0.34;
    const arrowLen = R * 0.3;

    const px = lcx + R * Math.cos(theta);
    const py = lcy - R * Math.sin(theta);

    // Polar grid
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.3;
    for (let r = 1; r <= 3; r++) {
      ctx.beginPath();
      ctx.arc(lcx, lcy, (r / 3) * R * 1.2, 0, TAU);
      ctx.stroke();
    }
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * TAU;
      ctx.beginPath();
      ctx.moveTo(lcx, lcy);
      ctx.lineTo(lcx + R * 1.2 * Math.cos(ang), lcy - R * 1.2 * Math.sin(ang));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Arc path
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(lcx, lcy, R, 0, -Math.PI / 2, true);
    ctx.stroke();

    // Local basis
    const erx = Math.cos(theta), ery = -Math.sin(theta);
    const etx = -Math.sin(theta), ety = -Math.cos(theta);
    const bLen = R * 0.16;

    ctx.strokeStyle = colors.fgMuted;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    drawArrow(ctx, px, py, px + erx * bLen, py + ery * bLen, 4);
    drawArrow(ctx, px, py, px + etx * bLen, py + ety * bLen, 4);
    ctx.setLineDash([]);
    ctx.fillStyle = colors.fgMuted;
    ctx.font = '10px sans-serif';
    ctx.fillText('ê_r', px + erx * bLen + 3, py + ery * bLen);
    ctx.fillText('ê_θ', px + etx * bLen + 3, py + ety * bLen - 3);

    // Vectors
    const initVr = Math.cos(initAngle);
    const initVt = Math.sin(initAngle);

    // Naive (fixed components)
    const naive_dx = (initVr * erx + initVt * etx) * arrowLen;
    const naive_dy = (initVr * ery + initVt * ety) * arrowLen;

    // Correct (parallel transport)
    const correct_dx = Math.cos(initAngle) * arrowLen;
    const correct_dy = -Math.sin(initAngle) * arrowLen;

    ctx.strokeStyle = '#43A047';
    ctx.lineWidth = 3;
    drawArrow(ctx, px, py, px + correct_dx, py + correct_dy, 8);

    ctx.strokeStyle = '#e53935';
    ctx.lineWidth = 3;
    drawArrow(ctx, px, py, px + naive_dx, py + naive_dy, 8);

    ctx.fillStyle = colors.fg;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, TAU);
    ctx.fill();

    // Angle difference arc
    if (t > 0.05) {
      const naiveAng = Math.atan2(naive_dy, naive_dx);
      const correctAng = Math.atan2(correct_dy, correct_dx);
      ctx.strokeStyle = 'rgba(233,30,99,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, arrowLen * 0.35, correctAng, naiveAng, naiveAng > correctAng);
      ctx.stroke();
    }

    // Left legend
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#43A047';
    ctx.fillText('━ 평행이동 (∇V = 0)', 8, 18);
    ctx.fillStyle = '#e53935';
    ctx.fillText('━ 성분 고정 (∂V = 0)', 8, 34);
    ctx.fillStyle = colors.fgMuted;
    ctx.font = '11px sans-serif';
    ctx.fillText('드래그: 초기 방향 변경', 8, h - 8);

    // === RIGHT PANEL: Γ computation ===
    const rx = splitX + 8;
    const rw = w - rx - 8;
    const mono = "'JetBrains Mono','Fira Code',monospace";

    ctx.fillStyle = colors.fg;
    ctx.font = `bold 13px sans-serif`;
    ctx.fillText('극좌표 크리스토펠 기호', rx, 22);

    ctx.font = `13px ${mono}`;
    ctx.fillStyle = colors.accent;
    const sy = 48;
    ctx.fillText('Γʳθθ = −r', rx, sy);
    ctx.fillText('Γᶿrθ = Γᶿθr = 1/r', rx, sy + 20);

    // Current state
    ctx.fillStyle = colors.fg;
    ctx.font = `bold 12px sans-serif`;
    ctx.fillText(`θ = ${(theta * 180 / Math.PI).toFixed(0)}°`, rx, sy + 50);

    // Parallel transport equation: dV/dθ + Γ·V = 0
    // dV^r/dθ = -Γʳθθ · V^θ = r · V^θ
    // dV^θ/dθ = -Γᶿθr · V^r = -(1/r) · V^r

    // Current components for parallel-transported vector
    const ptVr = Math.cos(initAngle - theta);   // V^r at current θ
    const ptVt = Math.sin(initAngle - theta);    // V^θ at current θ (times r for display)

    ctx.fillStyle = colors.fg;
    ctx.font = `bold 12px sans-serif`;
    ctx.fillText('평행이동 조건: ∇V = 0', rx, sy + 78);

    ctx.font = `12px ${mono}`;
    ctx.fillStyle = '#43A047';
    const ey = sy + 100;
    ctx.fillText(`Vʳ = ${ptVr.toFixed(2)}`, rx, ey);
    ctx.fillText(`Vᶿ = ${ptVt.toFixed(2)}`, rx + rw * 0.4, ey);

    ctx.fillStyle = colors.fg;
    ctx.font = `12px sans-serif`;
    ctx.fillText('성분이 변하지만 (∂V ≠ 0)', rx, ey + 24);
    ctx.fillText('Γ 보정이 상쇄하여 ∇V = 0:', rx, ey + 42);

    ctx.font = `12px ${mono}`;
    ctx.fillStyle = colors.accent;
    // Show the cancellation
    const dVr = ptVt;  // dV^r/dθ = r·V^θ (r=1)
    const gammaTermR = -ptVt;  // -Γʳθθ·V^θ... wait, let me recalculate

    // For r = const path: ∇_θ V^r = ∂V^r/∂θ + Γʳ_θr V^r + Γʳ_θθ V^θ
    // Γʳ_θr = 0, Γʳ_θθ = -r
    // So: ∇_θ V^r = ∂V^r/∂θ + (-r)V^θ = ∂V^r/∂θ - r·V^θ = 0
    // → ∂V^r/∂θ = r·V^θ

    // ∇_θ V^θ = ∂V^θ/∂θ + Γᶿ_θr V^r + Γᶿ_θθ V^θ
    // Γᶿ_θr = 1/r, Γᶿ_θθ = 0
    // So: ∇_θ V^θ = ∂V^θ/∂θ + (1/r)V^r = 0
    // → ∂V^θ/∂θ = -(1/r)V^r

    const partialVr = ptVt;         // ∂V^r/∂θ = r·V^θ (r=1)
    const gammaVr = -ptVt;          // Γʳθθ·V^θ = -r·V^θ (r=1)
    const partialVt = -ptVr;        // ∂V^θ/∂θ = -(1/r)V^r
    const gammaVt = ptVr;           // Γᶿθr·V^r = (1/r)·V^r

    const cy2 = ey + 64;
    ctx.fillStyle = '#e53935';
    ctx.fillText(`∂Vʳ/∂θ = ${partialVr >= 0 ? '+' : ''}${partialVr.toFixed(2)}`, rx, cy2);
    ctx.fillStyle = '#43A047';
    ctx.fillText(`Γ·V   = ${gammaVr >= 0 ? '+' : ''}${gammaVr.toFixed(2)}`, rx + rw * 0.45, cy2);
    ctx.fillStyle = colors.fg;
    ctx.fillText(`→ 합 = ${(partialVr + gammaVr).toFixed(2)}`, rx, cy2 + 18);

    ctx.fillStyle = '#e53935';
    ctx.fillText(`∂Vᶿ/∂θ = ${partialVt >= 0 ? '+' : ''}${partialVt.toFixed(2)}`, rx, cy2 + 42);
    ctx.fillStyle = '#43A047';
    ctx.fillText(`Γ·V   = ${gammaVt >= 0 ? '+' : ''}${gammaVt.toFixed(2)}`, rx + rw * 0.45, cy2 + 42);
    ctx.fillStyle = colors.fg;
    ctx.fillText(`→ 합 = ${(partialVt + gammaVt).toFixed(2)}`, rx, cy2 + 60);

    // Summary
    ctx.fillStyle = colors.fgMuted;
    ctx.font = '11px sans-serif';
    ctx.fillText('편미분(빨강)과 Γ보정(초록)이', rx, h - 28);
    ctx.fillText('정확히 상쇄 → 공변미분 = 0', rx, h - 12);
  };

  const canvasRef = useCanvas(drawRef);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onDown(e) { e.preventDefault(); dragRef.current = true; handle(e); }
    function onMove(e) { if (!dragRef.current) return; e.preventDefault(); handle(e); }
    function onUp() { dragRef.current = null; }
    function handle(e) {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches ? e.touches[0] : e;
      const mx = touch.clientX - rect.left, my = touch.clientY - rect.top;
      const w = rect.width, hh = rect.height;
      const lcx = w * 0.52 * 0.5, lcy = hh * 0.5;
      const R = Math.min(w * 0.52, hh) * 0.34;
      const sx = lcx + R, sy = lcy;
      setInitAngle(Math.atan2(-(my - sy), mx - sx));
    }
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('mouseleave', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onUp);
    return () => {
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('mouseleave', onUp);
      canvas.removeEventListener('touchstart', onDown);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onUp);
    };
  }, [canvasRef.current]);

  return (
    <div class="viz-inner">
      <canvas ref={canvasRef} />
      <div class="viz-controls">
        <button
          style={{ padding: '0.3em 1em', borderRadius: '4px', border: '1px solid var(--border)',
                   background: 'var(--bg-code)', color: 'var(--fg)', cursor: 'pointer' }}
          onClick={() => {
            if (t >= 0.99) { setT(0); setTimeout(() => setPlaying(true), 50); }
            else setPlaying(!playing);
          }}>
          {playing ? '⏸ 일시정지' : t >= 0.99 ? '↻ 다시' : '▶ 재생'}
        </button>
        <Slider label="위치 θ" min={0} max={1} step={0.005} value={t}
          onChange={(v) => { setPlaying(false); setT(v); }} />
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch04Viz />, el); }
