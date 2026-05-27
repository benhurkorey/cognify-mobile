import React                                        from "react";
import { createBottomTabNavigator }                from "@react-navigation/bottom-tabs";
import { View, StyleSheet, Platform }              from "react-native";
import { Ionicons }                                from "@expo/vector-icons";
import HomeScreen                                  from "../screens/HomeScreen";
import TrainingStackNavigator                      from "./TrainingStackNavigator";
import ShiftsScreen                                from "../screens/ShiftsScreen";
import HRScreen                                    from "../screens/HRScreen";
import AlertsScreen                                from "../screens/AlertsScreen";
import { colors, font, radius }                    from "../lib/theme";
import type { TabParamList }                       from "../types";

const Tab = createBottomTabNavigator<TabParamList>();

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ICONS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  Home:        { active: "home",          inactive: "home-outline"          },
  TrainingTab: { active: "book",          inactive: "book-outline"          },
  Shifts:      { active: "calendar",      inactive: "calendar-outline"      },
  HR:          { active: "person-circle", inactive: "person-circle-outline" },
  Alerts:      { active: "notifications", inactive: "notifications-outline" },
};

function TabIcon({
  name, focused, alertCount,
}: { name: string; focused: boolean; alertCount?: number }) {
  const icons = TAB_ICONS[name];
  const iconName = focused ? icons?.active : icons?.inactive;
  const iconColor = focused ? colors.tabActive : colors.tabInactive;

  return (
    <View style={styles.iconWrapper}>
      <Ionicons name={iconName ?? "ellipse-outline"} size={23} color={iconColor} />
      {alertCount && alertCount > 0 ? (
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
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
        tabBarItemStyle: styles.tabItem,
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
  tabBar: {
    backgroundColor: colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: "#E8EDFB",
    height: Platform.OS === "ios" ? 82 : 68,
    paddingBottom: Platform.OS === "ios" ? 22 : 8,
    paddingTop: 8,
    ...Platform.select({
      web: { boxShadow: "0 -4px 20px rgba(15,23,42,0.06)" } as object,
      default: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 10,
      },
    }),
  },
  tabLabel: {
    fontSize: font.sizes.xs,
    fontWeight: "600",
    marginTop: 2,
  },
  tabItem: {
    paddingTop: 2,
  },
  iconWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
  },
  badge: {
    position: "absolute",
    top: 1,
    right: 1,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
});
