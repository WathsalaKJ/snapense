/**
 * Donut and trend charts, built on react-native-svg.
 *
 * Geometry: the donut is an r=64 circle in a 200x200 viewBox rotated -90deg,
 * drawn with stroke-dasharray segments; the trend is a 340x120 polyline with a
 * translucent area fill under it.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polyline } from 'react-native-svg';

import { useTheme } from '../context/ThemeContext';
import { accent, fontSize, fontWeight, resolveCategoryColor } from '../theme';

const DONUT_SIZE = 158;
const RADIUS = 64;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface DonutSlice {
  id: number;
  name: string;
  total: number;
  colorHex?: string | null;
}

export function DonutChart({
  slices,
  selectedId,
  onSelect,
  centerLabel,
  centerSub,
  size = DONUT_SIZE,
}: {
  slices: DonutSlice[];
  selectedId?: number | null;
  onSelect?: (slice: DonutSlice) => void;
  centerLabel: string;
  centerSub: string;
  /** Rendered pixel size; the internal 200x200 viewBox geometry is unchanged. Defaults to the original mobile size. */
  size?: number;
}) {
  const { colors } = useTheme();
  const total = slices.reduce((sum, slice) => sum + slice.total, 0);
  const labelScale = size / DONUT_SIZE;

  // Walk the circumference, converting each share into a dash segment.
  let cursor = 0;
  const segments = slices.map((slice) => {
    const fraction = total > 0 ? slice.total / total : 0;
    const length = fraction * CIRCUMFERENCE;
    const segment = {
      ...slice,
      dash: `${length} ${CIRCUMFERENCE - length}`,
      offset: -cursor,
      dimmed: selectedId != null && selectedId !== slice.id,
    };
    cursor += length;
    return segment;
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        {/*
          A `transform` string (rather than the `rotation`/`originX`/`originY`
          props) composes identically on native but, unlike those props,
          doesn't make react-native-svg's web renderer write an invalid
          `transform-origin` DOM attribute (React DOM only recognizes the
          camelCase style property, not that attribute name).
        */}
        <G transform="rotate(-90 100 100)">
          {total === 0 ? (
            <Circle
              cx={100}
              cy={100}
              r={RADIUS}
              fill="none"
              stroke={colors.soft}
              strokeWidth={26}
            />
          ) : (
            segments.map((segment) => (
              <Circle
                key={segment.id}
                cx={100}
                cy={100}
                r={RADIUS}
                fill="none"
                stroke={resolveCategoryColor(segment.name, segment.colorHex)}
                strokeWidth={segment.id === selectedId ? 32 : 26}
                strokeDasharray={segment.dash}
                strokeDashoffset={segment.offset}
                opacity={segment.dimmed ? 0.35 : 1}
                onPress={() => onSelect?.(segment)}
              />
            ))
          )}
        </G>
      </Svg>

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <Text style={{ color: colors.text, fontSize: Math.round(19 * labelScale), fontWeight: '800' }}>
          {centerLabel}
        </Text>
        <Text style={{ color: colors.muted, fontSize: Math.round(10 * labelScale) }}>{centerSub}</Text>
      </View>
    </View>
  );
}

export function DonutLegend({
  slices,
  selectedId,
  onSelect,
  formatValue,
}: {
  slices: DonutSlice[];
  selectedId?: number | null;
  onSelect?: (slice: DonutSlice) => void;
  formatValue: (value: number) => string;
}) {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, gap: 2 }}>
      {slices.map((slice) => {
        const active = slice.id === selectedId;
        return (
          <Pressable
            key={slice.id}
            onPress={() => onSelect?.(slice)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 4,
              paddingHorizontal: 6,
              borderRadius: 8,
              backgroundColor: active ? colors.soft : 'transparent',
            }}
          >
            <View
              style={{
                width: 9,
                height: 9,
                borderRadius: 3,
                backgroundColor: resolveCategoryColor(slice.name, slice.colorHex),
              }}
            />
            <Text
              numberOfLines={1}
              style={{ flex: 1, color: colors.text2, fontSize: fontSize.small }}
            >
              {slice.name}
            </Text>
            <Text
              style={{
                color: colors.text,
                fontSize: fontSize.small,
                fontWeight: fontWeight.bold,
              }}
            >
              {formatValue(slice.total)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface TrendPointData {
  month: string;
  total: number;
}

const CHART_WIDTH = 340;
const CHART_HEIGHT = 120;
const PAD_X = 10;
const TOP_Y = 20;
const BASE_Y = 110;

export function TrendChart({
  points,
  height,
  pointColor,
  referenceValue,
}: {
  points: TrendPointData[];
  /** Rendered SVG height; geometry scales proportionally. Omit for the original mobile height. */
  height?: number;
  /**
   * Per-point marker color (e.g. flagging over-budget months on
   * BudgetHistoryScreen). Omit for the original single-teal endpoint dot -
   * Dashboard's trend card never passes this, so its rendering is unchanged.
   */
  pointColor?: (point: TrendPointData, index: number) => string;
  /** Draws a dashed horizontal threshold line (e.g. a budget's monthly_limit) at this value. */
  referenceValue?: number;
}) {
  const { colors } = useTheme();

  if (points.length === 0) {
    return (
      <Text style={{ color: colors.muted, fontSize: fontSize.body, paddingVertical: 20 }}>
        No spending recorded yet.
      </Text>
    );
  }

  // scale === 1 (and every value below reduces to its original constant) when
  // `height` is omitted, so native/mobile-web rendering is pixel-identical.
  const chartHeight = height ?? CHART_HEIGHT;
  const scale = chartHeight / CHART_HEIGHT;
  const topY = TOP_Y * scale;
  const baseY = BASE_Y * scale;

  const max = Math.max(
    1,
    referenceValue ?? 0,
    ...points.map((point) => point.total),
  );
  const step =
    points.length > 1 ? (CHART_WIDTH - PAD_X * 2) / (points.length - 1) : 0;
  const valueToY = (value: number) => baseY - (value / max) * (baseY - topY);

  const coords = points.map((point, index) => {
    const x = PAD_X + index * step;
    const y = valueToY(point.total);
    return { x, y, ...point };
  });

  const line = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const area = `${line} ${coords[coords.length - 1].x},${baseY} ${coords[0].x},${baseY}`;
  const last = coords[coords.length - 1];
  const referenceY = referenceValue != null ? valueToY(referenceValue) : null;

  return (
    <View>
      <Svg
        width="100%"
        height={chartHeight}
        viewBox={`0 0 ${CHART_WIDTH} ${chartHeight}`}
        preserveAspectRatio="none"
      >
        <Line x1={10} y1={30 * scale} x2={330} y2={30 * scale} stroke="rgba(148,163,184,0.28)" strokeWidth={1} />
        <Line x1={10} y1={70 * scale} x2={330} y2={70 * scale} stroke="rgba(148,163,184,0.28)" strokeWidth={1} />
        <Line x1={10} y1={110 * scale} x2={330} y2={110 * scale} stroke="rgba(148,163,184,0.38)" strokeWidth={1} />

        <Polyline points={area} fill="rgba(45,212,191,0.10)" stroke="none" />
        <Polyline
          points={line}
          fill="none"
          stroke={accent.teal}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {referenceY != null ? (
          <Line
            x1={10}
            y1={referenceY}
            x2={330}
            y2={referenceY}
            stroke="rgba(148,163,184,0.65)"
            strokeWidth={1.3}
            strokeDasharray="4 4"
          />
        ) : null}

        {pointColor ? (
          coords.map((c, index) => (
            <Circle key={c.month} cx={c.x} cy={c.y} r={5 * scale} fill={pointColor(points[index], index)} />
          ))
        ) : (
          <>
            <Circle cx={last.x} cy={last.y} r={8.5 * scale} fill="rgba(45,212,191,0.25)" />
            <Circle cx={last.x} cy={last.y} r={4.5 * scale} fill={accent.teal} />
          </>
        )}
      </Svg>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 6,
          paddingHorizontal: 2,
        }}
      >
        {points.map((point, index) => {
          const isLast = index === points.length - 1;
          return (
            <Text
              key={point.month}
              style={{
                color: isLast ? accent.teal : colors.muted2,
                fontSize: 10.5,
                fontWeight: isLast ? '700' : '400',
              }}
            >
              {monthLabel(point.month)}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** "2026-08" -> "Aug" */
function monthLabel(value: string): string {
  const month = Number(value.slice(5, 7));
  return MONTHS[month - 1] ?? value;
}
