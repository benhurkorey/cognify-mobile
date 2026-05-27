// Cognify design tokens — mobile
import { Platform } from "react-native";

export const colors = {
  // Brand
  primary:       "#4F46E5",  // indigo-600
  primaryDark:   "#3730A3",  // indigo-800
  primaryLight:  "#EEF2FF",  // indigo-50
  primaryMid:    "#6366F1",  // indigo-500

  // Accent
  accent:        "#06B6D4",  // cyan-500
  accentLight:   "#ECFEFF",  // cyan-50

  // Semantic
  success:       "#10B981",  // emerald-500
  successLight:  "#D1FAE5",  // emerald-100
  warning:       "#F59E0B",  // amber-500
  warningLight:  "#FEF3C7",  // amber-100
  danger:        "#EF4444",  // red-500
  dangerLight:   "#FEE2E2",  // red-100
  info:          "#3B82F6",  // blue-500
  infoLight:     "#DBEAFE",  // blue-100

  // Neutrals
  white:         "#FFFFFF",
  background:    "#F1F5F9",  // slate-100 (slightly richer than before)
  surface:       "#F8FAFC",  // slate-50
  card:          "#FFFFFF",
  cardBorder:    "#F1F5F9",  // very subtle card border
  border:        "#E2E8F0",  // slate-200
  borderLight:   "#F1F5F9",  // slate-100

  // Text
  text:          "#0F172A",  // slate-900
  textSecondary: "#475569",  // slate-600 (slightly darker for contrast)
  textMuted:     "#94A3B8",  // slate-400
  textXMuted:    "#CBD5E1",  // slate-300

  // Tab
  tabBar:        "#FFFFFF",
  tabActive:     "#4F46E5",
  tabInactive:   "#94A3B8",

  // Header gradient emulation
  headerBg:      "#4F46E5",
  headerBgAlt:   "#312E81",  // indigo-900
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
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
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
    xxxl: 36,
  },
};

export const shadow = {
  xs: Platform.select({
    web:     { boxShadow: "0 1px 3px rgba(0,0,0,0.06)" } as object,
    default: {
      shadowColor:   "#0F172A",
      shadowOffset:  { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius:  3,
      elevation:     1,
    },
  })!,
  card: Platform.select({
    web:     { boxShadow: "0 2px 12px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.04)" } as object,
    default: {
      shadowColor:   "#0F172A",
      shadowOffset:  { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius:  12,
      elevation:     3,
    },
  })!,
  md: Platform.select({
    web:     { boxShadow: "0 4px 16px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.05)" } as object,
    default: {
      shadowColor:   "#0F172A",
      shadowOffset:  { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius:  16,
      elevation:     5,
    },
  })!,
  button: Platform.select({
    web:     { boxShadow: "0 4px 14px rgba(79,70,229,0.30)" } as object,
    default: {
      shadowColor:   "#4F46E5",
      shadowOffset:  { width: 0, height: 4 },
      shadowOpacity: 0.30,
      shadowRadius:  10,
      elevation:     5,
    },
  })!,
  success: Platform.select({
    web:     { boxShadow: "0 4px 14px rgba(16,185,129,0.25)" } as object,
    default: {
      shadowColor:   "#10B981",
      shadowOffset:  { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius:  10,
      elevation:     4,
    },
  })!,
};
