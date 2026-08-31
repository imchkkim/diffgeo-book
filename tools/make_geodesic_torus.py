"""
토러스 위 측지선 애니메이션 (images/geodesic-torus.gif) 생성기.

6장 "곡면 위의 직선은 뭔가"의 삽화. 측지선 방정식을 직접 적분해서 그린다.
재생성: python3 tools/make_geodesic_torus.py   (필요: numpy, pillow)

토러스 매개화:  P(u,v) = ((R + r cos v) cos u, (R + r cos v) sin u, r sin v)
계량:           ds^2 = f(v)^2 du^2 + r^2 dv^2,   f(v) = R + r cos v
측지선 방정식:  u'' = -2 (f'/f) u' v',   v'' = (f f' / r^2) (u')^2,   f' = -r sin v
"""
import os
import numpy as np
from PIL import Image

R, r = 1.0, 0.40
W, H = 480, 340                      # 최종 크기
SS = 2                               # 슈퍼샘플링 배율
WSS, HSS = W * SS, H * SS
AZ, EL = np.deg2rad(-38.0), np.deg2rad(30.0)

BG    = np.array([255, 255, 255], np.float64)
SURF  = np.array([150, 170, 190], np.float64)   # 회청색 곡면
GRID  = np.array([104, 124, 145], np.float64)   # 좌표선
TRAIL = np.array([230,  74,  25], np.float64)   # 측지선 (앞면)
HIDE  = 0.62 * BG + 0.38 * TRAIL                # 측지선 (뒷면, 점선)
BUG   = np.array([ 30,  30,  30], np.float64)

# ---------- 카메라 (정사영) ----------
d = np.array([np.cos(EL) * np.cos(AZ), np.cos(EL) * np.sin(AZ), np.sin(EL)])
right = np.array([-d[1], d[0], 0.0]); right /= np.linalg.norm(right)
up = np.cross(d, right)

def torus_point(u, v):
    f = R + r * np.cos(v)
    return np.stack([f * np.cos(u), f * np.sin(u), r * np.sin(v)], axis=-1)

def torus_normal(u, v):
    return np.stack([np.cos(v) * np.cos(u), np.cos(v) * np.sin(u), np.sin(v)], axis=-1)

# ---------- 곡면 샘플링 ----------
nu, nv = 2400, 1100
uu, vv = np.meshgrid(np.linspace(0, 2 * np.pi, nu, endpoint=False),
                     np.linspace(0, 2 * np.pi, nv, endpoint=False), indexing="ij")
uu, vv = uu.ravel(), vv.ravel()
P = torus_point(uu, vv)
N = torus_normal(uu, vv)
sx_raw, sy_raw, dz = P @ right, P @ up, P @ d

# 화면에 꽉 차도록 자동 맞춤 (여백 4%)
m = 0.04
SCALE = min(WSS * (1 - 2 * m) / (sx_raw.max() - sx_raw.min()),
            HSS * (1 - 2 * m) / (sy_raw.max() - sy_raw.min()))
CX = WSS / 2 - SCALE * (sx_raw.max() + sx_raw.min()) / 2
CY = HSS / 2 + SCALE * (sy_raw.max() + sy_raw.min()) / 2

def project(Q):
    return CX + (Q @ right) * SCALE, CY - (Q @ up) * SCALE, Q @ d

# ---------- 음영 ----------
light = np.array([-0.45, -0.35, 0.82]); light /= np.linalg.norm(light)
half = (light + d) / np.linalg.norm(light + d)
shade = 0.34 + 0.66 * np.clip(N @ light, 0.0, 1.0) ** 0.85
spec = 0.30 * np.clip(N @ half, 0, 1) ** 22
col = SURF[None, :] * shade[:, None] + 255.0 * spec[:, None]

def gridline(t, step, width):
    mm = np.mod(t, step)
    return np.minimum(mm, step - mm) < width
gmask = gridline(uu, np.pi / 6, 0.007) | gridline(vv, np.pi / 6, 0.016)
col[gmask] = GRID[None, :] * shade[gmask, None] * 0.92

