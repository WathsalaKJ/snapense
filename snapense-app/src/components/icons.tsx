/**
 * Tab bar icons as inline SVG paths.
 * These paths are the source of truth for the icon set - edit with care.
 */

import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export interface IconProps {
  color: string;
  size?: number;
}

export function TransactionsIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Path
        d="M7 5.5h11M7 11h11M7 16.5h11"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={3.2} cy={5.5} r={1.4} fill={color} />
      <Circle cx={3.2} cy={11} r={1.4} fill={color} />
      <Circle cx={3.2} cy={16.5} r={1.4} fill={color} />
    </Svg>
  );
}

export function CaptureIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 8a2 2 0 012-2h1.5l1.2-2h8.6l1.2 2H19a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
        stroke={color}
        strokeWidth={2}
      />
      <Circle cx={12} cy={13} r={3.6} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

export function DashboardIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Path
        d="M3 19V9M9 19V3M15 19v-7M21 19v-11"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        transform="translate(-1 0)"
      />
    </Svg>
  );
}

export function ProfileIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Circle cx={11} cy={7.2} r={3.7} stroke={color} strokeWidth={2} />
      <Path
        d="M3.5 19.5c1.2-3.6 4.1-5.4 7.5-5.4s6.3 1.8 7.5 5.4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Eye toggles for the password fields. */
export function EyeIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"
        stroke={color}
        strokeWidth={1.8}
      />
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

export function EyeOffIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 3l18 18M10.6 10.7a3 3 0 004.2 4.2M9.9 5.2A9.6 9.6 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4.1M6.2 6.7A17 17 0 002 12s3.6 7 10 7a9.7 9.7 0 003.3-.6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}
