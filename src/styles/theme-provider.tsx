
import React, { createContext, useContext, ReactNode } from 'react';
import { ThemeConfig, currentTheme } from './theme';

// Create theme context
const ThemeContext = createContext<ThemeConfig>(currentTheme);

// Theme provider props
interface ThemeProviderProps {
  children: ReactNode;
  theme?: ThemeConfig;
}

// Theme provider component
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ 
  children, 
  theme = currentTheme 
}) => {
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook to use the theme
export const useTheme = () => useContext(ThemeContext);
