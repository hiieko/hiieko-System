/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        hii: {
          50: '#ecfdf3',
          100: '#d1fae0',
          200: '#a7f0c0',
          300: '#6ee09a',
          400: '#34c970',
          500: '#188C51',
          600: '#0f7040',
          700: '#0c5935',
          800: '#0c472c',
          900: '#0a3a25',
          950: '#062015',
        },
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        surface: {
          DEFAULT: 'var(--hii-surface)',
          muted: 'var(--hii-surface-muted)',
          alt: 'var(--hii-surface-alt)',
        },
        content: {
          DEFAULT: 'var(--hii-text)',
          secondary: 'var(--hii-text-secondary)',
          muted: 'var(--hii-text-muted)',
        },
        border: {
          DEFAULT: 'var(--hii-border)',
          light: 'var(--hii-border-light)',
        },
        success: {
          DEFAULT: 'var(--hii-success)',
          soft: '#d1fae5',
          foreground: '#065f46',
        },
        warning: {
          DEFAULT: 'var(--hii-warning)',
          soft: '#fef3c7',
          foreground: '#78350f',
        },
        critical: {
          DEFAULT: 'var(--hii-critical)',
          soft: '#fee2e2',
          foreground: '#991b1b',
        },
        info: {
          DEFAULT: 'var(--hii-info)',
          soft: '#dbeafe',
          foreground: '#1e40af',
        },
        neutral: {
          soft: '#f1f5f9',
          foreground: '#475569',
        },
        // Phase-1 shell visual direction (see globals.css). Fixed dark chrome +
        // HIIEKO accent; declared as colours, never as a `dark:` theme.
        chrome: {
          DEFAULT: 'var(--hii-chrome)',
          elevated: 'var(--hii-chrome-elevated)',
          hover: 'var(--hii-chrome-hover)',
          line: 'var(--hii-chrome-border)',
          text: 'var(--hii-chrome-text)',
          muted: 'var(--hii-chrome-text-muted)',
        },
        accent: {
          DEFAULT: 'var(--hii-accent)',
          hover: 'var(--hii-accent-hover)',
          soft: 'var(--hii-accent-soft)',
          tile: 'var(--hii-accent-tile)',
          ink: 'var(--hii-accent-text)',
        },
        positive: {
          DEFAULT: 'var(--hii-positive)',
          soft: 'var(--hii-positive-soft)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        'xs': '0.25rem',
        'sm': '0.375rem',
        'md': '0.5rem',
        'lg': '0.625rem',
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        'card': '0 1px 2px 0 rgb(0 0 0 / 0.03), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        'card-hover': '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 2px 6px -1px rgb(0 0 0 / 0.08)',
        'elevated': '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'focus': '0 0 0 3px rgba(15, 112, 64, 0.3)',
      },
      maxWidth: {
        'page': '80rem',
      },
      zIndex: {
        'sidebar': '30',
        'header': '40',
        'backdrop': '50',
        'drawer': '60',
        'modal': '70',
        'toast': '80',
      },
      transitionDuration: {
        '250': '250ms',
        '400': '400ms',
      },
    },
  },
  plugins: [],
}
