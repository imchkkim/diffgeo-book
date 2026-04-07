import { useState, useEffect } from 'preact/hooks';

function readColors() {
  const s = getComputedStyle(document.documentElement);
  return {
    bg: s.getPropertyValue('--bg').trim() || '#ffffff',
    bgCode: s.getPropertyValue('--bg-code').trim() || '#f5f5f5',
    fg: s.getPropertyValue('--fg').trim() || '#1a1a1a',
    fgMuted: s.getPropertyValue('--fg-muted').trim() || '#555',
    accent: s.getPropertyValue('--accent').trim() || '#1565C0',
    border: s.getPropertyValue('--border').trim() || '#ddd',
  };
}

export function useThemeColors() {
  const [colors, setColors] = useState(readColors);

  useEffect(() => {
    const obs = new MutationObserver(() => setColors(readColors()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  return colors;
}
