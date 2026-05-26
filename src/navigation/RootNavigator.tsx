import React                               from "react";
import { createNativeStackNavigator }     from "@react-navigation/native-stack";
import { NavigationContainer }            from "@react-navigation/native";
import { ActivityIndicator, View }        from "react-native";
import { useAuth }                        from "../auth/AuthContext";
import LoginScreen                        from "../screens/LoginScreen";
import TabNavigator                       from "./TabNavigator";
import { colors }                         from "../lib/theme";
import type { RootStackParamList }        from "../types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary }}>
        <ActivityIndicator color={colors.white} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <Stack.Screen name="Main"  component={TabNavigator}  />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
