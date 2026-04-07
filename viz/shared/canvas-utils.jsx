import { useEffect, useRef, useCallback } from 'preact/hooks';

export function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const container = canvas.parentElement;
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = canvas.offsetHeight * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const ro = new ResizeObserver(() => {
    const w = container.clientWidth;
    const h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const c = canvas.getContext('2d');
    c.scale(dpr, dpr);
  });
  ro.observe(container);

  return { ctx, w: rect.width, h: canvas.offsetHeight, cleanup: () => ro.disconnect() };
}

export function useCanvas(drawRef) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;

    function sizeCanvas() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
    }

    sizeCanvas();

    const loop = () => {
      sizeCanvas();
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      drawRef.current(ctx, w, h);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return canvasRef;
}

export function usePointer(canvasRef, handlers) {
  const hRef = useRef(handlers);
  hRef.current = handlers;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let dragging = false;
    let moved = false;

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }

    function onDown(e) {
      dragging = true;
      moved = false;
      hRef.current.onDown?.(getPos(e));
      e.preventDefault();
    }
    function onMove(e) {
      const pos = getPos(e);
      if (dragging) {
        moved = true;
        hRef.current.onDrag?.(pos);
      } else {
        hRef.current.onHover?.(pos);
      }
      e.preventDefault();
    }
    function onUp(e) {
      if (dragging) {
        dragging = false;
        const pos = e.changedTouches ? { x: 0, y: 0 } : getPos(e);
        if (moved) {
          hRef.current.onUp?.(pos);
        } else {
          hRef.current.onClick?.(pos);
          hRef.current.onUp?.(pos);
        }
      }
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
}
