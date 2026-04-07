import { h } from 'preact';

export function Slider({ label, min = 0, max = 1, step = 0.01, value, onChange }) {
  return (
    <label class="viz-slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onInput={(e) => onChange(parseFloat(e.target.value))} />
      <span class="viz-slider-val">{typeof value === 'number' ? value.toFixed(2) : value}</span>
    </label>
  );
}

export function Toggle({ label, value, onChange }) {
  return (
    <label class="viz-toggle">
      <input type="checkbox" checked={value}
        onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Select({ label, options, value, onChange }) {
  return (
    <label class="viz-select">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
