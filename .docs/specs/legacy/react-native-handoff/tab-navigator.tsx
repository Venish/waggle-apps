import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeStack } from '@/app/navigation/stacks/home-stack';
import { EducationStack } from '@/app/navigation/stacks/education-stack';
import { WalkStack } from '@/app/navigation/stacks/walk-stack';
import { MissionStack } from '@/app/navigation/stacks/mission-stack';
import { ShopStack } from '@/app/navigation/stacks/shop-stack';
import type { RootTabParamList } from '@/app/navigation/types';
import { useTheme } from '@/theme';
import { AppIcon, type IconName } from '@/components/ui/AppIcon';

const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_ICONS: Record<keyof RootTabParamList, IconName> = {
  HomeTab: 'home',
  WalkTab: 'walk',
  EducationTab: 'education',
  MissionTab: 'mission',
  ShopTab: 'shop',
};

export function MainTabNavigator() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        // 활성 탭: soft 알약 배경 + accent 아이콘 (디자인 시안 그대로)
        tabBarIcon: ({ focused }) => (
          <View
            style={{
              width: 46,
              height: 30,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: focused ? theme.soft : 'transparent',
            }}
          >
            <AppIcon
              name={TAB_ICONS[route.name]}
              size={22}
              color={focused ? theme.accent : theme.textMuted}
            />
          </View>
        ),
      })}
    >
      <Tab.Screen component={HomeStack} name="HomeTab" options={{ title: '홈' }} />
      <Tab.Screen component={WalkStack} name="WalkTab" options={{ title: '산책' }} />
      <Tab.Screen component={EducationStack} name="EducationTab" options={{ title: '교육' }} />
      <Tab.Screen component={MissionStack} name="MissionTab" options={{ title: '미션' }} />
      <Tab.Screen component={ShopStack} name="ShopTab" options={{ title: '포인트샵' }} />
    </Tab.Navigator>
  );
}
