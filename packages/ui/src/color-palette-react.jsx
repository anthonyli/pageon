"use client";

import { useEffect, useRef } from 'react';
import { createColorPalette, DEFAULT_COLORS } from './color-palette.js';

export function ColorPalette({ value, onChange, label, disabled = false, colors = DEFAULT_COLORS, compact = false, customLabel = "Custom color" }) {
  const host = useRef(null), control = useRef(null), change = useRef(onChange);
  useEffect(() => { change.current = onChange; }, [onChange]);
  useEffect(() => {
    control.current = createColorPalette(host.current, { colors, compact, customLabel, onChange: color => change.current?.(color) });
    return () => { control.current.destroy(); control.current = null; };
  }, [colors, compact]);
  useEffect(() => { control.current?.update({ value, label, disabled, customLabel }); }, [value, label, disabled, customLabel, colors, compact]);
  return <div ref={host} />;
}
