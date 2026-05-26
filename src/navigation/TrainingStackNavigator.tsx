import React                               from "react";
import { createNativeStackNavigator }     from "@react-navigation/native-stack";
import TrainingScreen                     from "../screens/TrainingScreen";
import CourseDetailScreen                 from "../screens/CourseDetailScreen";
import LessonScreen                       from "../screens/LessonScreen";
import { colors, font }                   from "../lib/theme";
import type { TrainingStackParamList }    from "../types";

const Stack = createNativeStackNavigator<TrainingStackParamList>();

export default function TrainingStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle:        { backgroundColor: colors.background },
        headerTintColor:    colors.primary,
        headerTitleStyle:   { fontSize: font.sizes.base, fontWeight: "700", color: colors.text },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="TrainingList"
        component={TrainingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CourseDetail"
        component={CourseDetailScreen}
        options={({ route }) => ({ title: route.params.courseTitle })}
      />
      <Stack.Screen
        name="LessonView"
        component={LessonScreen}
        options={({ route }) => ({ title: route.params.lessonTitle })}
      />
    </Stack.Navigator>
  );
}
