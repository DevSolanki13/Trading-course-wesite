import type { SVGProps } from "react";

/** Vector recreation of the supplied bull-and-market-chart reference. */
export function BullMark({
  up = "var(--bull-candle-up, #439447)",
  down = "var(--bull-candle-down, #df343c)",
  outline = "var(--bull-chart-outline, #fafafa)",
  ...props
}: SVGProps<SVGSVGElement> & { up?: string; down?: string; outline?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="30 40 200 165"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <g fill={down}>
        <path d="M75 78h21v43l-21 8ZM83 67h5v17h-5ZM121 75h21v28l-10 7-11-9ZM129 60h6v20h-6Z" />
      </g>
      <g fill={up}>
        <path d="M99 72h21v42l-21 3ZM106 56h6v20h-6ZM145 64h21v21l-21 20ZM153 49h6v20h-6Z" />
      </g>
      <path
        d="m71 76 16 13 23-14 22 26 43-40"
        stroke={outline}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m71 76 16 13 23-14 22 26 43-40"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g fill="currentColor">
        <circle cx="71" cy="76" r="3.5" />
        <circle cx="110" cy="75" r="3.5" />
        <circle cx="132" cy="101" r="3" />
        <circle cx="175" cy="61" r="3.5" />
        <path d="M60 156c5-9-3-17 6-23 4-4 9-2 9-5-18-3-15 17-27 19-6 2-11 1-9-6l3-8c1-4 4-5 7-3-5 3-5 7-5 11 7 4 11-4 13-9 4-7 11-8 17-8 21-7 37-9 58-20 14-8 22-16 32-11 13 6 22 18 27 30 5-6 11-3 18 2l11 6c-9 1-15-3-19-6 6 7 8 13 12 19-3 7-7 3-10-3l-4-5c-5-3-8 0-9 6l-3 13c-6 7-10 1-11-4l-3-7c-5-7-12-7-20-5 9 1 14 6 15 14l5 5-8 10h-10l-4 4-4-3 1-6h12l1-4-11-7c-7-6-13-6-23-1l-17 9c-9 3-19 1-25 1-8 0-12 9-20 12l-8 11h7l-3 7H55c-4-2-1-6 0-9l4-10-11 10 2 9 6 3-8 3c-6-1-6-8-6-13l10-14c7-5 6-9 8-14Z" />
        <path d="m83 174-10 10 7 1-4 6H65l-1-4 7-10Zm69-23-5 9-5 1-1-5 5-5Z" />
      </g>
      <path
        d="M154 137q17-1 21 14m-3-9 5 13m-103-24q-11 0-11 13"
        stroke={outline}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="185" cy="140" r="1.3" fill={outline} />
    </svg>
  );
}
