/**
 * Custom bottom tab bar.
 *
 * React Navigation's default bar cannot lift one item above the bar, and the
 * design raises Capture into a 46px circle that overhangs the top edge
 * (`marginTop: -14` in the capCircle style). So the bar is drawn by hand from
 * the design's values: 88px tall, 4 equal columns, 9px top padding, with the
 * three ordinary tabs nudged down 6px.
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { useTheme } from '../context/ThemeContext';
import {
  CaptureIcon,
  DashboardIcon,
  ProfileIcon,
  TransactionsIcon,
  type IconProps,
} from '../components/icons';
import { accent, tealAlpha } from '../theme';
import type { TabParamList } from './types';

const BAR_HEIGHT = 88;
const CAPTURE_SIZE = 46;
/** Dark ink used for the icon inside the filled Capture circle. */
const CAPTURE_ACTIVE_INK = '#0B1120';

const ICONS: Record<keyof TabParamList, React.ComponentType<IconProps>> = {
  Transactions: TransactionsIcon,
  Capture: CaptureIcon,
  Dashboard: DashboardIcon,
  Profile: ProfileIcon,
};

export default function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        height: BAR_HEIGHT + insets.bottom,
        paddingTop: 9,
        paddingBottom: insets.bottom,
        backgroundColor: colors.card,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.soft,
      }}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const name = route.name as keyof TabParamList;
        const Icon = ICONS[name];
        const label = descriptors[route.key]?.options.title ?? name;
        const isCapture = name === 'Capture';

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const tint = focused ? accent.teal : colors.muted;

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={() =>
              navigation.emit({ type: 'tabLongPress', target: route.key })
            }
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={label}
            style={{
              flex: 1,
              alignItems: 'center',
              gap: 4,
              paddingTop: isCapture ? 0 : 6,
            }}
          >
            {isCapture ? (
              <View
                style={{
                  width: CAPTURE_SIZE,
                  height: CAPTURE_SIZE,
                  borderRadius: CAPTURE_SIZE / 2,
                  marginTop: -14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: focused ? accent.teal : tealAlpha(0.16),
                  // The design's `0 6px 20px rgba(45,212,191,0.4)` glow.
                  ...(focused
                    ? Platform.select({
                        ios: {
                          shadowColor: accent.teal,
                          shadowOpacity: 0.4,
                          shadowRadius: 10,
                          shadowOffset: { width: 0, height: 6 },
                        },
                        android: { elevation: 8 },
                        default: {},
                      })
                    : null),
                }}
              >
                <Icon color={focused ? CAPTURE_ACTIVE_INK : accent.teal} size={22} />
              </View>
            ) : (
              <View
                style={{
                  width: 26,
                  height: 26,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon color={tint} size={22} />
              </View>
            )}

            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: focused ? accent.teal : colors.muted,
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
