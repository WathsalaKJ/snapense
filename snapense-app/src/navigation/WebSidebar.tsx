/**
 * Persistent left nav for desktop web (see useIsDesktopWeb()). Replaces the
 * mobile bottom TabBar entirely at that breakpoint - TabBar itself renders
 * null there (see TabBar.tsx) so there's never a duplicate nav on screen.
 *
 * Lives outside the tab/stack navigators (wired in by RootNavigator, which
 * tracks the active route via NavigationContainer's onStateChange and
 * passes it down as a prop) rather than inside createBottomTabNavigator's
 * `tabBar` slot, since that slot lays out bottom-docked chrome, not a
 * full-height side rail.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../context/ThemeContext';
import {
  BudgetsIcon,
  CaptureIcon,
  DashboardIcon,
  ProfileIcon,
  TransactionsIcon,
  type IconProps,
} from '../components/icons';
import { accent, fontSize, fontWeight, tealAlpha } from '../theme';
import { sidebarWidth, webFonts, webSpacing } from '../theme/web';

export type SidebarNavKey = 'Dashboard' | 'Transactions' | 'Capture' | 'Budgets' | 'Profile';

/** Routes that should highlight a sidebar item without being one themselves. */
const PARENT_NAV: Record<string, SidebarNavKey | undefined> = {
  TransactionDetail: 'Transactions',
  Scanning: 'Capture',
  ReceiptReview: 'Capture',
};

export function resolveSidebarActive(routeName: string | undefined): SidebarNavKey | null {
  if (!routeName) return null;
  if (routeName in PARENT_NAV) return PARENT_NAV[routeName] ?? null;
  const known: SidebarNavKey[] = ['Dashboard', 'Transactions', 'Capture', 'Budgets', 'Profile'];
  return (known as string[]).includes(routeName) ? (routeName as SidebarNavKey) : null;
}

const NAV_ITEMS: { key: SidebarNavKey; label: string; Icon: React.ComponentType<IconProps> }[] = [
  { key: 'Transactions', label: 'Transactions', Icon: TransactionsIcon },
  { key: 'Capture', label: 'Capture', Icon: CaptureIcon },
  { key: 'Dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { key: 'Budgets', label: 'Budgets', Icon: BudgetsIcon },
  { key: 'Profile', label: 'Profile', Icon: ProfileIcon },
];

function NavRow({
  label,
  Icon,
  active,
  onPress,
}: {
  label: string;
  Icon: React.ComponentType<IconProps>;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ hovered, pressed }: any) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginHorizontal: webSpacing.sm,
        borderRadius: 12,
        backgroundColor: active
          ? tealAlpha(0.14)
          : pressed
            ? colors.softer
            : hovered
              ? colors.soft
              : 'transparent',
      })}
    >
      <View
        style={{
          width: 3,
          height: 16,
          borderRadius: 2,
          backgroundColor: active ? accent.teal : 'transparent',
          marginLeft: -14,
        }}
      />
      <Icon color={active ? accent.teal : colors.muted} size={19} />
      <Text
        style={{
          color: active ? accent.teal : colors.text2,
          fontSize: fontSize.baseLg,
          fontWeight: active ? fontWeight.bold : fontWeight.medium,
          fontFamily: webFonts.body,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function WebSidebar({
  active,
  onNavigate,
  userName,
  userEmail,
  onSignOut,
}: {
  active: SidebarNavKey | null;
  onNavigate: (key: SidebarNavKey) => void;
  userName?: string | null;
  userEmail?: string | null;
  onSignOut: () => void;
}) {
  const { colors } = useTheme();

  const initials = (userName ?? '?')
    .split(' ')
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View
      style={{
        width: sidebarWidth,
        height: '100%',
        backgroundColor: colors.card,
        borderRightWidth: 1,
        borderRightColor: colors.line,
        paddingVertical: webSpacing.lg,
        justifyContent: 'space-between',
      }}
    >
      <View>
        {/* Wordmark */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: webSpacing.lg,
            marginBottom: webSpacing.xl,
          }}
        >
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              backgroundColor: accent.teal,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#06231F', fontSize: 15, fontWeight: '800', fontFamily: webFonts.display }}>
              S
            </Text>
          </View>
          <View>
            <Text
              style={{
                color: colors.text,
                fontSize: 18,
                fontWeight: '600',
                fontFamily: webFonts.display,
                letterSpacing: 0.2,
              }}
            >
              Snapense
            </Text>
            <Text
              style={{
                color: colors.muted2,
                fontSize: fontSize.caption,
                fontFamily: webFonts.body,
                marginTop: -2,
              }}
            >
              Personal finance
            </Text>
          </View>
        </View>

        {/* Nav */}
        <View style={{ gap: 2 }}>
          {NAV_ITEMS.map((item) => (
            <NavRow
              key={item.key}
              label={item.label}
              Icon={item.Icon}
              active={active === item.key}
              onPress={() => onNavigate(item.key)}
            />
          ))}
        </View>
      </View>

      {/* User + sign out */}
      <View style={{ paddingHorizontal: webSpacing.lg, gap: webSpacing.md }}>
        <View
          style={{
            height: 1,
            backgroundColor: colors.line,
            marginHorizontal: -webSpacing.lg,
          }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              backgroundColor: tealAlpha(0.16),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: accent.teal, fontSize: 12.5, fontWeight: '800' }}>
              {initials}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{
                color: colors.text,
                fontSize: fontSize.small,
                fontWeight: fontWeight.semibold,
                fontFamily: webFonts.body,
              }}
            >
              {userName ?? 'Signed out'}
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: colors.muted2, fontSize: fontSize.caption, fontFamily: webFonts.body }}
            >
              {userEmail ?? ''}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onSignOut}
          style={({ hovered }: any) => ({
            paddingVertical: 8,
            paddingHorizontal: 10,
            marginHorizontal: -10,
            borderRadius: 10,
            backgroundColor: hovered ? `${accent.danger}1A` : 'transparent',
          })}
        >
          {({ hovered }: any) => (
            <Text
              style={{
                color: hovered ? accent.danger : colors.muted,
                fontSize: fontSize.small,
                fontWeight: fontWeight.semibold,
                fontFamily: webFonts.body,
              }}
            >
              Sign out
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
