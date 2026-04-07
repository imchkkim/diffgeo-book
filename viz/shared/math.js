// ===== Spherical Coordinates =====

export function sphereToCart(theta, phi, r = 1) {
  return [
    r * Math.sin(theta) * Math.cos(phi),
    r * Math.sin(theta) * Math.sin(phi),
    r * Math.cos(theta),
  ];
}

export function cartToSphere(x, y, z) {
  const r = Math.sqrt(x * x + y * y + z * z);
  return [Math.acos(z / r), Math.atan2(y, x), r];
}

// ===== Projections =====

export function project3D(point, cx, cy, scale, rotY = 0, rotX = 0) {
  let [x, y, z] = point;
  // Rotate around Y
  const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
  [x, z] = [x * cosY + z * sinY, -x * sinY + z * cosY];
  // Rotate around X
  const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
  [y, z] = [y * cosX - z * sinX, y * sinX + z * cosX];
  return { x: cx + x * scale, y: cy - y * scale, z };
}

export function mercatorProject(lat, lon, cx, cy, scale) {
  const x = cx + lon * scale;
  const y = cy - Math.log(Math.tan(Math.PI / 4 + lat / 2)) * scale;
  return { x, y };
}

// ===== Vector Operations =====

export function vecAdd(a, b) { return a.map((v, i) => v + b[i]); }
export function vecSub(a, b) { return a.map((v, i) => v - b[i]); }
export function vecScale(a, s) { return a.map(v => v * s); }
export function vecDot(a, b) { return a.reduce((s, v, i) => s + v * b[i], 0); }
export function vecNorm(a) { return Math.sqrt(vecDot(a, a)); }
export function vecNormalize(a) { const n = vecNorm(a); return n > 0 ? vecScale(a, 1 / n) : a; }
export function vecCross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

// ===== Matrix Operations =====

export function matMul3(A, B) {
  const C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++)
        C[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j];
  return C;
}

export function matVec3(M, v) {
  return [
    M[0] * v[0] + M[1] * v[1] + M[2] * v[2],
    M[3] * v[0] + M[4] * v[1] + M[5] * v[2],
    M[6] * v[0] + M[7] * v[1] + M[8] * v[2],
  ];
}

export function rotationMatrix(axis, angle) {
  const [x, y, z] = vecNormalize(axis);
  const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  return [
    t * x * x + c,     t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c,     t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c,
  ];
}

// ===== Geodesics on S2 =====

export function slerp(a, b, t) {
  const an = vecNormalize(a);
  const bn = vecNormalize(b);
  let dot = vecDot(an, bn);
  dot = Math.max(-1, Math.min(1, dot));
  const omega = Math.acos(dot);
  if (omega < 1e-10) return an;
  const so = Math.sin(omega);
  return vecAdd(
    vecScale(an, Math.sin((1 - t) * omega) / so),
    vecScale(bn, Math.sin(t * omega) / so)
  );
}

// ===== Parallel Transport on S2 =====

export function parallelTransportS2(v, from, to) {
  const fromN = vecNormalize(from);
  const toN = vecNormalize(to);
  const dot = vecDot(fromN, toN);
  if (dot > 0.9999) return v;
  if (dot < -0.9999) return vecScale(v, -1);

  const axis = vecCross(fromN, toN);
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
  const R = rotationMatrix(axis, angle);
  return matVec3(R, v);
}

// ===== Drawing Helpers =====

export function drawArrow(ctx, x0, y0, x1, y1, headLen = 8) {
  const dx = x1 - x0, dy = y1 - y0;
  const angle = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x1 - headLen * Math.cos(angle - 0.4), y1 - headLen * Math.sin(angle - 0.4));
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - headLen * Math.cos(angle + 0.4), y1 - headLen * Math.sin(angle + 0.4));
  ctx.stroke();
}

export function drawSphereWireframe(ctx, cx, cy, r, rotY, rotX, color, steps = 24) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.3;

  // Latitude lines
  for (let i = 1; i < 6; i++) {
    const theta = (i / 6) * Math.PI;
    ctx.beginPath();
    for (let j = 0; j <= steps; j++) {
      const phi = (j / steps) * 2 * Math.PI;
      const p = project3D(sphereToCart(theta, phi, r), cx, cy, 1, rotY, rotX);
      if (j === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  // Longitude lines
  for (let i = 0; i < 12; i++) {
    const phi = (i / 12) * 2 * Math.PI;
    ctx.beginPath();
    for (let j = 0; j <= steps; j++) {
      const theta = (j / steps) * Math.PI;
      const p = project3D(sphereToCart(theta, phi, r), cx, cy, 1, rotY, rotX);
      if (j === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function lerp(a, b, t) { return a + (b - a) * t; }
export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
