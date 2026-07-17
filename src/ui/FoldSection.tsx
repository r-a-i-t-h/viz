import { useState, type ReactNode } from 'react';
import { DisclosureChevron } from './DisclosureChevron';

/** Title + disclosure arrow; collapses body in place (no extra chrome). */
export function FoldSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="viz__fold">
      <button
        type="button"
        className="viz__fold-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="viz__fold-disclosure" aria-hidden="true">
          <DisclosureChevron open={open} />
        </span>
        <h3 className="viz__fold-title">{title}</h3>
      </button>
      {open && <div className="viz__fold-body">{children}</div>}
    </section>
  );
}
