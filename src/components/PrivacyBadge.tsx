import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { Fonts } from './Typography';
import { useTheme } from './ThemeContext';
import { radius, type } from '../design/tokens';

/**
 * The single "your data stays here" marker. Screens used to say "on device",
 * "on-device" or "Private" in three different chip styles.
 */
export default function PrivacyBadge({ label = 'On-device' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}. Your data stays on this phone.`}
      style={[styles.chip, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '33' }]}
    >
      <ShieldCheck size={14} color={colors.primary} />
      <Text style={[styles.text, { color: colors.primary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: radius.pill, borderWidth: 1, alignSelf: 'center',
  },
  text: { fontSize: type.label, fontFamily: Fonts.semiBold },
});
