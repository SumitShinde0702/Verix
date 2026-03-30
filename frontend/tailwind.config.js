/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark base palette
        void:    '#080c14',
        surface: '#0d1421',
        card:    '#111827',
        border:  '#1e2d40',
        // Accent palette
        cyan:    { DEFAULT: '#00d4ff', dim: '#0099bb', glow: 'rgba(0,212,255,0.15)' },
        violet:  { DEFAULT: '#7c3aed', dim: '#5b21b6', glow: 'rgba(124,58,237,0.15)' },
        emerald: { DEFAULT: '#10b981', dim: '#059669', glow: 'rgba(16,185,129,0.15)' },
        amber:   { DEFAULT: '#f59e0b', dim: '#d97706' },
        rose:    { DEFAULT: '#f43f5e', dim: '#e11d48' },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan':    '0 0 20px rgba(0,212,255,0.2), 0 0 40px rgba(0,212,255,0.05)',
        'glow-violet':  '0 0 20px rgba(124,58,237,0.2), 0 0 40px rgba(124,58,237,0.05)',
        'glow-emerald': '0 0 20px rgba(16,185,129,0.2)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in':    'fadeIn 0.4s ease-out',
        'slide-up':   'slideUp 0.35s ease-out',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:   { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        glowPulse: { '0%,100%': { opacity: '0.6' }, '50%': { opacity: '1' } },
      },
    },
  },
  plugins: [],
};
