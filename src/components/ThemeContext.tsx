import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Appearance, StyleSheet, UIManager, Platform, useColorScheme } from 'react-native';
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

  // Switching themes re-renders every screen at once, which looked like a flash.
  // A veil in the NEW theme's background fades in, the colours switch behind it
  // while nothing is visible, then it fades out.
  const veil = useRef(new Animated.Value(0)).current;
  const [veilColor, setVeilColor] = useState(Colors.light.background);

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setVeilColor(Colors[next].background);
    Animated.timing(veil, { toValue: 1, duration: 160, useNativeDriver: true }).start(() => {
      setOverride(next);
      Appearance.setColorScheme(next);
      saveUserProfile({ theme: next }).catch(() => {});
      // Give the new colours a frame to paint before revealing them.
      requestAnimationFrame(() => {
        Animated.timing(veil, { toValue: 0, duration: 260, useNativeDriver: true }).start();
      });
    });
  };

  const colors = Colors[theme];

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: veilColor, opacity: veil }]}
      />
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
