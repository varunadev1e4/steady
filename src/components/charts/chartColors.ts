import { useEffect, useState } from 'react';

export interface ChartColors {
  series: string;
  second: string;
  grid: string;
  axis: string;
  ink: string;
  surface: string;
  /** Validated pair for two-series charts. */
  c1: string;
  c2: string;
}

function read(): ChartColors {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => `rgb(${css.getPropertyValue(`--${name}`).trim().split(/\s+/).join(', ')})`;
  return {
    series: v('accent'),
    second: v('clay'),
    grid: v('border'),
    axis: v('muted'),
    ink: v('ink'),
    surface: v('surface'),
    c1: v('chart-1'),
    c2: v('chart-2'),
  };
}

/** Theme colours for SVG charts, re-read whenever light/dark mode changes. */
export function useChartColors(): ChartColors {
  const [colors, setColors] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setColors(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return colors;
}
