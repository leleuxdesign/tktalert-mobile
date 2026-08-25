// TattleTow — iOS 6 Skeuomorphic Design System
// Ported from tktalert-app/client/src/index.css to keep the mobile app and
// web app visually identical.

export const colors = {
  blue: "#1a7fd4",
  blueDark: "#0f5fa0",
  blueLight: "#5aafff",
  green: "#4cd964",
  red: "#ff3b30",
  orange: "#ff9500",
  silver: "#c8c7cc",
  linen: "#e8e4dc",
  linenDark: "#d4cfc5",
  chrome: "#b0b0b5",
  darkChrome: "#7a7a80",
  text: "#1a1a1a",
  textLight: "#6d6d72",
  textFaint: "#aeaeb2",
  separator: "#c8c7cc",
  background: "#e8e4dc",
  card: "#f5f4f0",
  white: "#ffffff",
  purple: "#9b59b6",
  purpleDark: "#7d3c98",
};

export const radii = { sm: 6, md: 10, lg: 18, xl: 22 };

export const fontFamily = "Helvetica Neue";

// Gradient stop arrays for expo-linear-gradient, matching the CSS
// `linear-gradient(to bottom, ...)` / `135deg` gradients in index.css.
export const gradients = {
  navbar: ["#b0b9c8", "#8a95a8", "#6e7a8e", "#5a6678"] as const,
  btnBlue: ["#5aafff", "#1a7fd4", "#0f5fa0"] as const,
  btnGreen: ["#7de87d", "#4cd964", "#2db94d"] as const,
  btnRed: ["#ff7b74", "#ff3b30", "#cc1a10"] as const,
  btnSilver: ["#f5f5f7", "#e0e0e5", "#c8c8cd"] as const,
  backBtn: ["#5a8fc4", "#3a6fa4", "#2a5f94"] as const,
  card: ["#fafaf8", "#f0efeb"] as const,
  iconBlue: ["#5aafff", "#1a7fd4"] as const,
  iconGreen: ["#7de87d", "#4cd964"] as const,
  iconRed: ["#ff7b74", "#ff3b30"] as const,
  iconOrange: ["#ffbe5a", "#ff9500"] as const,
  iconPurple: ["#c77dff", "#9b59b6"] as const,
  iconGray: ["#b0b0b5", "#8a8a8f"] as const,
  appIconBlue: ["#5aafff", "#1a7fd4", "#0f5fa0"] as const,
  appIconGreen: ["#7de87d", "#4cd964", "#2db94d"] as const,
  appIconRed: ["#ff7b74", "#ff3b30"] as const,
  badgeRed: ["#ff6b6b", "#ff3b30", "#cc1a10"] as const,
  badgeBlue: ["#5aafff", "#1a7fd4", "#0f5fa0"] as const,
  badgeGreen: ["#7de87d", "#4cd964", "#2db94d"] as const,
  badgeOrange: ["#ffd060", "#ff9500"] as const,
  glossHighlight: ["rgba(255,255,255,0.4)", "rgba(255,255,255,0.1)"] as const,
  trialBanner: ["#ffd060", "#ffb400"] as const,
};

export const cardShadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.15,
  shadowRadius: 6,
  elevation: 3,
};

export const btnShadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 3,
};

export const navShadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.35,
  shadowRadius: 5,
  elevation: 5,
};
