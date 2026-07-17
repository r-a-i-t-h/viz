/** Shared solid triangle for fold/disclosure toggles. */
export function DisclosureChevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true">
      <path
        d={
          open
            ? 'M3.5 5.5 8 11.25 12.5 5.5H3.5z'
            : 'M5.5 3.5 11.25 8 5.5 12.5V3.5z'
        }
        fill="currentColor"
      />
    </svg>
  );
}
