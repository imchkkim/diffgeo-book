import { h, render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas } from './shared/canvas-utils.jsx';
import { Slider } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { clamp } from './shared/math.js';

const TAU = 2 * Math.PI;
const BLUE = '#2196F3';
const ORANGE = '#FF9800';

function mercY(lat) {
  return Math.log(Math.tan(Math.PI / 4 + lat / 2));
}

function Ch03Viz() {
  const colors = useThemeColors();
  const [lat, setLat] = useState(0);

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const mapW = w * 0.9, mapH = h * 0.75;
    const ox = (w - mapW) / 2, oy = (h - mapH) / 2 + 40;
    const lonScale = mapW / (2 * Math.PI);
    const maxMercY = mercY(85 * Math.PI / 180);
    const latScale = (mapH / 2) / maxMercY;

    function toScreen(latR, lonR) {
      const mx = ox + mapW / 2 + lonR * lonScale;
      const my = oy + mapH / 2 - mercY(latR) * latScale;
      return { x: mx, y: my };
    }

    // === Formula panel at top ===
    const thetaVal = Math.PI / 2 - lat; // colatitude (θ = π/2 - latitude)
    const sinTheta = Math.sin(thetaVal);
    const sin2Theta = sinTheta * sinTheta;
    const latDeg = (lat * 180 / Math.PI).toFixed(0);

    const panelX = 10;
    const panelY = 6;
    const panelW = Math.min(w - 20, 460);
    const panelH = 80;
    const lineH = 18;

    // Panel background
    ctx.fillStyle = (colors.bgCode || colors.bg);
    ctx.globalAlpha = 0.88;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colors.border || colors.fgMuted;
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    const tx = panelX + 8;
    let ty = panelY + 18;

    // Main metric formula: ds² = R²(dθ² + sin²θ · dφ²)
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = colors.fg;
    ctx.fillText('ds² = R²(', tx, ty);
    const afterOpen = tx + ctx.measureText('ds² = R²(').width;

    ctx.fillStyle = BLUE;
    ctx.fillText('dθ²', afterOpen, ty);
    const afterDt = afterOpen + ctx.measureText('dθ²').width;

    ctx.fillStyle = colors.fg;
    ctx.fillText(' + ', afterDt, ty);
    const afterPlus = afterDt + ctx.measureText(' + ').width;

    ctx.fillStyle = ORANGE;
    ctx.fillText(`sin²θ · dφ²`, afterPlus, ty);
    const afterDp = afterPlus + ctx.measureText('sin²θ · dφ²').width;

    ctx.fillStyle = colors.fg;
    ctx.fillText(')', afterDp, ty);

    // With actual value substituted
    ty += lineH * 1.2;
    ctx.font = '12px monospace';
    ctx.fillStyle = colors.fg;
    ctx.fillText(`위도 ${latDeg}° → θ = ${thetaVal.toFixed(2)}:  ds² = R²(`, tx, ty);
    const afterEq = tx + ctx.measureText(`위도 ${latDeg}° → θ = ${thetaVal.toFixed(2)}:  ds² = R²(`).width;

    ctx.fillStyle = BLUE;
    ctx.fillText('dθ²', afterEq, ty);
    const afterDt2 = afterEq + ctx.measureText('dθ²').width;

    ctx.fillStyle = colors.fg;
    ctx.fillText(' + ', afterDt2, ty);
    const afterPlus2 = afterDt2 + ctx.measureText(' + ').width;

    ctx.fillStyle = ORANGE;
    ctx.fillText(`${sin2Theta.toFixed(3)}·dφ²`, afterPlus2, ty);
    const afterDp2 = afterPlus2 + ctx.measureText(`${sin2Theta.toFixed(3)}·dφ²`).width;

    ctx.fillStyle = colors.fg;
    ctx.fillText(')', afterDp2, ty);

    // Distortion description
    ty += lineH * 1.2;
    ctx.font = '12px monospace';
    ctx.fillStyle = ORANGE;
    const distortionText = sin2Theta < 0.001
      ? `sin²θ = ${sin2Theta.toFixed(4)} → dφ 방향 거의 무한 왜곡 (극점)`
      : `sin²θ = ${sin2Theta.toFixed(3)} → dφ 방향 ${(1 / sinTheta).toFixed(2)}배 확대 필요`;
    ctx.fillText(distortionText, tx, ty);

    // Background
    ctx.fillStyle = colors.bgCode || colors.bg;
    ctx.fillRect(ox, oy, mapW, mapH);

    // Grid lines
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 0.5;

    // Longitude lines
    for (let lon = -180; lon <= 180; lon += 30) {
      const lonR = lon * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(toScreen(-85 * Math.PI / 180, lonR).x, toScreen(-85 * Math.PI / 180, lonR).y);
      ctx.lineTo(toScreen(85 * Math.PI / 180, lonR).x, toScreen(85 * Math.PI / 180, lonR).y);
      ctx.stroke();
    }

    // Latitude lines
    for (let la = -60; la <= 60; la += 30) {
      const latR = la * Math.PI / 180;
      ctx.beginPath();
      const left = toScreen(latR, -Math.PI);
      const right = toScreen(latR, Math.PI);
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.stroke();
    }

    // Draw Tissot's indicatrix at several positions
    const indicatrices = [];
    for (let la = -60; la <= 60; la += 30) {
      for (let lo = -150; lo <= 150; lo += 60) {
        indicatrices.push([la * Math.PI / 180, lo * Math.PI / 180]);
      }
    }

    const trueR = 0.12;

    for (const [iLat, iLon] of indicatrices) {
      const center = toScreen(iLat, iLon);
      const scaleFactor = 1 / Math.cos(iLat);
      const pixelR = trueR * lonScale;
      const rX = pixelR;
      const rY = pixelR * scaleFactor;

      ctx.fillStyle = 'rgba(33,150,243,0.2)';
      ctx.strokeStyle = 'rgba(33,150,243,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, Math.abs(rX), Math.abs(rY), 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    // Highlight ellipse at selected latitude with color-coded axes
    const hlCenter = toScreen(lat, 0);
    const hlScale = 1 / Math.cos(lat);
    const hlR = trueR * lonScale;

    // Filled ellipse
    ctx.fillStyle = 'rgba(233,30,99,0.2)';
    ctx.strokeStyle = '#E91E63';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(hlCenter.x, hlCenter.y, hlR, hlR * hlScale, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Blue semi-axis (dθ direction — horizontal in Mercator = along latitude)
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hlCenter.x - hlR, hlCenter.y);
    ctx.lineTo(hlCenter.x + hlR, hlCenter.y);
    ctx.stroke();

    // Orange semi-axis (dφ direction — vertical in Mercator = along longitude, stretched)
    ctx.strokeStyle = ORANGE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hlCenter.x, hlCenter.y - hlR * hlScale);
    ctx.lineTo(hlCenter.x, hlCenter.y + hlR * hlScale);
    ctx.stroke();

    // Label the axes
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = BLUE;
    ctx.fillText('dθ', hlCenter.x + hlR + 4, hlCenter.y + 4);
    ctx.fillStyle = ORANGE;
    ctx.fillText('dφ', hlCenter.x + 4, hlCenter.y - hlR * hlScale - 4);

    // True circle (dashed) for comparison
    ctx.strokeStyle = colors.fgMuted;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(hlCenter.x, hlCenter.y, hlR, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    // Bottom legend
    ctx.fillStyle = BLUE;
    ctx.font = '12px sans-serif';
    ctx.fillText('━ dθ (위도 방향, 왜곡 없음)', 12, h - 30);
    ctx.fillStyle = ORANGE;
    ctx.fillText('━ dφ (경도 방향, sin²θ에 따라 왜곡)', 12, h - 12);
  };

  const canvasRef = useCanvas(drawRef);

  return (
    <div class="viz-inner">
      <canvas ref={canvasRef} />
      <div class="viz-controls">
        <Slider label="위도" min={-1.2} max={1.2} step={0.01} value={lat}
          onChange={setLat} />
        <span style={{ color: 'var(--fg-muted)', fontSize: '0.85em' }}>
          적도(sin²θ=1)에서는 왜곡 없음, 극(sin²θ→0)에서는 무한 왜곡
        </span>
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch03Viz />, el); }
