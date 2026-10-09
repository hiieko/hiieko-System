/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Scan the whole `src` tree. The previous three globs (pages/components/app) skipped
    // `src/features/**`, `src/lib/**` and `src/contexts/**`, so responsive/arbitrary
    // utilities used only inside those files were never emitted (e.g. `sm:grid`,
    // `lg:grid-cols-5` and `sm:grid-cols-[…]` in `features/planning`) and those surfaces
    // silently fell back to their mobile classes (ISSUE-063).
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // D0 semantic color system: brand + success/warning/danger/info + slate neutrals.
        // Brand: only the shades that pages actually use (500/600/700 are canonical;
        // 50-400 and 800 are still referenced by existing pages and are kept until
        // those pages migrate in D4 — removing them now would change the preview).
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
        },
        // NOTE: `amber` override removed in D0 — every value was byte-identical to
        // the Tailwind default palette, so `amber-*` utilities are unchanged.
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
        // NOTE: `border` and `neutral` color groups removed in D0 — no utility
        // in web/src referenced them, so nothing can change visually.
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
        // D0 spec calls this group `danger`; pages currently use `critical`
        // (text-critical, bg-critical, bg-critical-soft). Renaming would break
        // those pages, so the name is kept until D4 migrates them.
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
        // D0: only `lg` and `xl` are part of the system beyond Tailwind defaults.
        // `md` is kept because pages use `rounded-md` (58 occurrences) and the
        // custom value (0.5rem) differs from Tailwind's default (0.375rem);
        // removing it would change the preview. Migrate pages in D4.
        'md': '0.5rem',
        'lg': '0.625rem',
        'xl': '0.75rem',
      },
      boxShadow: {
        // D0: the only two custom shadows (hii-shadow-card / hii-shadow-elevated
        // in globals.css share these exact values). Kept under their utility
        // names `shadow-card` / `shadow-elevated` because pages reference them.
        'card': '0 1px 2px 0 rgb(0 0 0 / 0.03), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        'elevated': '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
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
