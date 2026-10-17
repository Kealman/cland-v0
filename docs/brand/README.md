# cland brand

Decided with the human on 2026-10-17. Everything public is in English only.

## Words

- **Domain:** cland.app
- **One-liner** (GitHub description, README, link previews): One coding crew across every AI plan you pay for.
- **X bio:** Pool your Claude, ChatGPT and open-model plans into one coding crew. Frontier models lead, open models build, you decide.
- **X profile:** name `cland`, location `your terminal`, website `cland.app`.
- **Taglines**, kept for use where one fits:
  1. All your subscriptions. One team. (the X header)
  2. Turn your AIs into a team.
  3. Your subscriptions can do more.
  4. Assemble your AI crew.
  5. Get more from every plan you pay for. (the X header's second line)

The pitch behind them: cland makes several AI subscriptions work as one system. The load spreads across plans, and a strong model leads cheaper and open models that do the legwork.

## The logo

A lowercase c drawn as an open ring with an amber dot in its mouth. Amber is the workbench's colour for what needs the human. The wordmark carries the same dot in its c and is drawn from strokes (12 units on an 84-unit height, round caps), so it needs no font.

Colours come from the workbench (`docs/design/main-screen/README.md`): ground `#0b0e14`, text `#d6dbe4`, amber `#f0b429`; on light grounds text `#0b0e14` and amber `#c98a04`.

## Files

| File | Use |
| --- | --- |
| `src/mark-a.svg`, `src/favicon.svg` | The mark, transparent, for dark grounds |
| `src/avatar-a.svg`, `png/avatar-a.png` | Avatar, 400×400, dark ground |
| `src/lockup-a-dark.svg`, `src/lockup-a-light.svg` | The wordmark for README headers (`<picture>` with both themes) |
| `src/header.html`, `png/x-header-1500x500.png` | X header |
| `src/social.html`, `png/social-preview-1280x640.png` | GitHub social preview, link cards |
| `png/favicon-32.png`, `png/favicon-180.png`, `png/favicon-512.png` | Favicon, Apple touch icon, PWA icon |

SVG renders are made with `rsvg-convert`; the HTML sources are rendered with headless Chrome at their own size (`--window-size=W,H --screenshot`), JetBrains Mono from Google Fonts.
