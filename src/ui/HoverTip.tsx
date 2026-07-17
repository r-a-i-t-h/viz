import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

interface HoverTipProps {
  label: string;
  items: string[];
  children: ReactNode;
  /** Extra class on the trigger wrapper (e.g. badge colour). */
  className?: string;
  /** Prefer popup below (default) or above the trigger. */
  placement?: 'below' | 'above';
  /**
   * Horizontal anchoring preference. 'right' aligns popup's right to the
   * trigger's right; 'left' aligns left edges; 'center' centers on trigger.
   * Final position is clamped so the popup stays in the viewport.
   */
  align?: 'left' | 'center' | 'right';
  /** Reports hover/focus state even when there is no popup content. */
  onActiveChange?: (active: boolean) => void;
}

const VIEW_MARGIN = 8;
const GAP = 8;

/**
 * Hover/focus popup with a titled bullet list. Portaled to `document.body`
 * with `position: fixed` so ancestor `transform` (e.g. badge clusters) does
 * not shift viewport coordinates, then clamped to stay on screen.
 */
export function HoverTip({
  label,
  items,
  children,
  className,
  placement = 'below',
  align = 'center',
  onActiveChange,
}: HoverTipProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);

  const setActiveState = useCallback(
    (next: boolean) => {
      setActive(next);
      onActiveChange?.(next);
    },
    [onActiveChange],
  );

  const reposition = useCallback(() => {
    const trigger = rootRef.current;
    const popup = popupRef.current;
    if (!trigger || !popup || items.length === 0) return;

    const triggerRect = trigger.getBoundingClientRect();
    // Measure while on-screen but invisible so height/width are accurate.
    popup.style.visibility = 'hidden';
    popup.style.opacity = '0';
    popup.style.top = '0px';
    popup.style.left = '0px';

    const pw = popup.offsetWidth;
    const ph = popup.offsetHeight;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    const spaceBelow = viewH - triggerRect.bottom - VIEW_MARGIN;
    const spaceAbove = triggerRect.top - VIEW_MARGIN;

    let placeBelow = placement === 'below';
    if (placeBelow && ph + GAP > spaceBelow && spaceAbove > spaceBelow) {
      placeBelow = false;
    } else if (!placeBelow && ph + GAP > spaceAbove && spaceBelow >= spaceAbove) {
      placeBelow = true;
    }

    let top = placeBelow
      ? triggerRect.bottom + GAP
      : triggerRect.top - GAP - ph;

    top = Math.min(Math.max(top, VIEW_MARGIN), Math.max(VIEW_MARGIN, viewH - VIEW_MARGIN - ph));

    let left =
      align === 'right'
        ? triggerRect.right - pw
        : align === 'left'
          ? triggerRect.left
          : triggerRect.left + triggerRect.width / 2 - pw / 2;

    left = Math.min(
      Math.max(left, VIEW_MARGIN),
      Math.max(VIEW_MARGIN, viewW - VIEW_MARGIN - pw),
    );

    popup.style.top = `${Math.round(top)}px`;
    popup.style.left = `${Math.round(left)}px`;
    popup.style.visibility = '';
    popup.style.opacity = '';
  }, [align, items.length, placement]);

  useLayoutEffect(() => {
    if (!active || items.length === 0) return;
    reposition();
  }, [active, items, reposition]);

  useEffect(() => {
    if (!active) return;
    const onScrollOrResize = () => reposition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [active, reposition]);

  const popup =
    active && items.length > 0
      ? createPortal(
          <span
            ref={popupRef}
            className="hover-tip__popup hover-tip__popup--open"
            role="tooltip"
          >
            <span className="hover-tip__title">{label}</span>
            <ul className="hover-tip__list">
              {items.map((item, index) => (
                <li key={`${index}-${item}`}>{item}</li>
              ))}
            </ul>
          </span>,
          document.body,
        )
      : null;

  return (
    <span
      ref={rootRef}
      className={['hover-tip', className].filter(Boolean).join(' ')}
      tabIndex={0}
      onMouseEnter={() => setActiveState(true)}
      onMouseLeave={() => setActiveState(false)}
      onFocus={() => setActiveState(true)}
      onBlur={() => setActiveState(false)}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
      {popup}
    </span>
  );
}
