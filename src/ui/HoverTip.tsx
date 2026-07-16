import type { ReactNode } from 'react';

interface HoverTipProps {
  label: string;
  items: string[];
  children: ReactNode;
  /** Extra class on the trigger wrapper (e.g. badge colour). */
  className?: string;
  /** Prefer popup below (default) or above the trigger. */
  placement?: 'below' | 'above';
}

/**
 * CSS-hover popup with a titled bullet list. Keeps the visualizer free of
 * focus-trap / portal complexity — suitable for dense tree overlays.
 */
export function HoverTip({
  label,
  items,
  children,
  className,
  placement = 'below',
}: HoverTipProps) {
  if (items.length === 0) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span
      className={['hover-tip', className].filter(Boolean).join(' ')}
      tabIndex={0}
    >
      {children}
      <span
        className={`hover-tip__popup hover-tip__popup--${placement}`}
        role="tooltip"
      >
        <span className="hover-tip__title">{label}</span>
        <ul className="hover-tip__list">
          {items.map((item, index) => (
            <li key={`${index}-${item}`}>{item}</li>
          ))}
        </ul>
      </span>
    </span>
  );
}
