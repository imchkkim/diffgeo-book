import { h, render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas } from './shared/canvas-utils.jsx';
import { Slider } from './shared/controls.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { clamp } from './shared/math.js';

const TAU = 2 * Math.PI;

function mercY(lat) {
  return Math.log(Math.tan(Math.PI / 4 + lat / 2));
}

function Ch03Viz() {
  const colors = useThemeColors();
  const [lat, setLat] = useState(0);

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const mapW = w * 0.9, mapH = h * 0.85;
    const ox = (w - mapW) / 2, oy = (h - mapH) / 2;
    const lonScale = mapW / (2 * Math.PI);
    const maxMercY = mercY(85 * Math.PI / 180);
    const latScale = (mapH / 2) / maxMercY;

    function toScreen(latR, lonR) {
      const mx = ox + mapW / 2 + lonR * lonScale;
      const my = oy + mapH / 2 - mercY(latR) * latScale;
      return { x: mx, y: my };
    }

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

    // The "true" radius on the sphere (in radians)
    const trueR = 0.12;

    for (const [iLat, iLon] of indicatrices) {
      const center = toScreen(iLat, iLon);
      // Mercator distortion: scale factor = 1/cos(lat)
      const scaleFactor = 1 / Math.cos(iLat);
      const pixelR = trueR * lonScale;
      const rX = pixelR; // longitude direction: always same in Mercator
      const rY = pixelR * scaleFactor; // latitude direction: stretched

      ctx.fillStyle = 'rgba(33,150,243,0.2)';
      ctx.strokeStyle = 'rgba(33,150,243,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, Math.abs(rX), Math.abs(rY), 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    // Highlight circle at selected latitude
    const hlCenter = toScreen(lat, 0);
    const hlScale = 1 / Math.cos(lat);
    const hlR = trueR * lonScale;

    ctx.fillStyle = 'rgba(233,30,99,0.3)';
    ctx.strokeStyle = '#E91E63';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(hlCenter.x, hlCenter.y, hlR, hlR * hlScale, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // True circle (dashed) for comparison
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(hlCenter.x, hlCenter.y, hlR, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = colors.fg;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`위도 ${(lat * 180 / Math.PI).toFixed(0)}°`, 12, 22);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = colors.fgMuted;
    ctx.fillText(`왜곡 배율: ${hlScale.toFixed(2)}×`, 12, 42);

    ctx.fillStyle = '#E91E63';
    ctx.fillText('● 메르카토르 위의 원 (왜곡됨)', 12, h - 30);
    ctx.fillStyle = colors.accent;
    ctx.fillText('◌ 실제 크기 (기준)', 12, h - 12);
  };

  const canvasRef = useCanvas(drawRef);

  return (
    <div class="viz-inner">
      <canvas ref={canvasRef} />
      <div class="viz-controls">
        <Slider label="위도" min={-1.2} max={1.2} step={0.01} value={lat}
          onChange={setLat} />
        <span style={{ color: 'var(--fg-muted)', fontSize: '0.85em' }}>
          같은 크기의 원이 위도에 따라 다르게 보인다 = 계량이 장소마다 다르다
        </span>
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch03Viz />, el); }
