import React from 'react';
import type { MarkerShape } from '../data/databaseRepository';

interface CountryMarkerSvgProps {
  shape: MarkerShape;
  color: string;
  size?: number;
}

/**
 * Renders a crisp inline SVG symbol so country identity never depends on color alone.
 */
export const CountryMarkerIcon: React.FC<CountryMarkerSvgProps> = ({
  shape,
  color,
  size = 12,
}) => {
  const half = size / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      {shape === 'circle' && (
        <circle cx={half} cy={half} r={half - 1.5} fill={color} stroke="#ffffff" strokeWidth="1" />
      )}
      {shape === 'square' && (
        <rect x={2} y={2} width={size - 4} height={size - 4} rx={1} fill={color} stroke="#ffffff" strokeWidth="1" />
      )}
      {shape === 'diamond' && (
        <polygon
          points={`${half},1 ${size - 1},${half} ${half},${size - 1} 1,${half}`}
          fill={color}
          stroke="#ffffff"
          strokeWidth="1"
        />
      )}
      {shape === 'triangle' && (
        <polygon
          points={`${half},1.2 ${size - 1.2},${size - 1.5} 1.2,${size - 1.5}`}
          fill={color}
          stroke="#ffffff"
          strokeWidth="1"
        />
      )}
      {shape === 'cross' && (
        <g stroke={color} strokeWidth="2.2" strokeLinecap="round">
          <line x1={2.5} y1={2.5} x2={size - 2.5} y2={size - 2.5} />
          <line x1={size - 2.5} y1={2.5} x2={2.5} y2={size - 2.5} />
        </g>
      )}
    </svg>
  );
};

interface RechartsDotProps {
  cx?: number;
  cy?: number;
  value?: number | null;
  shape: MarkerShape;
  color: string;
  radius?: number;
}

/**
 * Custom Recharts SVG dot renderer pairing country color with a distinct geometric shape.
 * Skips rendering when value is null or undefined so missing data leaves an honest gap.
 */
export function renderCountryChartDot({
  cx,
  cy,
  value,
  shape,
  color,
  radius = 4.2,
}: RechartsDotProps): React.ReactElement | null {
  if (cx === undefined || cy === undefined || value === null || value === undefined) {
    return null;
  }
  const r = radius;
  switch (shape) {
    case 'circle':
      return <circle cx={cx} cy={cy} r={r} fill={color} stroke="#ffffff" strokeWidth={1.3} />;
    case 'square':
      return (
        <rect
          x={cx - r + 0.4}
          y={cy - r + 0.4}
          width={(r - 0.4) * 2}
          height={(r - 0.4) * 2}
          fill={color}
          stroke="#ffffff"
          strokeWidth={1.2}
        />
      );
    case 'diamond':
      return (
        <polygon
          points={`${cx},${cy - r - 0.8} ${cx + r + 0.8},${cy} ${cx},${cy + r + 0.8} ${cx - r - 0.8},${cy}`}
          fill={color}
          stroke="#ffffff"
          strokeWidth={1.2}
        />
      );
    case 'triangle':
      return (
        <polygon
          points={`${cx},${cy - r - 0.8} ${cx + r + 0.7},${cy + r} ${cx - r - 0.7},${cy + r}`}
          fill={color}
          stroke="#ffffff"
          strokeWidth={1.2}
        />
      );
    case 'cross':
      return (
        <g>
          <circle cx={cx} cy={cy} r={r + 1.2} fill="#ffffff" fillOpacity={0.85} />
          <line x1={cx - r + 0.5} y1={cy - r + 0.5} x2={cx + r - 0.5} y2={cy + r - 0.5} stroke={color} strokeWidth={2} strokeLinecap="round" />
          <line x1={cx + r - 0.5} y1={cy - r + 0.5} x2={cx - r + 0.5} y2={cy + r - 0.5} stroke={color} strokeWidth={2} strokeLinecap="round" />
        </g>
      );
  }
}
