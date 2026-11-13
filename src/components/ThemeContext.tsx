import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Appearance, Easing, Image, StyleSheet, UIManager, Platform, View, useColorScheme } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { getUserProfile, saveUserProfile } from '../db/transactions';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

export type Theme = 'dark' | 'light';

export const Colors = {
  dark: {
    background: '#06080F',
    card: '#0E1117',
    border: '#1C2333',
    text: '#FFFFFF',
    textSecondary: '#9099AD', // 7:1 on the background; the old #6B7280 was below the 4.5:1 minimum
    primary: '#3B82F6',
    danger: '#EF4444',
    tabBar: '#0E1117',
    cardShadow: 'transparent',
    cardAlt: '#131924',
  },
  light: {
    background: '#F2F5FF',
    card: '#FFFFFF',
    border: '#E4E8F7',
    text: '#0F172A',
    textSecondary: '#5B6A8A',
    primary: '#2563EB',
    danger: '#DC2626',
    tabBar: '#FFFFFF',
    cardShadow: '#1E3A8A14',
    cardAlt: '#F6F8FF',
  },
};

export type AppColors = typeof Colors.dark & typeof Colors.light;

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  colors: AppColors;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
  colors: Colors.light,
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // The app follows the phone's light/dark setting until the user picks a theme
  // in Profile. That choice is saved and wins from then on.
  const system = useColorScheme();
  const [override, setOverride] = useState<Theme | null>(null);

  useEffect(() => {
    getUserProfile()
      .then(profile => {
        if (profile.theme === 'dark' || profile.theme === 'light') {
          setOverride(profile.theme);
          Appearance.setColorScheme(profile.theme); // keyboards and alerts match too
        }
      })
      .catch(() => { /* first launch: the profile table does not exist yet */ });
  }, []);

  const theme: Theme = override ?? (system === 'dark' ? 'dark' : 'light');

  // Crossfade. A plain colour fade hid the whole screen for a moment, which read
  // as a blink. Instead: take a picture of the screen in the OLD theme, lay it
  // over everything, switch the colours underneath, then fade the picture out.
  // The old screen dissolves into the new one, tab bar and all.
  const rootRef = useRef<View>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const snapshotOpacity = useRef(new Animated.Value(0)).current;
  const pendingTheme = useRef<Theme | null>(null);
  const switching = useRef(false);

  const apply = (next: Theme) => {
    setOverride(next);
    Appearance.setColorScheme(next);
    saveUserProfile({ theme: next }).catch(() => {});
  };

  const toggleTheme = async () => {
    if (switching.current) return; // ignore taps during a transition
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    switching.current = true;
    try {
      const uri = await captureRef(rootRef, { format: 'png', result: 'tmpfile' });
      pendingTheme.current = next;
      snapshotOpacity.setValue(1);
      setSnapshot(uri); // the switch happens in onSnapshotShown, once the picture is on screen
    } catch {
      apply(next); // no snapshot available: switch without the transition
      switching.current = false;
    }
  };

  const onSnapshotShown = () => {
    const next = pendingTheme.current;
    if (!next) return;
    pendingTheme.current = null;
    apply(next);
    // Two frames for the new colours to paint under the picture, then dissolve it.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      Animated.timing(snapshotOpacity, {
        toValue: 0, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
      }).start(() => {
        setSnapshot(null);
        switching.current = false;
      });
    }));
  };

  const colors = Colors[theme];

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
      <View ref={rootRef} collapsable={false} style={{ flex: 1 }}>
        {children}
      </View>
      {snapshot && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: snapshotOpacity }]}>
          <Image source={{ uri: snapshot }} onLoad={onSnapshotShown} fadeDuration={0} style={StyleSheet.absoluteFill} />
        </Animated.View>
      )}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
