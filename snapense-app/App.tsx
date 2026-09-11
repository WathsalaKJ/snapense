import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import RootNavigator from './src/navigation/RootNavigator';
import { fixAutofillStyles } from './src/web/fixAutofillStyles';
import { loadWebFonts } from './src/web/loadWebFonts';

/** Status bar text has to follow the in-app theme, not the OS. */
function ThemedStatusBar() {
  const { theme } = useTheme();
  return <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />;
}

export default function App() {
  // No-op on native (Platform.OS check happens inside); loads the desktop
  // web font pairing and the autofill CSS override once, on mount.
  React.useEffect(() => {
    loadWebFonts();
    fixAutofillStyles();
  }, []);

  return (
    // GestureHandlerRootView must wrap the tree for swipeable rows to work.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <ThemedStatusBar />
            <RootNavigator />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
