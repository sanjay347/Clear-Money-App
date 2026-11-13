import React, { useCallback, useState } from 'react';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../src/components/ThemeContext';
import { getUserProfile } from '../../src/db/transactions';

/**
 * The system tab bar, drawn by UIKit.
 *
 * The previous bar was built from React Native views. Its taps were handled on
 * the JavaScript thread, so while a screen was loading data the first tap or
 * two were dropped. A native bar responds immediately whatever JavaScript is
 * doing, and on iOS 26 and later it is drawn in Liquid Glass with no extra work.
 *
 * "Add" uses the search role, which iOS places apart from the other tabs as its
 * own round button: the same position the old centre "+" had, in the system's
 * own style.
 */
export default function TabLayout() {
  const { colors } = useTheme();
  const [aiName, setAiName] = useState('');

  useFocusEffect(useCallback(() => {
    getUserProfile().then(p => { if (p.ai_name) setAiName(p.ai_name); }).catch(() => {});
  }, []));

  return (
    <NativeTabs tintColor={colors.primary}>
      <NativeTabs.Trigger name="dashboard">
        <Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="insights">
        <Icon sf={{ default: 'chart.pie', selected: 'chart.pie.fill' }} />
        <Label>Insights</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat">
        <Icon sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }} />
        <Label>{aiName || 'Chat'}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="add" role="search">
        <Icon sf="plus" />
        <Label>Add</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
