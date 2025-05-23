// Theme configuration
export const themeColors = {
  primary: {
    DEFAULT: '#3b82f6', // blue-500
    dark: '#2563eb', // blue-600
    light: '#60a5fa', // blue-400
  },
  secondary: {
    DEFAULT: '#6b7280', // gray-500
    dark: '#4b5563', // gray-600
    light: '#9ca3af', // gray-400
  },
  background: {
    DEFAULT: '#f9fafb', // gray-50
    dark: '#f3f4f6', // gray-100
  },
  card: {
    DEFAULT: '#ffffff',
    dark: '#f9fafb', // gray-50
  },
  text: {
    DEFAULT: '#374151', // gray-700
    dark: '#1f2937', // gray-800
    light: '#6b7280', // gray-500
  },
  border: {
    DEFAULT: '#e5e7eb', // gray-200
    dark: '#d1d5db', // gray-300
  },
  success: {
    DEFAULT: '#10b981', // emerald-500
    light: '#d1fae5', // emerald-100
  },
  warning: {
    DEFAULT: '#f59e0b', // amber-500
    light: '#fef3c7', // amber-100
  },
  danger: {
    DEFAULT: '#ef4444', // red-500
    light: '#fee2e2', // red-100
  },
  info: {
    DEFAULT: '#3b82f6', // blue-500
    light: '#dbeafe', // blue-100
  },
};

// Current theme
export const currentTheme = {
  colors: themeColors,
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },
  borderRadius: {
    sm: '0.125rem',
    DEFAULT: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    full: '9999px',
  },
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
  fontWeights: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};

// Type definition for theme config
export interface ThemeConfig {
  colors: typeof themeColors;
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
  fontSizes: Record<string, string>;
  fontWeights: Record<string, number>;
}
