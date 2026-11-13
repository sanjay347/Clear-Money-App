import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Fonts } from './Typography';
import { useTheme } from './ThemeContext';
import { HIT_TARGET, space, type } from '../design/tokens';

interface Props {
  title: string;
  subtitle?: string;
  /** Buttons on the right. Use HeaderButton so they share size and spacing. */
  right?: React.ReactNode;
  onBack?: () => void;
}

/**
 * The one header for every pushed screen: back button, centred serif title,
 * optional subtitle and right-hand actions. The side slots are equal width so
 * the title stays centred whatever is on the right.
 */
export default function ScreenHeader({ title, subtitle, right, onBack }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        <HeaderButton label="Back" onPress={onBack ?? (() => router.back())}>
          <ChevronLeft size={26} color={colors.text} />
        </HeaderButton>
      </View>
      <View style={styles.center}>
        <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

export function HeaderButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: space.sm, minHeight: 56 },
  side: { width: HIT_TARGET * 2, flexDirection: 'row', alignItems: 'center' },
  sideRight: { justifyContent: 'flex-end' },
  center: { flex: 1, alignItems: 'center' },
  title: { fontSize: type.screenTitle, fontFamily: Fonts.serif, letterSpacing: -0.4 },
  subtitle: { fontSize: type.caption + 1, fontFamily: Fonts.regular, marginTop: 1 },
  button: { width: HIT_TARGET, height: HIT_TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: HIT_TARGET / 2 },
  pressed: { opacity: 0.5 },
});
