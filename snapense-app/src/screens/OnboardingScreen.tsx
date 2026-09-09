import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useTheme } from '../context/ThemeContext';
import { useIsDesktopWeb } from '../hooks/useResponsive';
import { PrimaryButton } from '../components';
import AuthDesktopShell from './web/AuthDesktopShell';
import { webFonts } from '../theme/web';
import { accent, fontSize, fontWeight, spacing, tealAlpha } from '../theme';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

/** Onboarding slide copy. */
const SLIDES = [
  {
    title: 'Snap any receipt',
    body: 'Point, shoot, done. The camera finds and crops the receipt for you.',
  },
  {
    title: 'AI does the typing',
    body: 'Merchant, line items, tax and total — extracted and categorized in seconds.',
  },
  {
    title: 'Know where it goes',
    body: 'Budgets, trends and smart alerts keep your spending honest.',
  },
];

export default function OnboardingScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  const advance = () => {
    if (isLast) navigation.replace('Login');
    else setIndex((current) => current + 1);
  };

  // A swipeable slide deck is a mobile-app pattern; the desktop shell's
  // brand panel already shows all three selling points at once (see
  // AuthDesktopShell), so this becomes a straightforward welcome screen.
  if (isDesktopWeb) {
    return (
      <AuthDesktopShell>
        <View style={{ gap: spacing.xl }}>
          <Text
            style={{
              color: colors.text,
              fontSize: 30,
              fontWeight: '600',
              fontFamily: webFonts.display,
            }}
          >
            Welcome to Snapense
          </Text>
          <Text style={{ color: colors.muted, fontSize: fontSize.body, lineHeight: 21, fontFamily: webFonts.body }}>
            Scan receipts, track spending by category, and set monthly budgets — all in one
            place.
          </Text>
          <PrimaryButton label="Get started" onPress={() => navigation.replace('Login')} />
          <Pressable
            onPress={() => navigation.replace('Login')}
            style={{ alignItems: 'center', paddingVertical: spacing.md }}
            accessibilityRole="button"
          >
            <Text style={{ color: colors.muted, fontSize: fontSize.body, fontFamily: webFonts.body }}>
              Already have an account?{' '}
              <Text style={{ color: accent.teal, fontWeight: fontWeight.semibold }}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </AuthDesktopShell>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 24 }}>
        <Pressable onPress={() => navigation.replace('Login')} hitSlop={10}>
          <Text
            style={{
              color: colors.muted,
              fontSize: fontSize.bodyLg,
              fontWeight: fontWeight.semibold,
            }}
          >
            Skip
          </Text>
        </Pressable>
      </View>

      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 36,
          gap: 28,
        }}
      >
        <View
          style={{
            width: 110,
            height: 110,
            borderRadius: 32,
            backgroundColor: tealAlpha(0.12),
            borderWidth: 1,
            borderColor: tealAlpha(0.3),
          }}
        />

        <View style={{ gap: spacing.lg, alignItems: 'center' }}>
          <Text
            style={{
              color: colors.text,
              fontSize: fontSize.display,
              fontWeight: fontWeight.bold,
              textAlign: 'center',
            }}
          >
            {slide.title}
          </Text>
          <Text
            style={{
              color: colors.muted,
              fontSize: fontSize.base,
              lineHeight: 21,
              textAlign: 'center',
            }}
          >
            {slide.body}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {SLIDES.map((item, dotIndex) => (
            <View
              key={item.title}
              style={{
                width: dotIndex === index ? 20 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: dotIndex === index ? accent.teal : colors.faint,
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ padding: 24, gap: spacing.lg }}>
        <PrimaryButton label={isLast ? 'Get started' : 'Next'} onPress={advance} />
      </View>
    </SafeAreaView>
  );
}
