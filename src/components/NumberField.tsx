'use client';
import { useEffect, useState } from 'react';

/** Number input that lets the user type freely and commits a clamped value on blur/Enter. */
export function NumberField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  id?: string;
}) {
  const { label, value, onChange, min, max, step = 0.5, unit = 'mm', id } = props;
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const commit = () => {
    const n = Number.parseFloat(text);
    if (!Number.isFinite(n)) return setText(String(value));
    const snapped = Math.round(Math.min(max, Math.max(min, n)) / step) * step;
    const v = Number(snapped.toFixed(3));
    setText(String(v));
    if (v !== value) onChange(v);
  };

  return (
    <label className="field">
      {label}
      <span className="row">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={text}
          min={min}
          max={max}
          step={step}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
        <span className="muted small">{unit}</span>
      </span>
    </label>
  );
}
