import { h, render } from 'preact';
import { useState, useRef, useCallback } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { clamp } from './shared/math.js';

const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;

function mercY(lat) { return Math.log(Math.tan(Math.PI / 4 + lat / 2)); }
const MAX_LAT = 82 * DEG;

// Great circle path points
function greatCirclePoints(lat1, lon1, lat2, lon2, n = 100) {
  const pts = [];
  const dLat = lat2 - lat1, dLon = lon2 - lon1;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  if (c < 1e-10) return [[lat1, lon1]];

  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * c) / Math.sin(c);
    const B = Math.sin(f * c) / Math.sin(c);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    pts.push([Math.atan2(z, Math.sqrt(x * x + y * y)), Math.atan2(y, x)]);
  }
  return pts;
}

const CITIES = [
  { name: '서울', lat: 37.5 * DEG, lon: 127 * DEG },
  { name: '뉴욕', lat: 40.7 * DEG, lon: -74 * DEG },
  { name: '상파울루', lat: -23.5 * DEG, lon: -46.6 * DEG },
  { name: '런던', lat: 51.5 * DEG, lon: -0.1 * DEG },
  { name: '시드니', lat: -33.9 * DEG, lon: 151.2 * DEG },
];

function Ch06Viz() {
  const colors = useThemeColors();
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(1);

  const draw = useCallback((ctx, w, h) => {
    const mapW = w * 0.92, mapH = h * 0.82;
    const ox = (w - mapW) / 2, oy = (h - mapH) / 2;
    const lonScale = mapW / (2 * Math.PI);
    const maxMY = mercY(MAX_LAT);
    const latScale = (mapH / 2) / maxMY;

    function toScreen(lat, lon) {
      return {
        x: ox + mapW / 2 + lon * lonScale,
        y: oy + mapH / 2 - mercY(clamp(lat, -MAX_LAT, MAX_LAT)) * latScale,
      };
    }

    // Map background
    ctx.fillStyle = colors.bgCode || colors.bg;
    ctx.fillRect(ox, oy, mapW, mapH);

    // Grid
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 0.5;
    for (let lon = -180; lon <= 180; lon += 30) {
      const p = toScreen(0, lon * DEG);
      ctx.beginPath();
      ctx.moveTo(p.x, oy); ctx.lineTo(p.x, oy + mapH); ctx.stroke();
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const p = toScreen(lat * DEG, 0);
      ctx.beginPath();
      ctx.moveTo(ox, p.y); ctx.lineTo(ox + mapW, p.y); ctx.stroke();
    }

    const from = CITIES[fromIdx], to = CITIES[toIdx];

    // Straight line on Mercator (rhumb line)
    ctx.strokeStyle = '#e53935';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    const pFrom = toScreen(from.lat, from.lon);
    const pTo = toScreen(to.lat, to.lon);
    ctx.beginPath();
    ctx.moveTo(pFrom.x, pFrom.y);
    ctx.lineTo(pTo.x, pTo.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Great circle (geodesic)
    const gcPts = greatCirclePoints(from.lat, from.lon, to.lat, to.lon);
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let prevX = null;
    for (const [lat, lon] of gcPts) {
      const p = toScreen(lat, lon);
      if (prevX !== null && Math.abs(p.x - prevX) > mapW * 0.4) {
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
      } else {
        if (prevX === null) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      prevX = p.x;
    }
    ctx.stroke();

    // City dots
    for (const city of CITIES) {
      const p = toScreen(city.lat, city.lon);
      ctx.fillStyle = (city === from || city === to) ? colors.accent : colors.fgMuted;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (city === from || city === to) ? 5 : 3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = colors.fg;
      ctx.font = '12px sans-serif';
      ctx.fillText(city.name, p.x + 7, p.y + 4);
    }

    // Legend
    ctx.font = '13px sans-serif';
    ctx.strokeStyle = colors.accent; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(12, h - 32); ctx.lineTo(40, h - 32); ctx.stroke();
    ctx.fillStyle = colors.fg;
    ctx.fillText('대원 (측지선, 실제 최단경로)', 44, h - 28);

    ctx.strokeStyle = '#e53935'; ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(12, h - 12); ctx.lineTo(40, h - 12); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText('메르카토르 직선 (등각항로)', 44, h - 8);
  }, [fromIdx, toIdx, colors]);

  const canvasRef = useCanvas(draw, [draw]);

  return (
    <div class="viz-inner">
      <canvas ref={canvasRef} />
      <div class="viz-controls">
        <label class="viz-select"><span>출발</span>
          <select value={fromIdx} onChange={e => setFromIdx(+e.target.value)}>
            {CITIES.map((c, i) => <option value={i}>{c.name}</option>)}
          </select>
        </label>
        <label class="viz-select"><span>도착</span>
          <select value={toIdx} onChange={e => setToIdx(+e.target.value)}>
            {CITIES.map((c, i) => <option value={i}>{c.name}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch06Viz />, el); }
