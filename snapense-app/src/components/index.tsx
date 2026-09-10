/** Shared primitives styled from the design tokens. */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import {
  accent,
  dangerAlpha,
  fontSize,
  fontWeight,
  radii,
  resolveCategoryColor,
  spacing,
  tealAlpha,
} from '../theme';

/**
 * Caps and centers screen content on wide web viewports; a no-op on native
 * and on narrow (mobile) web, where it renders as a plain flex:1 View.
 */
export function WebContainer({
  children,
  style,
  maxWidth = 560,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  maxWidth?: number;
}) {
  const { isWideWeb } = useResponsive();
  return (
    <View
      style={[
        { flex: 1, width: '100%' },
        isWideWeb ? { maxWidth, alignSelf: 'center' } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: colors.bg }, style]}>{children}</View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radii.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.line,
          padding: spacing.xxl,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Heading({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        color: colors.text,
        fontSize: fontSize.title,
        fontWeight: fontWeight.bold,
      }}
    >
      {children}
    </Text>
  );
}

export function Muted({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text style={{ color: colors.muted, fontSize: fontSize.body }}>{children}</Text>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor: pressed ? accent.tealBright : accent.teal,
          opacity: isDisabled ? 0.5 : 1,
          borderRadius: radii.chip,
          paddingVertical: 15,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#06231F" />
      ) : (
        <Text
          style={{
            color: '#06231F',
            fontSize: fontSize.baseLg,
            fontWeight: fontWeight.semibold,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  style,
  ...props
}: TextInputProps & { label: string; style?: ViewStyle }) {
  const { colors } = useTheme();
  const [focused, setFocused] = React.useState(false);

  return (
    <View style={style}>
      <Text
        style={{
          color: colors.muted,
          fontSize: fontSize.small,
          fontWeight: fontWeight.medium,
          marginBottom: spacing.sm,
        }}
      >
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.faint}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          backgroundColor: colors.soft,
          borderRadius: radii.input,
          borderWidth: 1,
          borderColor: focused ? accent.teal : colors.line,
          color: colors.text,
          fontSize: fontSize.base,
          paddingHorizontal: spacing.xl,
          paddingVertical: 13,
        }}
        {...props}
      />
    </View>
  );
}

export function CategoryDot({
  name,
  colorHex,
  size = 8,
}: {
  name?: string | null;
  colorHex?: string | null;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: resolveCategoryColor(name, colorHex),
      }}
    />
  );
}

export function CategoryChip({
  name,
  colorHex,
}: {
  name: string;
  colorHex?: string | null;
}) {
  const color = resolveCategoryColor(name, colorHex);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radii.chip,
        backgroundColor: `${color}22`,
      }}
    >
      <View
        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }}
      />
      <Text style={{ color, fontSize: fontSize.caption, fontWeight: fontWeight.semibold }}>
        {name}
      </Text>
    </View>
  );
}

/**
 * Backend `icon_name` values (see snapense-backend/models.py DEFAULT_CATEGORIES)
 * are arbitrary strings, not @expo/vector-icons glyph names, so they're mapped
 * by hand to MaterialCommunityIcons - chosen because its "-outline" variants
 * match the app's thin-stroke icon style (ChevronIcon, EditIcon, etc.) and it
 * has full coverage of the seeded categories.
 */
const CATEGORY_ICON_MAP: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  'shopping-cart': 'cart-outline',
  utensils: 'silverware-fork-knife',
  car: 'car-outline',
  film: 'movie-outline',
  bag: 'shopping-outline',
  zap: 'lightning-bolt-outline',
  heart: 'heart-outline',
  'more-horizontal': 'dots-horizontal',
};

/**
 * Category avatar: a real icon for known `icon_name` values, falling back to
 * the tinted-initial circle (this app's original avatar style) for anything
 * unmapped, so a new/custom category never renders blank.
 */
export function CategoryIcon({
  name,
  iconName,
  colorHex,
  size = 38,
}: {
  name?: string | null;
  iconName?: string | null;
  colorHex?: string | null;
  size?: number;
}) {
  const tone = resolveCategoryColor(name, colorHex);
  const glyph = iconName ? CATEGORY_ICON_MAP[iconName] : undefined;
  const radius = Math.round(size * 0.29);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: `${tone}24`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {glyph ? (
        <MaterialCommunityIcons name={glyph} size={Math.round(size * 0.5)} color={tone} />
      ) : (
        <Text style={{ color: tone, fontSize: Math.round(size * 0.4), fontWeight: '800' }}>
          {(name ?? '?').trim().charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

/** Track + fill bar, e.g. for budget progress. `ratio` is clamped for the fill width. */
export function ProgressBar({
  ratio,
  color,
  style,
}: {
  ratio: number;
  color: string;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <View
      style={[
        { height: 8, borderRadius: 4, backgroundColor: colors.soft, overflow: 'hidden' },
        style,
      ]}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: 4,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function AnomalyBadge({ reason }: { reason?: string | null }) {
  if (!reason) return null;
  return (
    <View
      style={{
        backgroundColor: dangerAlpha(0.16),
        borderRadius: radii.tile,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
      }}
    >
      <Text style={{ color: accent.danger, fontSize: fontSize.small }}>{reason}</Text>
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}>
      <ActivityIndicator color={accent.teal} />
      {label ? <Muted>{label}</Muted> : null}
    </View>
  );
}

export function EmptyState({
  title,
  body,
  icon,
  action,
}: {
  title: string;
  body?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, gap: spacing.md }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 20,
          backgroundColor: tealAlpha(0.12),
          borderWidth: 1,
          borderColor: tealAlpha(0.3),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>
      <Text
        style={{
          color: colors.text,
          fontSize: fontSize.base,
          fontWeight: fontWeight.semibold,
        }}
      >
        {title}
      </Text>
      {body ? (
        <Text
          style={{
            color: colors.muted,
            fontSize: fontSize.body,
            textAlign: 'center',
            paddingHorizontal: 40,
          }}
        >
          {body}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

export function ErrorNote({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View
      style={{
        backgroundColor: dangerAlpha(0.16),
        borderRadius: radii.tile,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
      }}
    >
      <Text style={{ color: accent.danger, fontSize: fontSize.small }}>{message}</Text>
    </View>
  );
}

/**
 * "Rs. 1,250.00" - Sri Lankan Rupees. Thousands grouping is done with a regex
 * rather than toLocaleString, since Hermes's ICU/Intl support isn't guaranteed
 * across every Expo build target.
 */
export function formatCurrency(amount: number | null | undefined): string {
  const value = typeof amount === 'number' ? amount : 0;
  const sign = value < 0 ? '-' : '';
  const [whole, decimals] = Math.abs(value).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}Rs. ${grouped}.${decimals}`;
}
