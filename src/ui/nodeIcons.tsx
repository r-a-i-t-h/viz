/** SVG glyphs shared by the state graph and watch column. */

/** Bent initial-state arrow (down, then in) with an open three-point tip. */
export function InitialArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M3.5 3 V8 c0 1.75 1.25 3 3 3 H13.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.35 9.2 13.1 11 8.35 12.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Classic UML final-state glyph: outer ring + filled inner circle. */
export function FinalStateIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="8" cy="8" r="3.25" fill="currentColor" />
    </svg>
  );
}

export function EntryIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        d="M3 3h6v2H5v6h4v2H3V3zm5 3h5v1.5L15 8l-2 1.5V11H8V6z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ExitIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        d="M3 3h6v2H5v6h4v2H3V3zm5 3h2.5V4.5L15 8l-4.5 3.5V10H8V6z"
        fill="currentColor"
      />
    </svg>
  );
}

export function AfterIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM7.25 4h1.5v4.1l2.4 1.4-.75 1.25L7.25 9V4z"
        fill="currentColor"
      />
    </svg>
  );
}
