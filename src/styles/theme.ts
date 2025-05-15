
export type ThemeColors = {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  secondaryLight: string;
  secondaryDark: string;
  accent: string;
  accentLight: string;
  accentDark: string;
  background: string;
  backgroundAlt: string;
  text: string;
  textLight: string;
  textDark: string;
  border: string;
  error: string;
  success: string;
  warning: string;
  info: string;
  disabled: string;
  highlight: string;
};

export type ThemeConfig = {
  colors: ThemeColors;
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };
  fontSizes: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  transitions: {
    fast: string;
    medium: string;
    slow: string;
  };
};

// Default light theme
export const lightTheme: ThemeConfig = {
  colors: {
    primary: '#DDFE71', // Parrot brand color
    primaryLight: '#e8ff9a',
    primaryDark: '#9fb843',
    secondary: '#08979C', // Teal
    secondaryLight: '#36cfc9',
    secondaryDark: '#006d75',
    accent: '#722ED1', // Purple
    accentLight: '#b37feb',
    accentDark: '#531dab',
    background: '#ffffff',
    backgroundAlt: '#f9f9f9',
    text: '#1f1f1f',
    textLight: '#595959',
    textDark: '#000000',
    border: '#e6e6e6',
    error: '#f5222d',
    success: '#52c41a',
    warning: '#faad14',
    info: '#1890ff',
    disabled: '#bfbfbf',
    highlight: '#FFF9E8',
  },
  borderRadius: {
    sm: '0.125rem', // 2px
    md: '0.25rem',  // 4px
    lg: '0.5rem',   // 8px
    xl: '1rem',     // 16px
    full: '9999px', // Fully rounded
  },
  fontSizes: {
    xs: '0.75rem',  // 12px
    sm: '0.875rem', // 14px
    md: '1rem',     // 16px
    lg: '1.125rem', // 18px
    xl: '1.25rem',  // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '2rem',   // 32px
  },
  spacing: {
    xs: '0.25rem',  // 4px
    sm: '0.5rem',   // 8px
    md: '1rem',     // 16px
    lg: '1.5rem',   // 24px
    xl: '2rem',     // 32px
    '2xl': '3rem',  // 48px
    '3xl': '4rem',  // 64px
  },
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  transitions: {
    fast: 'all 0.2s ease',
    medium: 'all 0.3s ease',
    slow: 'all 0.5s ease',
  },
};

// Default dark theme (not used in current implementation but available for future use)
export const darkTheme: ThemeConfig = {
  colors: {
    primary: '#DDFE71',
    primaryLight: '#e8ff9a',
    primaryDark: '#9fb843',
    secondary: '#13c2c2',
    secondaryLight: '#36cfc9',
    secondaryDark: '#006d75',
    accent: '#b37feb',
    accentLight: '#d3adf7',
    accentDark: '#722ed1',
    background: '#141414',
    backgroundAlt: '#1f1f1f',
    text: '#f0f0f0',
    textLight: '#bfbfbf',
    textDark: '#ffffff',
    border: '#303030',
    error: '#ff4d4f',
    success: '#73d13d',
    warning: '#ffc53d',
    info: '#40a9ff',
    disabled: '#5f5f5f',
    highlight: '#3b2a01',
  },
  borderRadius: {
    sm: '0.125rem',
    md: '0.25rem',
    lg: '0.5rem',
    xl: '1rem',
    full: '9999px',
  },
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '2rem',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.2)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.15)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.14)',
  },
  transitions: {
    fast: 'all 0.2s ease',
    medium: 'all 0.3s ease',
    slow: 'all 0.5s ease',
  },
};

// Export current theme (we'll use light theme for now)
export const currentTheme = lightTheme;