# ---------- z-버퍼 래스터화 (2x2 스플랫으로 구멍 방지) ----------
px = CX + sx_raw * SCALE
py = CY - sy_raw * SCALE
buf = np.tile(BG, (WSS * HSS, 1))
zbuf = np.full(WSS * HSS, -1e9)
order = np.argsort(dz)                       # 가까운 것이 나중에 덮어씀
for ox in (0, 1):
    for oy in (0, 1):
        ix = np.clip(np.floor(px).astype(np.int64) + ox, 0, WSS - 1)
        iy = np.clip(np.floor(py).astype(np.int64) + oy, 0, HSS - 1)
        flat = (iy * WSS + ix)[order]
        keep = dz[order] > zbuf[flat]        # 이미 더 가까운 게 있으면 덮지 않음
        buf[flat[keep]] = col[order][keep]
        zbuf[flat[keep]] = dz[order][keep]
base = buf.reshape(HSS, WSS, 3)
zbuf = zbuf.reshape(HSS, WSS)

# ---------- 측지선 적분 (RK4, 단위 속력) ----------
def deriv(s):
    u, v, du, dv = s
    f = R + r * np.cos(v)
    fp = -r * np.sin(v)
    return np.array([du, dv, -2.0 * (fp / f) * du * dv, (f * fp / r ** 2) * du * du])

v0, alpha = 0.35, np.deg2rad(42.0)
f0 = R + r * np.cos(v0)
state = np.array([0.0, v0, np.cos(alpha) / f0, np.sin(alpha) / r])
T, STEPS = 15.0, 6000
dt = T / STEPS
path = np.empty((STEPS + 1, 2)); path[0] = state[:2]
for i in range(STEPS):
    k1 = deriv(state); k2 = deriv(state + dt / 2 * k1)
    k3 = deriv(state + dt / 2 * k2); k4 = deriv(state + dt * k3)
    state = state + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
    path[i + 1] = state[:2]

pu, pv = path[:, 0], path[:, 1]
EPS = 0.020                                   # 곡면에서 살짝 띄워 z-fighting 방지
ppx, ppy, ppz = project(torus_point(pu, pv) + EPS * torus_normal(pu, pv))
pix = np.clip(np.round(ppx).astype(np.int64), 0, WSS - 1)
piy = np.clip(np.round(ppy).astype(np.int64), 0, HSS - 1)
front = ppz > zbuf[piy, pix] - 0.012           # 앞면이면 실선, 아니면 점선
dash = (np.arange(len(pu)) // 34) % 2 == 0     # 뒷면 구간 점선 패턴

def disc(rad):
    o = np.arange(-rad, rad + 1)
    dx, dy = np.meshgrid(o, o, indexing="ij")
    msk = dx ** 2 + dy ** 2 <= rad ** 2
    return dx[msk], dy[msk]

D_TRAIL, D_HIDE, D_BUG, D_RING = disc(4), disc(3), disc(8), disc(11)

def splat(img, idxs, dxy, color):
    if len(idxs) == 0:
        return
    dx, dy = dxy
    X = np.clip(pix[idxs][:, None] + dx[None, :], 0, WSS - 1).ravel()
    Y = np.clip(piy[idxs][:, None] + dy[None, :], 0, HSS - 1).ravel()
    img[Y, X] = color

# ---------- 프레임 ----------
NFRAMES, HOLD = 58, 8
frames = []
for k in range(NFRAMES + HOLD):
    n = STEPS if k >= NFRAMES else int(round(STEPS * (k + 1) / NFRAMES))
    img = base.copy()
    sel = np.arange(n)
    splat(img, sel[~front[:n] & dash[:n]], D_HIDE, HIDE)   # 뒤로 돌아간 구간
    splat(img, sel[front[:n]], D_TRAIL, TRAIL)             # 보이는 구간
    head = np.array([n - 1])
    splat(img, head, D_RING, BG if front[n - 1] else HIDE)
    splat(img, head, D_BUG, BUG if front[n - 1] else HIDE * 0.75)
    frames.append(Image.fromarray(img.astype(np.uint8)).resize((W, H), Image.LANCZOS))

master = frames[NFRAMES - 1].quantize(colors=64, method=Image.MEDIANCUT)
pframes = [f.quantize(palette=master, dither=Image.Dither.NONE) for f in frames]

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "..", "images", "geodesic-torus.gif")
pframes[0].save(OUT, save_all=True, append_images=pframes[1:],
                duration=[70] * NFRAMES + [60] * (HOLD - 1) + [900],
                loop=0, optimize=True, disposal=1)
print("saved:", OUT)
print("v범위(도):", round(np.rad2deg(pv.min()), 1), "~", round(np.rad2deg(pv.max()), 1),
      "| u회전:", round(pu.max() / (2 * np.pi), 2), "바퀴 | 앞면비율:", round(front.mean(), 2))
