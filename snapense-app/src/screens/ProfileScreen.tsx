import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL } from '../api/config';
import { Card, PrimaryButton } from '../components';
import {
  accent,
  fontSize,
  fontWeight,
  screenPadding,
  spacing,
  tealAlpha,
} from '../theme';

export default function ProfileScreen() {
  const { colors, theme, isSystem, setTheme, useSystemTheme } = useTheme();
  const { user, logout } = useAuth();

  const options: { label: string; active: boolean; onPress: () => void }[] = [
    { label: 'Dark', active: !isSystem && theme === 'dark', onPress: () => setTheme('dark') },
    { label: 'Light', active: !isSystem && theme === 'light', onPress: () => setTheme('light') },
    { label: 'System', active: isSystem, onPress: useSystemTheme },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: screenPadding, gap: spacing.xl }}>
        <Text
          style={{
            color: colors.text,
            fontSize: fontSize.title,
            fontWeight: fontWeight.bold,
          }}
        >
          Profile
        </Text>

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
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 11,
                  borderRadius: 12,
                  backgroundColor: option.active ? accent.teal : colors.soft,
                  borderWidth: 1,
                  borderColor: option.active ? accent.teal : colors.line,
                }}
              >
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

        <Card style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.muted, fontSize: fontSize.small }}>API endpoint</Text>
          <Text style={{ color: colors.text2, fontSize: fontSize.small }}>
            {API_BASE_URL}
          </Text>
        </Card>

        <PrimaryButton
          label="Sign out"
          onPress={logout}
          style={{ backgroundColor: accent.danger }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
