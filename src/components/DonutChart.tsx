// A real donut chart — stacked circle strokes via react-native-svg, the
// standard technique (each segment is one Circle with a strokeDasharray
// covering its share of the circumference, rotated -90deg as a group so
// the first segment starts at 12 o'clock like a normal pie chart).
import React from 'react';
import Svg, { Circle } from 'react-native-svg';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
}

export default function DonutChart({ segments, size = 140, strokeWidth = 22, trackColor = '#E0E0E0' }: Props) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  let offsetAccum = 0;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {total === 0 ? (
        <Circle cx={center} cy={center} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
      ) : (
        segments
          .filter((s) => s.value > 0)
          .map((seg, i) => {
            const fraction = seg.value / total;
            const dash = fraction * circumference;
            const strokeDashoffset = -offsetAccum;
            offsetAccum += dash;
            return (
              <Circle
                key={`${seg.label}-${i}`}
                cx={center}
                cy={center}
                r={radius}
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={strokeDashoffset}
                fill="none"
                rotation="-90"
                origin={`${center}, ${center}`}
              />
            );
          })
      )}
    </Svg>
  );
}
