import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useIsDesktopWeb } from '../hooks/useResponsive';
import { Card, PrimaryButton, WebContainer } from '../components';
import ProfileDesktop from './web/ProfileDesktop';
import { webSpacing } from '../theme/web';
import {
  accent,
  fontSize,
  fontWeight,
  screenPadding,
  spacing,
  tealAlpha,
} from '../theme';

type ThemeIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export default function ProfileScreen() {
  const { colors, theme, isSystem, setTheme, useSystemTheme } = useTheme();
  const { user, logout } = useAuth();
  const isDesktopWeb = useIsDesktopWeb();

  const options: { label: string; icon: ThemeIconName; active: boolean; onPress: () => void }[] = [
    {
      label: 'Dark',
      icon: 'weather-night',
      active: !isSystem && theme === 'dark',
      onPress: () => setTheme('dark'),
    },
    {
      label: 'Light',
      icon: 'weather-sunny',
      active: !isSystem && theme === 'light',
      onPress: () => setTheme('light'),
    },
    {
      label: 'System',
      // A half-sun-half-moon glyph - reads as "follows the device" without
      // needing a fourth, separate icon concept.
      icon: 'theme-light-dark',
      active: isSystem,
      onPress: useSystemTheme,
    },
  ];

  if (isDesktopWeb) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: webSpacing.xl }}>
          <ProfileDesktop
            colors={colors}
            userName={user?.full_name}
            userEmail={user?.email}
            theme={theme}
            isSystem={isSystem}
            onSetTheme={setTheme}
            onUseSystemTheme={useSystemTheme}
            onSignOut={logout}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <WebContainer>
      <ScrollView contentContainerStyle={{ padding: screenPadding, gap: spacing.xl }}>
        <View>
          {/* 26/800 matches the page-title treatment on every other main
              screen (Dashboard, Budgets, Goals, Transactions) - this was
              the one screen still using the smaller detail-screen size. */}
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>Profile</Text>
          <Text style={{ color: colors.muted, fontSize: fontSize.body, marginTop: 3 }}>
            Account and appearance
          </Text>
        </View>

        <Card style={{ gap: spacing.lg, alignItems: 'center' }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 24,
              backgroundColor: tealAlpha(0.12),
              borderWidth: 1,
              borderColor: tealAlpha(0.3),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: accent.teal,
                fontSize: fontSize.display,
                fontWeight: fontWeight.bold,
              }}
            >
              {user?.full_name?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>

          <Text
            style={{
              color: colors.text,
              fontSize: fontSize.xl,
              fontWeight: fontWeight.semibold,
            }}
          >
            {user?.full_name ?? 'Signed out'}
          </Text>
          <Text style={{ color: colors.muted, fontSize: fontSize.body }}>
            {user?.email ?? ''}
          </Text>
        </Card>

        <Card style={{ gap: spacing.lg }}>
          <Text
            style={{
              color: colors.text,
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
            }}
          >
            Appearance
          </Text>

          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            {options.map((option) => (
              <Pressable
                key={option.label}
                onPress={option.onPress}
                accessibilityRole="button"
                accessibilityLabel={`${option.label} theme`}
                accessibilityState={{ selected: option.active }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  gap: 5,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: option.active ? accent.teal : colors.soft,
                  borderWidth: 1,
                  borderColor: option.active ? accent.teal : colors.line,
                }}
              >
                <MaterialCommunityIcons
                  name={option.icon}
                  size={20}
                  color={option.active ? '#06231F' : colors.text2}
                />
                <Text
                  style={{
                    color: option.active ? '#06231F' : colors.text2,
                    fontSize: fontSize.small,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <PrimaryButton
          label="Sign out"
          onPress={logout}
          style={{ backgroundColor: accent.danger }}
        />
      </ScrollView>
      </WebContainer>
    </SafeAreaView>
  );
}
