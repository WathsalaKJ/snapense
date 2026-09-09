/**
 * Split-panel shell for the desktop-web auth screens (Onboarding, Login,
 * Register): a branded left panel, the given form/content centered on the
 * right. Shared so the three screens read as one flow rather than three
 * independently-styled pages.
 *
 * The left panel's gradient wash uses `colors.loginGradient` - a token
 * that's been sitting in theme/colors.ts unused (declared per-theme, never
 * wired to a screen). Rendered via react-native-svg's LinearGradient
 * (already a dependency, and cross-platform) rather than adding
 * expo-linear-gradient just for this.
 */

import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '../../context/ThemeContext';
import { BudgetsIcon, CaptureIcon, DashboardIcon, type IconProps } from '../../components/icons';
import { accent, fontSize, fontWeight, tealAlpha } from '../../theme';
import { webFonts, webSpacing } from '../../theme/web';

const FEATURES: { Icon: React.ComponentType<IconProps>; title: string; body: string }[] = [
  {
    Icon: CaptureIcon,
    title: 'Snap any receipt',
    body: 'Point, shoot, done — the camera finds and crops it for you.',
  },
  {
    Icon: DashboardIcon,
    title: 'AI does the typing',
    body: 'Merchant, line items, tax and total, extracted in seconds.',
  },
  {
    Icon: BudgetsIcon,
    title: 'Know where it goes',
    body: 'Budgets, trends and smart alerts keep your spending honest.',
  },
];

export default function AuthDesktopShell({ children }: { children: React.ReactNode }) {
  const { colors, theme } = useTheme();
  const [top, mid, bottom] = colors.loginGradient;

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {/* Brand panel */}
      <View style={{ flexBasis: '42%', minWidth: 440, maxWidth: 620 }}>
        <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
          <Defs>
            <LinearGradient id="auth-panel" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={top} />
              <Stop offset="0.5" stopColor={mid} />
              <Stop offset="1" stopColor={bottom} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#auth-panel)" />
        </Svg>

        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: webSpacing.xxl,
            gap: webSpacing.xxl,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: accent.teal,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#06231F', fontSize: 16, fontWeight: '800', fontFamily: webFonts.display }}>
                S
              </Text>
            </View>
            <Text
              style={{
                color: theme === 'dark' ? '#F9FAFB' : colors.text,
                fontSize: 19,
                fontWeight: '600',
                fontFamily: webFonts.display,
              }}
            >
              Snapense
            </Text>
          </View>

          <Text
            style={{
              color: theme === 'dark' ? '#F9FAFB' : colors.text,
              fontSize: 38,
              fontWeight: '600',
              fontFamily: webFonts.display,
              lineHeight: 46,
              maxWidth: 420,
            }}
          >
            Know exactly where your money goes.
          </Text>

          <View style={{ gap: webSpacing.lg }}>
            {FEATURES.map(({ Icon, title, body }) => (
              <View key={title} style={{ flexDirection: 'row', gap: 14, maxWidth: 420 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    backgroundColor: tealAlpha(0.16),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon color={accent.teal} size={17} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: theme === 'dark' ? '#F9FAFB' : colors.text,
                      fontSize: fontSize.baseLg,
                      fontWeight: fontWeight.bold,
                      fontFamily: webFonts.body,
                    }}
                  >
                    {title}
                  </Text>
                  <Text
                    style={{
                      color: theme === 'dark' ? 'rgba(249,250,251,0.65)' : colors.muted,
                      fontSize: fontSize.small,
                      lineHeight: 18,
                      marginTop: 2,
                      fontFamily: webFonts.body,
                    }}
                  >
                    {body}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Form / content panel */}
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: '100%', maxWidth: 400, paddingHorizontal: webSpacing.xl }}>{children}</View>
      </View>
    </View>
  );
}
