import React, { createContext, useContext } from 'react';

export interface ColorScheme {
  bg0: string;
  bg1: string;
  bg2: string;
  bg3: string;
  accent: string;
  accentGlow: string;
  text: string;
  textSub: string;
  textMuted: string;
  border: string;
  live: string;
  liveGlow: string;
  success: string;
  sportFootball: string;
  sportBasketball: string;
  sportVolleyball: string;
  sportMotor: string;
  statusBar: 'light-content' | 'dark-content';
  purple: string;
}

export const LIGHT: ColorScheme = {
  bg0: '#F0F5FF',
  bg1: '#FFFFFF',
  bg2: '#E6EEFF',
  bg3: '#D0DFFA',
  accent: '#1D59C4',
  accentGlow: 'rgba(29,89,196,0.10)',
  text: '#0D1B3E',
  textSub: '#2E4D8C',
  textMuted: '#6B8DC4',
  border: '#BAD0F0',
  live: '#DC2626',
  liveGlow: 'rgba(220,38,38,0.08)',
  success: '#059669',
  sportFootball: '#059669',
  sportBasketball: '#B45309',
  sportVolleyball: '#1D59C4',
  sportMotor: '#DC2626',
  statusBar: 'dark-content',
  purple: '#7C3AED',
};

interface ThemeCtx {
  colors: ColorScheme;
  theme: 'light';
  setTheme: (t: string) => void;
}

const ThemeContext = createContext<ThemeCtx>({
  colors: LIGHT,
  theme: 'light',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value={{ colors: LIGHT, theme: 'light', setTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
