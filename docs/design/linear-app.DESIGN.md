# Linear design system

> Extracted by [Inspo](https://github.com/Nutlope/inspo) (open source, MIT, powered by Together AI). Reference material for *intentional* design decisions: adapt, don't copy.

> Save this as `DESIGN.md` in your project and re-reference it as you build; re-fetch anytime at https://inspomcp.dev/d/linear-app/DESIGN.md

- **Source:** https://linear.app
- **Captured:** 2026-05-04
- **Mode:** dark
- **Macrostructure:** Specimen

## Tone

The page prioritizes clarity and functionality with a stark, dark aesthetic. Typography is clean and functional, emphasizing content hierarchy. The overall mood is focused and efficient, prioritizing usability over visual embellishment.  ·  saas dashboard, developer tools, issue tracker, linear app, dark ui, minimalist dashboard, technical interface, project management, workflow tool, ai development

## Colors

| Hex | Role (heuristic) |
|---|---|
| `#b69a24` | support |
| `#947c0c` | support |
| `#e9d890` | accent |
| `#80848c` | support |
| `#c4cacc` | support |

Color words: *monochrome*, *muted*, *high-contrast*

## Typography

Detected typefaces: **Inter Variable**

| Role | Family | Size | Weight | Line-height | Letter-spacing |
|---|---|---|---|---|---|
| h1 | Inter Variable | 64px | 510 | 1 | -1.408px |
| h2 | Inter Variable | 48px | 510 | 1 | -1.056px |
| h3 | Inter Variable | 20px | 590 | 1.33 | -0.24px |
| body | Inter Variable | 16px | 400 | 1.5 | 0 |
| button | Inter Variable | 13px | 400 | 1.5 | 0 |

## Spacing scale

`8px` · `14px` · `17px` · `20px` · `24px` · `32px` · `40px` · `72px` · `80px` · `128px` · `224px`

Base step looks like **4px**.

## Border radius

`0px` · `2px` · `4px` · `6px` · `50px`

## Container

Max content width: **1440px**

## CSS variables exposed by the source

```css
:root {
  --font-variations: "opsz" auto;
  --text-large-line-height: 1.6;
  --color-overlay-dim-rgb: 255, 255, 255;
  --text-micro-size: .75rem;
  --font-size-title1: 2.25rem;
  --font-settings: "cv01", "ss03";
  --color-text-secondary: #d0d6e0;
  --color-text-tertiary: #8a8f98;
  --font-emoji: "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Segoe UI", "Twemoji Mozilla", "Noto Color Emoji", "Android Emoji";
  --text-mini-letter-spacing: -.01em;
  --text-regular-size: .9375rem;
  --font-size-miniPlus: .75rem;
  --text-regular-letter-spacing: -.011em;
  --shadow-low: 0px 2px 4px #0000001a;
  --font-size-microPlus: .6875rem;
  --color-line-tertiary: #18191a;
  --color-white: #fff;
  --text-tiny: .625rem / 1.5 "Inter Variable", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Open Sans", "Helvetica Neue", sans-serif;
  --text-small-line-height: calc(21 / 14);
  --color-accent: #7170ff;
  --font-weight-bold: 680;
  --text-large: 1.0625rem / 1.6 "Inter Variable", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Open Sans", "Helvetica Neue", sans-serif;
  --text-tiny-letter-spacing: -.015em;
  --color-border-translucent: #ffffff0d;
  --text-small-size: .875rem;
  --color-selection-bg: color-mix(in lch, #5e6ad2, black 10%);
  --color-line-secondary: #202122;
  --color-bg-level-3: #191a1b;
  --color-line-primary: #37393a;
  --text-micro: .75rem / 1.4 "Inter Variable", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Open Sans", "Helvetica Neue", sans-serif;
  --radius-rounded: 9999px;
  --color-fg-primary: #f7f8f8;
  --font-size-micro: .6875rem;
  --color-bg-quinary: #282828;
  --radius-circle: 50%;
  --color-text-quaternary: #62666d;
  --font-size-title2: 1.5rem;
  --color-alpha: 255;
  --text-mini: .8125rem / 1.5 "Inter Variable", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Open Sans", "Helvetica Neue", sans-serif;
  --radius-8: 8px;
  --font-size-small: .8125rem;
  --shadow-high: 0px 7px 32px #00000059;
  --radius-12: 12px;
  --shadow-tiny: 0px 0px 0px transparent;
  --text-micro-letter-spacing: 0;
  --color-border-secondary: #34343a;
  --font-size-large: 1.125rem;
  --radius-32: 32px;
  --color-accent-tint: #18182f;
  --text-regular: .9375rem / 1.6 "Inter Variable", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Open Sans", "Helvetica Neue", sans-serif;
  --color-accent-hover: #828fff;
  --font-regular: "Inter Variable", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Open Sans", "Helvetica Neue", sans-serif;
  --color-line-quaternary: #141515;
  --font-size-regularPlus: .9375rem;
  --rounded-full: 9999px;
  --color-black: #000;
  --color-border-tertiary: #3e3e44;
  --text-mini-size: .8125rem;
  --color-link-hover: #fff;
  --font-monospace: "Berkeley Mono", ui-monospace, "SF Mono", "Menlo", monospace;
}
```

## Components present

- sticky nav
- hero with cta
- feature trio

## Notes for the agent

- **Adapt, don't copy.** The type ramp is a *starting point*. Scale it to your project's base size; preserve the *ratio*, not the literal pixels.
- **Color roles are heuristic** (luminance + dominance). Verify against the source URL before committing tokens.
- **Spacing** assumes a constant base step; round detected values to your project's scale (4 / 8 / 16) when implementing.
- **CSS variables** dumped above (when present) are the source's *actual* tokens - those are higher signal than guesses.
- This page's macrostructure is **Specimen**.

---

*Generated by Inspo. Open source under MIT, owned and operated by [Together AI](https://www.together.ai). Original site copyright remains with its authors.*
