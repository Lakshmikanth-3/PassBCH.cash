# Vercel design system

> Extracted by [Inspo](https://github.com/Nutlope/inspo) (open source, MIT, powered by Together AI). Reference material for *intentional* design decisions: adapt, don't copy.

> Save this as `DESIGN.md` in your project and re-reference it as you build; re-fetch anytime at https://inspomcp.dev/d/vercel-com/DESIGN.md

- **Source:** https://vercel.com
- **Captured:** 2026-05-01
- **Mode:** light
- **Macrostructure:** Marquee Hero

## Tone

The page uses a gradient background and a bold, centered headline to immediately communicate the core offering. The overall aesthetic is clean and modern, prioritizing clarity and a sense of technological advancement.  ·  ai cloud, developer platform, vercel homepage, saas ai, cloud infrastructure, build deploy, ai platform, modern web, developer tools

## Colors

| Hex | Role (heuristic) |
|---|---|
| `#ecbc35` | support |
| `#795c0b` | support |
| `#7cfcd4` | accent |
| `#a0966e` | support |
| `#a6b9c1` | muted |

Color words: *pastel*, *muted*, *neon*

## Typography

Detected typefaces: **GeistSans**

| Role | Family | Size | Weight | Line-height | Letter-spacing |
|---|---|---|---|---|---|
| h1 | GeistSans | 64px | 400 | 1 | -3.84px |
| h2 | GeistSans | 56px | 450 | 1 | -3.36px |
| h3 | GeistSans | 14px | 500 | 1.43 | 0 |
| body | GeistSans | 16px | 400 | 1.5 | 0 |
| button | GeistSans | 14px | 400 | 1.43 | 0 |

## Spacing scale

`4px` · `6px` · `8px` · `16px` · `20px` · `32px` · `40px` · `80px` · `208px`

Base step looks like **4px**.

## Border radius

`0px` · `4px` · `6px` · `8px`

## Container

Max content width: **1440px**

## CSS variables exposed by the source

```css
:root {
  --text-base--line-height: calc(1.5 / 1);
  --color-gray-300: hsla(0, 0%, 90%, 1);
  --font-mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Liberation Mono, DejaVu Sans Mono, Courier New, monospace, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol;
  --color-gray-500: hsla(0, 0%, 79%, 1);
  --text-fluid-24-32: clamp(1.5rem, .6429rem + 1.4286vi, 2rem);
  --accents-3: #999;
  --text-fluid-24-28: clamp(1.5rem, 1.0714rem + .7143vi, 1.75rem);
  --text-fluid-16-28: clamp(1rem, -.2857rem + 2.1429vi, 1.75rem);
  --spacing-fluid-24-40: clamp(1.5rem, -.2143rem + 2.8571vi, 2.5rem);
  --accents-8: #111;
  --color-zinc-900: lab(8.30603% .618205 -2.16572);
  --accents-2: #eaeaea;
  --text-8xl: 6rem;
  --text-sm: .875rem;
  --color-gray-950: lab(1.90334% .278696 -5.48866);
  --spacing-fluid-16-24: clamp(1rem, .1429rem + 1.4286vi, 1.5rem);
  --font-weight-thin: 100;
  --color-violet-50: lab(96.2416% 2.28849 -5.51657);
  --text-fluid-14-24: clamp(.875rem, -.1964rem + 1.7857vi, 1.5rem);
  --shadow-sticky: 0 12px 10px -10px #0000001f;
  --text-lg: 1.125rem;
  --text-8xl--line-height: 1;
  --shadow-large: 0 30px 60px #0000001f;
  --text-fluid-18-24: clamp(1.125rem, .4821rem + 1.0714vi, 1.5rem);
  --accents-4: #888;
  --color-violet-700: lab(35.2783% 67.9912 -88.793);
  --shadow-medium: 0 8px 30px #0000001f;
  --color-background-100: hsla(0, 0%, 100%, 1);
  --text-fluid-14-20: clamp(.875rem, .2321rem + 1.0714vi, 1.25rem);
  --color-violet-100: lab(93.0838% 4.35197 -9.88284);
  --color-gray-900: hsla(0, 0%, 30%, 1);
  --color-gray-700: hsla(0, 0%, 56%, 1);
  --font-weight-extrabold: 800;
  --text-sm--line-height: calc(1.25 / .875);
  --text-3xl--line-height: calc(2.25 / 1.875);
  --text-3xl: 1.875rem;
  --text-xs: .75rem;
  --font-weight-medium: 500;
  --font-weight-normal: 400;
  --font-sans-fallback: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
  --shadow-hover: 0 30px 60px #0000001f;
  --color-yellow-500: lab(76.3898% 14.5258 98.4589);
  --text-base: 1rem;
  --color-zinc-100: lab(96.1634% .0993311 -.364041);
  --color-slate-500: lab(48.0876% -2.03595 -16.5814);
  --accents-6: #444;
  --color-slate-300: lab(84.7652% -1.94535 -7.93337);
  --text-fluid-32-64: clamp(2rem, -1.4286rem + 5.7143vi, 4rem);
  --text-fluid-64-128: clamp(4rem, -2.8571rem + 11.4286vi, 8rem);
  --text-fluid-20-28: clamp(1.25rem, .3929rem + 1.4286vi, 1.75rem);
  --font-weight-bold: 700;
  --text-xs--line-height: calc(1 / .75);
  --color-neutral-700: lab(27.036% 0 0);
  --text-fluid-20-32: clamp(1.25rem, -.0357rem + 2.1429vi, 2rem);
  --text-xl: 1.25rem;
  --text-2xl--line-height: calc(2 / 1.5);
  --spacing: .25rem;
  --color-gray-alpha-400: #00000014;
  --shadow-smallest: 0px 2px 4px #0000001a;
  --text-xl--line-height: calc(1.75 / 1.25);
}
```

## Components present

- hero fullbleed
- logo cloud
- hero with cta

## Notes for the agent

- **Adapt, don't copy.** The type ramp is a *starting point*. Scale it to your project's base size; preserve the *ratio*, not the literal pixels.
- **Color roles are heuristic** (luminance + dominance). Verify against the source URL before committing tokens.
- **Spacing** assumes a constant base step; round detected values to your project's scale (4 / 8 / 16) when implementing.
- **CSS variables** dumped above (when present) are the source's *actual* tokens - those are higher signal than guesses.
- This page's macrostructure is **Marquee Hero**.

---

*Generated by Inspo. Open source under MIT, owned and operated by [Together AI](https://www.together.ai). Original site copyright remains with its authors.*
