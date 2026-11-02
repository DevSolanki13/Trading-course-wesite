# Homepage fonts

These are the original Latin WOFF2 subsets previously downloaded by `next/font/google` for the existing homepage: Caveat 500 normal, Newsreader 500 normal and Newsreader 500 italic. Keeping the same font bytes and fallback metrics preserves the existing typography while making builds independent of Google Fonts availability.

[home-page.tsx](../../pages/home-page.tsx) loads them through `next/font/local`, with preloading and `font-display: swap`. [hero-fonts.css](../../styles/hero-fonts.css) retains the original fallback metrics. Other site typography continues to use the existing Fontsource packages.

The fonts are distributed under their included SIL Open Font Licenses: [Caveat](./caveat-OFL.txt), [Newsreader](./newsreader-OFL.txt).
