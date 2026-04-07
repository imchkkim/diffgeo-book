import { useEffect, useRef, useCallback } from 'preact/hooks';

export function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const ro = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
  });
  ro.observe(canvas);

  return { ctx, w: rect.width, h: rect.height, cleanup: () => ro.disconnect() };
}

export function useCanvas(draw, deps = []) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { ctx, cleanup } = setupCanvas(canvas);

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      draw(ctx, rect.width, rect.height);
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      cleanup();
    };
  }, deps);

  return canvasRef;
}

export function usePointer(canvasRef, handlers) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let dragging = false;

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }

    function onDown(e) {
      dragging = true;
      handlers.onDown?.(getPos(e));
      e.preventDefault();
    }
    function onMove(e) {
      const pos = getPos(e);
      if (dragging) handlers.onDrag?.(pos);
      else handlers.onHover?.(pos);
      e.preventDefault();
    }
    function onUp(e) {
      if (dragging) {
        dragging = false;
        handlers.onUp?.(e.changedTouches ? { x: 0, y: 0 } : getPos(e));
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
  }, [canvasRef.current, ...Object.values(handlers)]);
}
