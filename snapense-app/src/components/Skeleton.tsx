/**
 * Loading skeletons - shaped placeholders standing in for each screen's real
 * layout, instead of a bare centered spinner blocking the whole view while
 * data loads. The pulse technique (opacity looping between two values) is
 * the same one already established for "this is working, not stuck" moments
 * elsewhere in the app (ScanningScreen's PulsingDots, InsightCard's
 * ThinkingDots) - Reanimated here instead of the Animated API only because
 * these blocks re-render less predictably (list length varies), and
 * Reanimated's worklets keep the loop on the UI thread regardless.
 */

import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../context/ThemeContext';
import { radii, spacing } from '../theme';

export function SkeletonBlock({
  width,
  height,
  radius = 8,
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: object;
}) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.soft },
        animatedStyle,
        style,
      ]}
    />
  );
}

function SkeletonCard({ children, style }: { children: React.ReactNode; style?: object }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 18,
          padding: 20,
          gap: spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function SkeletonRow() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 20, paddingVertical: 13 }}>
      <SkeletonBlock width={38} height={38} radius={12} />
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonBlock width="55%" height={13} radius={4} />
        <SkeletonBlock width="35%" height={11} radius={4} />
      </View>
      <SkeletonBlock width={58} height={16} radius={4} />
    </View>
  );
}

export function DashboardSkeleton() {
  return (
    <View style={{ padding: 20, gap: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SkeletonBlock width={170} height={18} radius={4} />
        <SkeletonBlock width={38} height={38} radius={19} />
      </View>
      <View style={{ gap: 6 }}>
        <SkeletonBlock width={140} height={24} radius={5} />
        <SkeletonBlock width={190} height={14} radius={4} />
      </View>

      <SkeletonCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
          <SkeletonBlock width={34} height={34} radius={10} />
          <SkeletonBlock width={140} height={14} radius={4} />
        </View>
      </SkeletonCard>

      <SkeletonCard>
        <SkeletonBlock width={160} height={11} radius={4} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 6 }}>
          <SkeletonBlock width={130} height={130} radius={65} />
          <View style={{ flex: 1, gap: 10 }}>
            <SkeletonBlock width="80%" height={12} radius={4} />
            <SkeletonBlock width="65%" height={12} radius={4} />
            <SkeletonBlock width="70%" height={12} radius={4} />
          </View>
        </View>
      </SkeletonCard>

      <SkeletonCard>
        <SkeletonBlock width={130} height={11} radius={4} />
        <SkeletonBlock width="100%" height={110} radius={10} />
      </SkeletonCard>
    </View>
  );
}

export function TransactionsSkeleton() {
  return (
    <View>
      <View style={{ paddingHorizontal: 20, paddingTop: spacing.md, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ gap: 6 }}>
            <SkeletonBlock width={150} height={22} radius={5} />
            <SkeletonBlock width={90} height={12} radius={4} />
          </View>
          <SkeletonBlock width={38} height={38} radius={19} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[64, 72, 58, 80].map((w, i) => (
            <SkeletonBlock key={i} width={w} height={28} radius={radii.chip} />
          ))}
        </View>
      </View>
      <View style={{ marginTop: 18 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </View>
    </View>
  );
}

export function BudgetsSkeleton() {
  return (
    <View style={{ padding: 20, gap: 18 }}>
      <View style={{ gap: 6 }}>
        <SkeletonBlock width={130} height={22} radius={5} />
        <SkeletonBlock width={190} height={12} radius={4} />
      </View>
      <View style={{ gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{ gap: 10, borderRadius: 16, padding: 16, backgroundColor: 'transparent' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <SkeletonBlock width={38} height={38} radius={12} />
              <View style={{ flex: 1, gap: 6 }}>
                <SkeletonBlock width="45%" height={13} radius={4} />
                <SkeletonBlock width="30%" height={11} radius={4} />
              </View>
              <SkeletonBlock width={30} height={12} radius={4} />
            </View>
            <SkeletonBlock width="100%" height={8} radius={4} />
          </View>
        ))}
      </View>
    </View>
  );
}

