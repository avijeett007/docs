/** Allowed accent colors for UI components */
export type AccentColor = 'blue' | 'green' | 'red' | 'purple' | 'teal';

/** Theme configuration for the application */
export interface ThemeConfig {
  /** Primary accent color */
  accentColor: AccentColor;
  /** Whether dark mode is enabled */
  darkMode: boolean;
  /** Custom CSS variables */
  cssVariables?: Record<string, string>;
}

/** Theme color options for the playground */
export type ThemeColor = AccentColor;

/** Options for connecting to a room */
export interface ConnectOptions {
  token: string;
  url: string;
  /** Additional configuration options */
  config?: {
    audio?: boolean;
    video?: boolean;
  };
}
