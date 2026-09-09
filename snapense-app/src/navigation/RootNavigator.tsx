import React, { useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer, useNavigationContainerRef, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useIsDesktopWeb } from '../hooks/useResponsive';
import { Loading } from '../components';
import { accent, fontSize, fontWeight } from '../theme';
import TabBar from './TabBar';
import WebSidebar, { resolveSidebarActive, type SidebarNavKey } from './WebSidebar';

import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TransactionsListScreen from '../screens/TransactionsListScreen';
import TransactionDetailScreen from '../screens/TransactionDetailScreen';
import CaptureScreen from '../screens/CaptureScreen';
import ScanningScreen from '../screens/ScanningScreen';
import ReceiptReviewScreen from '../screens/ReceiptReviewScreen';
import ProfileScreen from '../screens/ProfileScreen';
import BudgetsScreen from '../screens/BudgetsScreen';
import BudgetHistoryScreen from '../screens/BudgetHistoryScreen';

import type { AppStackParamList, AuthStackParamList, TabParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

function TabNavigator() {
  return (
    <Tabs.Navigator
      // Capture sits second and raised, as in the design's tab bar.
      initialRouteName="Capture"
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="Transactions"
        component={TransactionsListScreen}
        options={{ title: 'Transactions' }}
      />
      <Tabs.Screen name="Capture" component={CaptureScreen} options={{ title: 'Capture' }} />
      <Tabs.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Dashboard' }}
      />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tabs.Navigator>
  );
}

function AuthNavigator({ isReturning }: { isReturning: boolean }) {
  return (
    <AuthStack.Navigator
      // A returning user - including one bounced here by a 401 - goes
      // straight to Login instead of seeing onboarding again.
      initialRouteName={isReturning ? 'Login' : 'Onboarding'}
      screenOptions={{ headerShown: false }}
    >
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  const { colors } = useTheme();

  return (
    <AppStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <AppStack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
      <AppStack.Screen
        name="Scanning"
        component={ScanningScreen}
        // Full-bleed loading state; a header would break the design.
        options={{ headerShown: false, animation: 'fade' }}
      />
      <AppStack.Screen
        name="TransactionDetail"
        component={TransactionDetailScreen}
        options={{ title: 'Transaction', headerBackTitle: 'Back' }}
      />
      <AppStack.Screen
        name="ReceiptReview"
        component={ReceiptReviewScreen}
        options={{ title: 'Review receipt' }}
      />
      <AppStack.Screen
        name="Budgets"
        component={BudgetsScreen}
        options={{ title: 'Budgets', headerBackTitle: 'Back' }}
      />
      <AppStack.Screen
        name="BudgetHistory"
        component={BudgetHistoryScreen}
        options={{ title: 'Budget History', headerBackTitle: 'Back' }}
      />
    </AppStack.Navigator>
  );
}

export default function RootNavigator() {
  const { isAuthenticated, isRestoring, isReturning, user, logout } = useAuth();
  const { colors, theme } = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const navigationRef = useNavigationContainerRef();
  const [activeRouteName, setActiveRouteName] = useState<string | undefined>(undefined);

  const navTheme: Theme = {
    dark: theme === 'dark',
    colors: {
      primary: accent.teal,
      background: colors.bg,
      card: colors.card,
      text: colors.text,
      border: colors.line,
      notification: accent.danger,
    },
    // React Navigation 7 requires a font descriptor; the app uses system fonts.
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' },
      medium: { fontFamily: 'System', fontWeight: '500' },
      bold: { fontFamily: 'System', fontWeight: '700' },
      heavy: { fontFamily: 'System', fontWeight: '900' },
    },
  };

  if (isRestoring) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Loading label="Restoring your session…" />
      </View>
    );
  }

  // WebSidebar lives outside the tab/stack navigators (a full-height side
  // rail doesn't fit createBottomTabNavigator's `tabBar` slot), so it
  // navigates imperatively via this ref rather than useNavigation().
  const handleSidebarNavigate = (key: SidebarNavKey) => {
    if (key === 'Budgets') {
      navigationRef.navigate('Budgets');
    } else {
      navigationRef.navigate('Tabs', { screen: key });
    }
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onStateChange={
        isDesktopWeb ? () => setActiveRouteName(navigationRef.getCurrentRoute()?.name) : undefined
      }
    >
      {isAuthenticated && isDesktopWeb ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <WebSidebar
            active={resolveSidebarActive(activeRouteName)}
            onNavigate={handleSidebarNavigate}
            userName={user?.full_name}
            userEmail={user?.email}
            onSignOut={logout}
          />
          <View style={{ flex: 1 }}>
            <AppNavigator />
          </View>
        </View>
      ) : isAuthenticated ? (
        <AppNavigator />
      ) : (
        <AuthNavigator isReturning={isReturning} />
      )}
    </NavigationContainer>
  );
}
