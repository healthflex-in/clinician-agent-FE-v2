
import React, { createContext, useContext, ReactNode } from 'react';
import { currentTheme, ThemeConfig } from './theme';

// Create a context for the theme
const ThemeContext = createContext<ThemeConfig>(currentTheme);

// Theme provider component
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  return (
    <ThemeContext.Provider value={currentTheme}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook to access the theme
export const useTheme = (): ThemeConfig => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
