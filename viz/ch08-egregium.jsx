import { h, render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { Select } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';

const TAU = 2 * Math.PI;

const SURFACES = [
  { value: 'sphere', label: '구면 (K > 0)' },
  { value: 'cylinder', label: '원통 (K = 0)' },
  { value: 'saddle', label: '안장면 (K < 0)' },
  { value: 'plane', label: '평면 (K = 0)' },
];

function Ch08Viz() {
  const colors = useThemeColors();
  const [surface, setSurface] = useState('sphere');

  const rot = useRef({ y: -0.5, x: 0.3 });
  const dragRef = useRef(null);

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const cx = w / 2, cy = h * 0.38;
    const S = Math.min(w, h) * 0.28;

    const COL_BLUE = colors.accent;
    const COL_ORANGE = '#FF9800';
    const COL_GREEN = '#43A047';
    const COL_RED = '#e53935';
    const COL_PURPLE = '#7B1FA2';

    // Draw surface wireframe
    const steps = 30;

    function surfacePoint(u, v) {
      switch (surface) {
        case 'sphere':
          return [
            S * Math.sin(u) * Math.cos(v),
            -S * Math.cos(u) * 0.6 + S * 0.1,
            S * Math.sin(u) * Math.sin(v),
          ];
        case 'cylinder':
          return [
            S * 0.5 * Math.cos(v),
            -S * (u - Math.PI / 2) * 0.5,
            S * 0.5 * Math.sin(v),
          ];
        case 'saddle':
          const su = (u - Math.PI / 2) / Math.PI;
          const sv = (v - Math.PI) / Math.PI;
          return [
            su * S * 0.8,
            (su * su - sv * sv) * S * 0.4,
            sv * S * 0.8,
          ];
        case 'plane':
          return [
            (u - Math.PI / 2) / Math.PI * S * 0.9,
            0,
            (v - Math.PI) / Math.PI * S * 0.9,
          ];
      }
    }

    function proj(p) {
      const [x, y, z] = p;
      const rotY = rot.current.y, rotX = rot.current.x;
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      let rx = x * cosY + z * sinY, rz = -x * sinY + z * cosY;
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      let ry = y * cosX - rz * sinX;
      rz = y * sinX + rz * cosX;
      return { x: cx + rx, y: cy - ry, z: rz };
    }

    // U lines
    ctx.strokeStyle = colors.fgMuted;
    ctx.lineWidth = 0.7;
    ctx.globalAlpha = 0.4;
    for (let i = 0; i <= 10; i++) {
      const u = (i / 10) * Math.PI;
      ctx.beginPath();
      for (let j = 0; j <= steps; j++) {
        const v = (j / steps) * TAU;
        const p = proj(surfacePoint(u, v));
        if (j === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // V lines
    for (let j = 0; j <= 12; j++) {
      const v = (j / 12) * TAU;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const u = (i / steps) * Math.PI;
        const p = proj(surfacePoint(u, v));
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Draw a triangle on the surface
    const triU = [0.6, 1.2, 0.9];
    const triV = [2.5, 2.2, 3.5];
    const triPts = triU.map((u, i) => proj(surfacePoint(u, triV[i])));

    ctx.strokeStyle = COL_PURPLE;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(triPts[0].x, triPts[0].y);
    triPts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(123,31,162,0.12)';
    ctx.fill();

    // Surface-specific curvature values
    let k1, k2, K, k1Str, k2Str, triArea, insight;
    switch (surface) {
      case 'sphere':
        k1 = 1; k2 = 1; K = 1;
        k1Str = '1.00'; k2Str = '1.00'; triArea = 0.15;
        insight = '\uAD6C\uBA74\uC740 \uD3C9\uBA74\uC73C\uB85C \uD3BC\uCE60 \uC218 \uC5C6\uB2E4 (K \u2260 0)';
        break;
      case 'cylinder':
        k1 = 1; k2 = 0; K = 0;
        k1Str = '1.00'; k2Str = '0.00'; triArea = 0.15;
        insight = '\uC6D0\uD1B5 = \uC885\uC774\uB97C \uB9D0\uC740 \uAC83 \u2192 \uB0B4\uC7AC\uC801\uC73C\uB85C \uD3C9\uD3C9';
        break;
      case 'saddle':
        k1 = 0.8; k2 = -0.8; K = -0.64;
        k1Str = '0.80'; k2Str = '\u22120.80'; triArea = 0.15;
        insight = '\uC548\uC7A5\uBA74: \uB450 \uBC29\uD5A5\uC73C\uB85C \uBC18\uB300\uB85C \uD718\uC5B4\uC9C4\uB2E4';
        break;
      case 'plane':
        k1 = 0; k2 = 0; K = 0;
        k1Str = '0.00'; k2Str = '0.00'; triArea = 0.15;
        insight = '\uD3C9\uBA74: \uBAA8\uB4E0 \uACE1\uB960\uC774 0';
        break;
    }

    const angleSumDeg = 180 + K * triArea * (180 / Math.PI);

    // --- Formula panel ---
    const panelY = h * 0.68;
    const panelX = 14;
    const lineH = 20;

    // Line 1: K = k1 x k2 (color coded)
    ctx.font = 'bold 15px monospace';
    let xOff = panelX;

    const COL_K = K > 0 ? COL_GREEN : K < 0 ? COL_RED : colors.fgMuted;
    ctx.fillStyle = COL_K;
    ctx.fillText('K', xOff, panelY);
    xOff += ctx.measureText('K').width;
    ctx.fillStyle = colors.fg;
    ctx.fillText(' = ', xOff, panelY);
    xOff += ctx.measureText(' = ').width;
    ctx.fillStyle = COL_BLUE;
    ctx.fillText('\u03BA\u2081', xOff, panelY);
    xOff += ctx.measureText('\u03BA\u2081').width;
    ctx.fillStyle = colors.fg;
    ctx.fillText(' \u00D7 ', xOff, panelY);
    xOff += ctx.measureText(' \u00D7 ').width;
    ctx.fillStyle = COL_ORANGE;
    ctx.fillText('\u03BA\u2082', xOff, panelY);
    xOff += ctx.measureText('\u03BA\u2082').width;
    ctx.fillStyle = colors.fg;
    ctx.fillText(' = ', xOff, panelY);
    xOff += ctx.measureText(' = ').width;
    ctx.fillStyle = COL_BLUE;
    ctx.fillText(k1Str, xOff, panelY);
    xOff += ctx.measureText(k1Str).width;
    ctx.fillStyle = colors.fg;
    ctx.fillText(' \u00D7 ', xOff, panelY);
    xOff += ctx.measureText(' \u00D7 ').width;
    ctx.fillStyle = COL_ORANGE;
    ctx.fillText(k2Str, xOff, panelY);
    xOff += ctx.measureText(k2Str).width;
    ctx.fillStyle = colors.fg;
    ctx.fillText(' = ', xOff, panelY);
    xOff += ctx.measureText(' = ').width;
    ctx.fillStyle = COL_K;
    ctx.fillText(K.toFixed(2), xOff, panelY);

    // Line 2: angle sum formula
    const y2 = panelY + lineH + 4;
    ctx.font = '14px monospace';
    xOff = panelX;
    ctx.fillStyle = COL_PURPLE;
    ctx.fillText('\u2211\u03B1', xOff, y2);
    xOff += ctx.measureText('\u2211\u03B1').width;
    ctx.fillStyle = colors.fg;
    ctx.fillText(' = 180\u00B0 + ', xOff, y2);
    xOff += ctx.measureText(' = 180\u00B0 + ').width;
    ctx.fillStyle = COL_K;
    ctx.fillText('K', xOff, y2);
    xOff += ctx.measureText('K').width;
    ctx.fillStyle = colors.fg;
    ctx.fillText('\u00D7Area = ', xOff, y2);
    xOff += ctx.measureText('\u00D7Area = ').width;
    ctx.fillStyle = COL_PURPLE;
    ctx.fillText(angleSumDeg.toFixed(1) + '\u00B0', xOff, y2);

    // Line 3: extrinsic vs intrinsic
    const y3 = y2 + lineH + 2;
    ctx.font = '13px monospace';
    ctx.fillStyle = COL_BLUE;
    ctx.fillText('\u03BA\u2081', panelX, y3);
    ctx.fillStyle = colors.fgMuted;
    ctx.fillText(',', panelX + ctx.measureText('\u03BA\u2081').width, y3);
    let x3 = panelX + ctx.measureText('\u03BA\u2081,').width;
    ctx.fillStyle = COL_ORANGE;
    ctx.fillText('\u03BA\u2082', x3, y3);
    x3 += ctx.measureText('\u03BA\u2082').width;
    ctx.fillStyle = colors.fgMuted;
    ctx.fillText(' = \uC678\uC7AC\uC801(extrinsic)    ', x3, y3);
    x3 += ctx.measureText(' = \uC678\uC7AC\uC801(extrinsic)    ').width;
    ctx.fillStyle = COL_K;
    ctx.fillText('K', x3, y3);
    x3 += ctx.measureText('K').width;
    ctx.fillStyle = colors.fgMuted;
    ctx.fillText(' = \uB0B4\uC7AC\uC801(intrinsic)', x3, y3);

    // Line 4: insight
    const y4 = y3 + lineH;
    ctx.font = '13px sans-serif';
    ctx.fillStyle = colors.fgMuted;
    ctx.fillText(insight, panelX, y4);

    // Hint text
    ctx.fillStyle = colors.fgMuted;
    ctx.font = '11px sans-serif';
    ctx.globalAlpha = 0.5;
    ctx.textAlign = 'right';
    ctx.fillText('\uB4DC\uB798\uADF8\uD558\uC5EC \uD68C\uC804', w - 12, h - 12);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  };

  const canvasRef = useCanvas(drawRef);

  usePointer(canvasRef, {
    onDown: (pos) => {
      dragRef.current = { mx: pos.x, my: pos.y, ry: rot.current.y, rx: rot.current.x };
    },
    onDrag: (pos) => {
      if (!dragRef.current) return;
      rot.current = {
        y: dragRef.current.ry + (pos.x - dragRef.current.mx) * 0.01,
        x: dragRef.current.rx - (pos.y - dragRef.current.my) * 0.01,
      };
    },
    onUp: () => { dragRef.current = null; },
  });

  return (
    <div class="viz-inner">
      <canvas ref={canvasRef} />
      <div class="viz-controls">
        <Select label="곡면" options={SURFACES} value={surface} onChange={setSurface} />
        <span style={{ color: 'var(--fg-muted)', fontSize: '0.85em' }}>
          K = κ₁κ₂는 내재적 — 밖에서 보지 않고도 측정 가능
        </span>
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch08Viz />, el); }
