/**
 * The AI-written spending insight shown on Dashboard, with a way to
 * regenerate it. Chrome-less content, like DonutChart/TrendChart - each
 * Dashboard layout wraps it in its own card chrome and passes `variant` so
 * type scale/spacing come from the right theme (theme/index.ts on mobile,
 * theme/web.ts on desktop).
 */

import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { SpendingInsight } from '../api/types';
import { useTheme } from '../context/ThemeContext';
import { accent, fontSize, fontWeight, spacing, tealAlpha } from '../theme';
import { webFonts, webSpacing } from '../theme/web';

function SparkleIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M10 1.5c0.7 4.6 2.1 6.9 6.5 7.5-4.4 0.6-5.8 2.9-6.5 7.5-0.7-4.6-2.1-6.9-6.5-7.5 4.4-0.6 5.8-2.9 6.5-7.5z"
        fill={color}
      />
      <Path
        d="M16.3 2c0.25 1.4 0.68 1.9 2 2.1-1.32 0.2-1.75 0.7-2 2.1-0.25-1.4-0.68-1.9-2-2.1 1.32-0.2 1.75-0.7 2-2.1z"
        fill={color}
      />
    </Svg>
  );
}

function RefreshIcon({ color, size = 15 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d="M16.2 10a6.2 6.2 0 11-1.9-4.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path
        d="M16.6 3v4.3h-4.3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Same pulsing-dots technique as ScanningScreen's PulsingDots, recreated
 * locally (smaller) since that one is a private component, not exported. */
function ThinkingDots({ color }: { color: string }) {
  const dots = [
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
  ];

  useEffect(() => {
    const animations = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 200),
          Animated.timing(dot, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {dots.map((dot, index) => (
        <Animated.View
          key={index}
          style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: color, opacity: dot }}
        />
      ))}
    </View>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-08-10" -> "Aug 10". Sliced rather than parsed as a Date, matching
 * charts.tsx's monthLabel - avoids Hermes Intl/timezone inconsistencies. */
function formatPeriodDate(value: string): string {
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const label = MONTHS[month - 1];
  return label ? `${label} ${day}` : value;
}

function formatPeriodRange(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  return `${formatPeriodDate(start)} - ${formatPeriodDate(end)}`;
}

export default function InsightCard({
  insight,
  regenerating,
  onRegenerate,
  variant = 'mobile',
}: {
  insight: SpendingInsight | null;
  regenerating: boolean;
  onRegenerate: () => void;
  variant?: 'mobile' | 'desktop';
}) {
  const { colors } = useTheme();
  const isDesktop = variant === 'desktop';

  const hasInsight = !!insight;
  const period = insight ? formatPeriodRange(insight.period_start, insight.period_end) : null;
  const bodyFont = isDesktop ? webFonts.body : undefined;

  return (
    <View style={{ gap: isDesktop ? webSpacing.md : spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: isDesktop ? webSpacing.sm : spacing.lg }}>
          <View
            style={{
              width: isDesktop ? 36 : 34,
              height: isDesktop ? 36 : 34,
              borderRadius: 10,
              backgroundColor: tealAlpha(0.16),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SparkleIcon color={accent.teal} size={isDesktop ? 18 : 16} />
          </View>
          <Text
            style={{
              color: colors.muted,
              fontSize: fontSize.small,
              fontWeight: fontWeight.semibold,
              letterSpacing: 0.7,
              textTransform: 'uppercase',
              fontFamily: bodyFont,
            }}
          >
            AI Insight
          </Text>
        </View>

        {hasInsight || regenerating ? (
          <Pressable
            onPress={onRegenerate}
            disabled={regenerating}
            accessibilityLabel="Regenerate insight"
            style={({ pressed }) => ({
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.softer : colors.soft,
              borderWidth: 1,
              borderColor: colors.line,
              opacity: regenerating ? 0.7 : 1,
            })}
          >
            {regenerating ? (
              <ActivityIndicator size="small" color={accent.teal} />
            ) : (
              <RefreshIcon color={colors.muted} />
            )}
          </Pressable>
        ) : null}
      </View>

      {regenerating ? (
        <View style={{ gap: 8, paddingVertical: isDesktop ? webSpacing.xs : spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text
              style={{
                color: colors.text2,
                fontSize: isDesktop ? fontSize.base : fontSize.body,
                fontWeight: fontWeight.medium,
                fontFamily: bodyFont,
              }}
            >
              Thinking about your spending…
            </Text>
            <ThinkingDots color={accent.teal} />
          </View>
          <Text style={{ color: colors.muted2, fontSize: fontSize.caption, fontFamily: bodyFont }}>
            Gemini is reviewing your recent transactions - this can take a few seconds.
          </Text>
        </View>
      ) : hasInsight ? (
        <View
          style={{
            borderLeftWidth: 3,
            borderLeftColor: tealAlpha(0.5),
            paddingLeft: isDesktop ? webSpacing.md : spacing.xl,
            gap: isDesktop ? webSpacing.xs : spacing.sm,
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontSize: isDesktop ? 19 : fontSize.lg,
              lineHeight: isDesktop ? 29 : 23,
              fontFamily: isDesktop ? webFonts.display : undefined,
              fontStyle: isDesktop ? 'italic' : 'normal',
              fontWeight: isDesktop ? '500' : fontWeight.medium,
            }}
          >
            {insight!.insight_text}
          </Text>
          {period ? (
            <Text style={{ color: colors.muted2, fontSize: fontSize.caption, fontFamily: bodyFont }}>
              {period}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: isDesktop ? webSpacing.sm : spacing.md }}>
          <Text
            style={{
              color: colors.muted,
              fontSize: isDesktop ? fontSize.base : fontSize.body,
              lineHeight: 19,
              fontFamily: bodyFont,
            }}
          >
            Snapense hasn't written you an insight yet. Generate one for a quick,
            plain-English read on your recent spending.
          </Text>
          <Pressable
            onPress={onRegenerate}
            disabled={regenerating}
            style={({ pressed }) => ({
              alignSelf: 'flex-start',
              backgroundColor: pressed ? accent.tealBright : accent.teal,
              borderRadius: 100,
              paddingHorizontal: isDesktop ? webSpacing.md : spacing.xxl,
              paddingVertical: isDesktop ? webSpacing.xs : spacing.md,
            })}
          >
            <Text
              style={{
                color: '#06231F',
                fontSize: fontSize.small,
                fontWeight: fontWeight.semibold,
                fontFamily: bodyFont,
              }}
            >
              Generate insight
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
