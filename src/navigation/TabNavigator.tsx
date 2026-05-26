import React                                        from "react";
import { createBottomTabNavigator }                from "@react-navigation/bottom-tabs";
import { View, Text, StyleSheet }                  from "react-native";
import HomeScreen                                  from "../screens/HomeScreen";
import TrainingStackNavigator                      from "./TrainingStackNavigator";
import ShiftsScreen                                from "../screens/ShiftsScreen";
import HRScreen                                    from "../screens/HRScreen";
import AlertsScreen                                from "../screens/AlertsScreen";
import { colors, font }                            from "../lib/theme";
import type { TabParamList }                       from "../types";

const Tab = createBottomTabNavigator<TabParamList>();

const ICONS: Record<string, { active: string; inactive: string }> = {
  Home:        { active: "🏠", inactive: "🏠" },
  TrainingTab: { active: "📚", inactive: "📚" },
  Shifts:      { active: "📅", inactive: "📅" },
  HR:          { active: "👤", inactive: "👤" },
  Alerts:      { active: "🔔", inactive: "🔔" },
};

function TabIcon({ name, focused, alertCount }: { name: string; focused: boolean; alertCount?: number }) {
  return (
    <View style={styles.iconWrapper}>
      <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{ICONS[name]?.active}</Text>
      {alertCount && alertCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{alertCount > 9 ? "9+" : alertCount}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor:   colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused }) => (
          <TabIcon
            name={route.name}
            focused={focused}
            alertCount={route.name === "Alerts" ? 1 : undefined}
          />
        ),
      })}
    >
      <Tab.Screen name="Home"        component={HomeScreen}             options={{ tabBarLabel: "Home"     }} />
      <Tab.Screen name="TrainingTab" component={TrainingStackNavigator} options={{ tabBarLabel: "Training", headerShown: false }} />
      <Tab.Screen name="Shifts"      component={ShiftsScreen}           options={{ tabBarLabel: "Shifts"   }} />
      <Tab.Screen name="HR"          component={HRScreen}               options={{ tabBarLabel: "HR"       }} />
      <Tab.Screen name="Alerts"      component={AlertsScreen}           options={{ tabBarLabel: "Alerts"   }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar:    { backgroundColor: colors.tabBar, borderTopColor: "#E2E8F0", height: 64, paddingBottom: 8, paddingTop: 6 },
  tabLabel:  { fontSize: font.sizes.xs, fontWeight: "700" },
  iconWrapper: { position: "relative", alignItems: "center", justifyContent: "center" },
  badge:     { position: "absolute", top: -4, right: -10, backgroundColor: colors.danger, borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
});
