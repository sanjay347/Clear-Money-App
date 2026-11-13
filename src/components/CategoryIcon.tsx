import React from 'react';
import { View } from 'react-native';
import { categoryStyle } from '../design/categories';
import { radius } from '../design/tokens';

interface Props { category: string; size?: number }

/** Rounded tile with the category's icon, tinted in the category's colour. */
export default function CategoryIcon({ category, size = 40 }: Props) {
  const { icon: Icon, color } = categoryStyle(category);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        width: size, height: size, borderRadius: radius.md,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: color + '1F', // 12% tint
      }}
    >
      <Icon size={Math.round(size * 0.48)} color={color} strokeWidth={2} />
    </View>
  );
}
