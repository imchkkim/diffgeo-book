import { h, render } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { useCanvas, usePointer } from './shared/canvas-utils.jsx';
import { useThemeColors } from './shared/theme.jsx';
import { clamp, project3D, drawSphereWireframe } from './shared/math.js';

const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;

function mercY(lat) { return Math.log(Math.tan(Math.PI / 4 + lat / 2)); }
const MAX_LAT = 82 * DEG;

function greatCirclePoints(lat1, lon1, lat2, lon2, n = 120) {
  const pts = [];
  const a = Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2;
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

function rhumbLinePoints(lat1, lon1, lat2, lon2, n = 120) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    pts.push([lat1 + f * (lat2 - lat1), lon1 + f * (lon2 - lon1)]);
  }
  return pts;
}

function latLonToCart(lat, lon, r = 1) {
  return [r * Math.cos(lat) * Math.cos(lon), r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat)];
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
  const rot = useRef({ y: -1.8, x: 0.3 });
  const dragRef = useRef(null);

  const drawRef = useRef(null);
  drawRef.current = (ctx, w, h) => {
    const mid = w * 0.5;
    const from = CITIES[fromIdx], to = CITIES[toIdx];
    const gcPts = greatCirclePoints(from.lat, from.lon, to.lat, to.lon);
    const rhPts = rhumbLinePoints(from.lat, from.lon, to.lat, to.lon);

    // === LEFT: Mercator 2D ===
    const mW = mid - 16, mH = h - 50;
    const mox = 8, moy = 30;
    const lonScale = mW / (2 * Math.PI);
    const maxMY = mercY(MAX_LAT);
    const latScale = (mH / 2) / maxMY;

    function toMerc(lat, lon) {
      return {
        x: mox + mW / 2 + lon * lonScale,
        y: moy + mH / 2 - mercY(clamp(lat, -MAX_LAT, MAX_LAT)) * latScale,
      };
    }

    // Map bg
    ctx.fillStyle = colors.bgCode || colors.bg;
    ctx.fillRect(mox, moy, mW, mH);

    // Grid
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 0.5;
    for (let lon = -180; lon <= 180; lon += 30) {
      const p = toMerc(0, lon * DEG);
      ctx.beginPath(); ctx.moveTo(p.x, moy); ctx.lineTo(p.x, moy + mH); ctx.stroke();
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const p = toMerc(lat * DEG, 0);
      ctx.beginPath(); ctx.moveTo(mox, p.y); ctx.lineTo(mox + mW, p.y); ctx.stroke();
    }

    // Rhumb line (Mercator straight line)
    ctx.strokeStyle = '#e53935';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    let prevMX = null;
    for (const [lat, lon] of rhPts) {
      const p = toMerc(lat, lon);
      if (prevMX !== null && Math.abs(p.x - prevMX) > mW * 0.4) {
        ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x, p.y);
      } else {
        if (prevMX === null) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      prevMX = p.x;
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Great circle on Mercator
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    prevMX = null;
    for (const [lat, lon] of gcPts) {
      const p = toMerc(lat, lon);
      if (prevMX !== null && Math.abs(p.x - prevMX) > mW * 0.4) {
        ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x, p.y);
      } else {
        if (prevMX === null) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      prevMX = p.x;
    }
    ctx.stroke();

    // City dots on Mercator
    for (const city of CITIES) {
      const p = toMerc(city.lat, city.lon);
      const active = city === from || city === to;
      ctx.fillStyle = active ? colors.accent : colors.fgMuted;
      ctx.beginPath(); ctx.arc(p.x, p.y, active ? 5 : 3, 0, TAU); ctx.fill();
      if (active) {
        ctx.fillStyle = colors.fg;
        ctx.font = '11px sans-serif';
        ctx.fillText(city.name, p.x + 7, p.y + 4);
      }
    }

    ctx.fillStyle = colors.fg;
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('메르카토르 도법 (2D)', mox, 20);

    // === RIGHT: 3D Sphere ===
    const sCx = mid + (w - mid) / 2, sCy = h / 2;
    const sR = Math.min(w - mid, h) * 0.38;
    const { y: rotY, x: rotX } = rot.current;

    // Wireframe
    drawSphereWireframe(ctx, sCx, sCy, sR, rotY, rotX, colors.fgMuted, 20);

    // Helper to project lat/lon to 3D screen
    function toSphere(lat, lon) {
      const cart = latLonToCart(lat, lon, sR);
      return project3D(cart, sCx, sCy, 1, rotY, rotX);
    }

    // Rhumb line on sphere
    ctx.strokeStyle = '#e53935';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    let started = false;
    for (const [lat, lon] of rhPts) {
      const p = toSphere(lat, lon);
      if (p.z < 0) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Great circle on sphere
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    started = false;
    for (const [lat, lon] of gcPts) {
      const p = toSphere(lat, lon);
      if (p.z < 0) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // City dots on sphere
    for (const city of CITIES) {
      const p = toSphere(city.lat, city.lon);
      if (p.z < 0) continue;
      const active = city === from || city === to;
      ctx.fillStyle = active ? colors.accent : colors.fgMuted;
      ctx.beginPath(); ctx.arc(p.x, p.y, active ? 5 : 3, 0, TAU); ctx.fill();
      if (active) {
        ctx.fillStyle = colors.fg;
        ctx.font = '11px sans-serif';
        ctx.fillText(city.name, p.x + 7, p.y + 4);
      }
    }

    ctx.fillStyle = colors.fg;
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('3D 구면 (드래그 회전)', mid + 8, 20);

    // === Bottom legend ===
    ctx.font = '12px sans-serif';
    ctx.strokeStyle = colors.accent; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(8, h - 14); ctx.lineTo(30, h - 14); ctx.stroke();
    ctx.fillStyle = colors.fg;
    ctx.fillText('대원 (측지선) — 실제 최단경로', 34, h - 10);

    ctx.strokeStyle = '#e53935'; ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(w / 2, h - 14); ctx.lineTo(w / 2 + 22, h - 14); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText('등각항로 — 메르카토르 위 직선', w / 2 + 28, h - 10);
  };

  const canvasRef = useCanvas(drawRef);

  // Drag to rotate the 3D sphere (right half only)
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
        <label class="viz-select"><span>출발</span>
          <select value={fromIdx} onChange={e => setFromIdx(+e.target.value)}>
            {CITIES.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
          </select>
        </label>
        <label class="viz-select"><span>도착</span>
          <select value={toIdx} onChange={e => setToIdx(+e.target.value)}>
            {CITIES.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

export function mount(el) { render(<Ch06Viz />, el); }
