/**
 * Desktop-web profile/settings layout. The sidebar already shows the
 * signed-in user's avatar, name, email and a sign-out control, so this
 * isn't a re-run of the mobile "identity card" screen - it's a proper
 * settings page: a compact account strip, a refined appearance picker, and
 * a danger-zone sign-out, all in a single centered column (this is a
 * sequential settings page, not a parallel-data dashboard, so it doesn't
 * want the multi-column grid treatment the other desktop screens use).
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { API_BASE_URL } from '../../api/config';
import type { ThemeName } from '../../theme/colors';
import { accent, fontSize, fontWeight, tealAlpha } from '../../theme';
import { webFonts, webRadii, webShadow, webSpacing } from '../../theme/web';

function SettingsCard({
  title,
  description,
  children,
  colors,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  colors: { card: string; line: string; text: string; muted: string };
}) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: webRadii.card,
        padding: webSpacing.lg,
        gap: webSpacing.md,
        ...({ boxShadow: webShadow.card } as object),
      }}
    >
      <View>
        <Text
          style={{
            color: colors.text,
            fontSize: fontSize.baseLg,
            fontWeight: fontWeight.bold,
            fontFamily: webFonts.body,
          }}
        >
          {title}
        </Text>
        {description ? (
          <Text style={{ color: colors.muted, fontSize: fontSize.small, marginTop: 2, fontFamily: webFonts.body }}>
            {description}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export default function ProfileDesktop({
  colors,
  userName,
  userEmail,
  theme,
  isSystem,
  onSetTheme,
  onUseSystemTheme,
  onSignOut,
}: {
  colors: {
    card: string;
    line: string;
    line2: string;
    text: string;
    text2: string;
    muted: string;
    muted2: string;
    soft: string;
  };
  userName?: string | null;
  userEmail?: string | null;
  theme: ThemeName;
  isSystem: boolean;
  onSetTheme: (theme: ThemeName) => void;
  onUseSystemTheme: () => void;
  onSignOut: () => void;
}) {
  const initial = (userName ?? '?').charAt(0).toUpperCase();

  const options: { key: string; label: string; active: boolean; onPress: () => void }[] = [
    { key: 'dark', label: 'Dark', active: !isSystem && theme === 'dark', onPress: () => onSetTheme('dark') },
    { key: 'light', label: 'Light', active: !isSystem && theme === 'light', onPress: () => onSetTheme('light') },
    { key: 'system', label: 'System', active: isSystem, onPress: onUseSystemTheme },
  ];

  return (
    <View style={{ maxWidth: 640, width: '100%', alignSelf: 'center', gap: webSpacing.xl, paddingBottom: webSpacing.xxl }}>
      <View>
        <Text
          style={{
            color: colors.text,
            fontSize: 34,
            fontWeight: '600',
            fontFamily: webFonts.display,
            letterSpacing: 0.2,
          }}
        >
          Profile
        </Text>
        <Text style={{ color: colors.muted, fontSize: fontSize.body, marginTop: 4, fontFamily: webFonts.body }}>
          Account and preferences
        </Text>
      </View>

      {/* Compact identity strip - full detail already lives in the sidebar. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: webSpacing.md,
          backgroundColor: tealAlpha(0.08),
          borderWidth: 1,
          borderColor: tealAlpha(0.22),
          borderRadius: webRadii.card,
          padding: webSpacing.md,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            backgroundColor: tealAlpha(0.16),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: accent.teal, fontSize: fontSize.xl, fontWeight: '800' }}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: fontSize.baseLg, fontWeight: fontWeight.bold, fontFamily: webFonts.body }}>
            {userName ?? 'Signed out'}
          </Text>
          <Text style={{ color: colors.muted, fontSize: fontSize.small, fontFamily: webFonts.body }}>
            {userEmail ?? ''}
          </Text>
        </View>
      </View>

      <SettingsCard title="Appearance" description="Choose how Snapense looks on this device." colors={colors}>
        <View style={{ flexDirection: 'row', gap: webSpacing.sm }}>
          {options.map((option) => (
            <Pressable key={option.key} onPress={option.onPress} style={{ flex: 1 }}>
              {({ hovered }: any) => (
                <View
                  style={{
                    alignItems: 'center',
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: option.active ? accent.teal : hovered ? colors.soft : 'transparent',
                    borderWidth: 1,
                    borderColor: option.active ? accent.teal : colors.line2,
                  }}
                >
                  <Text
                    style={{
                      color: option.active ? '#06231F' : colors.text2,
                      fontSize: fontSize.small,
                      fontWeight: fontWeight.semibold,
                      fontFamily: webFonts.body,
                    }}
                  >
                    {option.label}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </SettingsCard>

      <SettingsCard title="Developer" colors={colors}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.muted, fontSize: fontSize.small, fontFamily: webFonts.body }}>API endpoint</Text>
          <Text style={{ color: colors.text2, fontSize: fontSize.small, fontFamily: webFonts.body }}>{API_BASE_URL}</Text>
        </View>
      </SettingsCard>

      <View
        style={{
          borderWidth: 1,
          borderColor: `${accent.danger}40`,
          borderRadius: webRadii.card,
          padding: webSpacing.lg,
          gap: webSpacing.md,
        }}
      >
        <View>
          <Text style={{ color: colors.text, fontSize: fontSize.baseLg, fontWeight: fontWeight.bold, fontFamily: webFonts.body }}>
            Sign out
          </Text>
          <Text style={{ color: colors.muted, fontSize: fontSize.small, marginTop: 2, fontFamily: webFonts.body }}>
            You'll need to sign in again to access your data.
          </Text>
        </View>
        <Pressable onPress={onSignOut} style={{ alignSelf: 'flex-start' }}>
          {({ hovered }: any) => (
            <View
              style={{
                paddingHorizontal: webSpacing.lg,
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: hovered ? accent.danger : `${accent.danger}1A`,
                borderWidth: 1,
                borderColor: `${accent.danger}66`,
              }}
            >
              <Text
                style={{
                  color: hovered ? '#2A0A0F' : accent.danger,
                  fontSize: fontSize.small,
                  fontWeight: fontWeight.bold,
                  fontFamily: webFonts.body,
                }}
              >
                Sign out of Snapense
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}
