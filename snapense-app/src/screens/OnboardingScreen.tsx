import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useTheme } from '../context/ThemeContext';
import { PrimaryButton } from '../components';
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
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  const advance = () => {
    if (isLast) navigation.replace('Login');
    else setIndex((current) => current + 1);
  };

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
