// Cognify design tokens — mobile
import { Platform } from "react-native";

export const colors = {
  primary:      "#4F46E5",  // indigo-600
  primaryDark:  "#3730A3",  // indigo-800
  primaryLight: "#EEF2FF",  // indigo-50
  accent:       "#06B6D4",  // cyan-500
  success:      "#10B981",  // emerald-500
  warning:      "#F59E0B",  // amber-500
  danger:       "#EF4444",  // red-500
  white:        "#FFFFFF",
  background:   "#F8FAFC",  // slate-50
  card:         "#FFFFFF",
  border:       "#E2E8F0",  // slate-200
  text:         "#0F172A",  // slate-900
  textSecondary:"#64748B",  // slate-500
  textMuted:    "#94A3B8",  // slate-400
  tabBar:       "#FFFFFF",
  tabActive:    "#4F46E5",
  tabInactive:  "#94A3B8",
};

export const spacing = {
  xs:   4,
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  xxl:  48,
};

export const radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  full: 9999,
};

export const font = {
  regular: "System",
  medium:  "System",
  bold:    "System",
  sizes: {
    xs:   11,
    sm:   13,
    base: 15,
    md:   17,
    lg:   20,
    xl:   24,
    xxl:  30,
  },
};

export const shadow = {
  card: Platform.select({
    web:     { boxShadow: "0 2px 8px rgba(0,0,0,0.06)" } as object,
    default: {
      shadowColor:   "#000",
      shadowOffset:  { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius:  8,
      elevation:     3,
    },
  })!,
  button: Platform.select({
    web:     { boxShadow: "0 4px 8px rgba(79,70,229,0.25)" } as object,
    default: {
      shadowColor:   "#4F46E5",
      shadowOffset:  { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius:  8,
      elevation:     4,
    },
  })!,
};
