/**
 * "Nocturne" theme preset — the color system from the owner's Claude Design canvas ("JP WebPortal.dc.html",
 * project "JIIT Campus App Design"). Ported from that canvas's own `colors()` function (dark and light
 * variants) into JPortal's existing theme-preset schema (`src/lib/theme.js` `applyTheme`), so it slots in as
 * a real, selectable preset alongside the CDN-fetched ones rather than a one-off hardcoded reskin.
 *
 * `applyTheme` sets each key as a bare `--key` CSS custom property and Tailwind wraps color tokens as
 * `hsl(var(--key))` (see tailwind.config.js) — every color value here must therefore be a solid hex (or an
 * HSL/OKLCH string), never `rgba(...)`. The design's `textMuted`/`divider` tokens are translucent overlays on
 * the app background, so they are pre-flattened to solid hex here (composited over that mode's `bg`), not
 * copied as rgba.
 *
 * Buttons/rings map `primary` to the design's `accent` purple so the app's existing solid-fill Button
 * component (`bg-primary text-primary-foreground`) picks up the brand color everywhere automatically. The
 * design's own buttons are actually outline/ghost style (transparent fill, accent border+text) — matching
 * that exactly would mean restyling the shared Button component's default variant, which affects every
 * button in the whole app; left as a deliberate follow-up rather than risked here unverified.
 */

const FONT_SANS =
  "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const dark = {
  background: '#161826',
  foreground: '#e9e9ed',
  card: '#232532',
  'card-foreground': '#e9e9ed',
  popover: '#232532',
  'popover-foreground': '#e9e9ed',
  primary: '#9184d9',
  'primary-foreground': '#1a1730',
  secondary: '#2a2c3d',
  'secondary-foreground': '#e9e9ed',
  muted: '#2a2c3d',
  'muted-foreground': '#9a9aa1', // flattened rgba(233,233,237,.62) over #161826
  accent: '#3a3660', // a subtle tinted surface for hover/active states, distinct from the primary accent color
  'accent-foreground': '#c3bcf0',
  destructive: '#ef8f8f',
  'destructive-foreground': '#3a1010',
  border: '#383946', // flattened rgba(233,233,237,.16) over #161826
  input: '#383946',
  ring: '#9184d9',
  'chart-1': '#7dd6a0', // safe
  'chart-2': '#7fb8e8', // blue
  'chart-3': '#f0c369', // warning
  'chart-4': '#9184d9', // accent
  'chart-5': '#ef8f8f', // critical
  radius: '0.75rem',
  'font-sans': FONT_SANS,
  sidebar: '#1c1e2c',
  'sidebar-foreground': '#e9e9ed',
  'sidebar-primary': '#9184d9',
  'sidebar-primary-foreground': '#1a1730',
  'sidebar-accent': '#2a2c3d',
  'sidebar-accent-foreground': '#c3bcf0',
  'sidebar-border': '#383946',
  'sidebar-ring': '#9184d9',
};

const light = {
  background: '#f3f5fe',
  foreground: '#20222d',
  card: '#ffffff',
  'card-foreground': '#20222d',
  popover: '#ffffff',
  'popover-foreground': '#20222d',
  primary: '#9184d9',
  'primary-foreground': '#ffffff',
  secondary: '#e7e5fe',
  'secondary-foreground': '#20222d',
  muted: '#e4e7f5',
  'muted-foreground': '#70727c', // flattened rgba(32,34,45,.62) over #f3f5fe
  accent: '#e7e5fe',
  'accent-foreground': '#5d5294',
  destructive: '#b23b3b',
  'destructive-foreground': '#ffffff',
  border: '#d8dae3', // flattened rgba(32,34,45,.13) over #f3f5fe
  input: '#d8dae3',
  ring: '#9184d9',
  'chart-1': '#1f7a4c', // safe
  'chart-2': '#2f6fa8', // blue
  'chart-3': '#8a5a00', // warning
  'chart-4': '#9184d9', // accent
  'chart-5': '#b23b3b', // critical
  radius: '0.75rem',
  'font-sans': FONT_SANS,
  sidebar: '#ffffff',
  'sidebar-foreground': '#20222d',
  'sidebar-primary': '#9184d9',
  'sidebar-primary-foreground': '#ffffff',
  'sidebar-accent': '#e7e5fe',
  'sidebar-accent-foreground': '#5d5294',
  'sidebar-border': '#d8dae3',
  'sidebar-ring': '#9184d9',
};

export const NOCTURNE_PRESET = {
  id: 'nocturne',
  name: 'Nocturne',
  category: 'dark',
  mode: 'dark',
  styles: { dark, light },
};
