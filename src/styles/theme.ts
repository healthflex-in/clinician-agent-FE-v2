
// Theme configuration with customizable colors
export const themeColors = {
  // Primary colors
  primary: "#9b87f5",  
  primaryLight: "#b2a1f8",
  primaryDark: "#7e69ab",
  
  // Text colors
  textDark: "#1A1F2C", 
  textMuted: "#8E9196",
  textLight: "#FFFFFF",
  
  // UI colors
  background: "#F6F7F9",
  backgroundDark: "#E5E7EB",
  card: "#FFFFFF",
  border: "#E2E8F0",
  
  // Feedback colors
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
  
  // Status colors
  recording: "#EF4444", 
  processing: "#F59E0B",
  completed: "#10B981",
  
  // Misc
  highlight: "#F8F0FF",
  shadow: "rgba(0, 0, 0, 0.1)",
};

// Typography settings
export const typography = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  }
};

// Spacing values
export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem',
  '3xl': '4rem',
};

// Rounded corners
export const borderRadius = {
  none: '0',
  sm: '0.125rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  full: '9999px',
};

// Shadows
export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
};

// Animation timing
export const animation = {
  fast: '0.15s',
  normal: '0.3s',
  slow: '0.5s',
};

// Export full theme
const theme = {
  colors: themeColors,
  typography,
  spacing,
  borderRadius,
  shadows,
  animation
};

export default theme;
