import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './frontend/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        deadshot: {
          bg: '#05070B', panel: '#0B1018', panel2: '#101827', text: '#F8FAFC', muted: '#94A3B8',
          green: '#22C55E', greenGlow: '#39FF88', gold: '#F5C542', purple: '#8B5CF6', cyan: '#22D3EE', red: '#EF4444', orange: '#F97316',
        },
      },
      boxShadow: {
        glowGreen: '0 0 35px rgba(34, 197, 94, 0.22)',
        glowPurple: '0 0 35px rgba(139, 92, 246, 0.25)',
        glowGold: '0 0 35px rgba(245, 197, 66, 0.18)',
        dangerGlow: '0 0 35px rgba(239, 68, 68, 0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
