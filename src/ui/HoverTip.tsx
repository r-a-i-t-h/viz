import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type HoverTipItem = {
  label: string;
  /** Dep-graph entity id (`action:…` / `guard:…`) for reverse key highlight. */
  entityId?: string;
};

interface HoverTipProps {
  label: string;
  items: Array<string | HoverTipItem>;
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
  /**
   * Fired when the tip highlights a dep-graph entity: union of all item
   * entity ids while the tip is open, or a single id while hovering a row.
   */
  onEntityHover?: (entityIds: string[]) => void;
}

const VIEW_MARGIN = 8;
const GAP = 8;
/** Allow moving from trigger into the portaled popup across the gap. */
const CLOSE_DELAY_MS = 120;

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
  onEntityHover,
}: HoverTipProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLSpanElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onEntityHoverRef = useRef(onEntityHover);
  onEntityHoverRef.current = onEntityHover;
  const onActiveChangeRef = useRef(onActiveChange);
  onActiveChangeRef.current = onActiveChange;

  const [active, setActive] = useState(false);
  const [hoveredItemIndex, setHoveredItemIndex] = useState<number | null>(null);

  const normalized = items.map(normalizeItem);
  const interactive =
    onEntityHover != null &&
    normalized.some((item) => item.entityId != null && item.entityId.length > 0);

  const emitEntities = useCallback((index: number | null, isActive: boolean) => {
    const emit = onEntityHoverRef.current;
    if (!emit) return;
    if (!isActive) {
      emit([]);
      return;
    }
    const current = itemsRef.current.map(normalizeItem);
    if (index != null) {
      const id = current[index]?.entityId;
      emit(id ? [id] : []);
      return;
    }
    emit(
      current
        .map((item) => item.entityId)
        .filter((id): id is string => id != null && id.length > 0),
    );
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current == null) return;
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const open = useCallback(() => {
    clearCloseTimer();
    setActive((prev) => {
      if (!prev) {
        onActiveChangeRef.current?.(true);
        emitEntities(null, true);
      }
      return true;
    });
  }, [clearCloseTimer, emitEntities]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setActive(false);
      setHoveredItemIndex(null);
      onActiveChangeRef.current?.(false);
      emitEntities(null, false);
    }, CLOSE_DELAY_MS);
  }, [clearCloseTimer, emitEntities]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  const hoverItem = useCallback(
    (index: number | null) => {
      setHoveredItemIndex(index);
      emitEntities(index, true);
    },
    [emitEntities],
  );

  const reposition = useCallback(() => {
    const trigger = rootRef.current;
    const popup = popupRef.current;
    if (!trigger || !popup || normalized.length === 0) return;

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
  }, [align, normalized.length, placement]);

  useLayoutEffect(() => {
    if (!active || normalized.length === 0) return;
    reposition();
  }, [active, normalized, reposition]);

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
    active && normalized.length > 0
      ? createPortal(
          <span
            ref={popupRef}
            className={[
              'hover-tip__popup',
              'hover-tip__popup--open',
              interactive ? 'hover-tip__popup--interactive' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            role="tooltip"
            onMouseEnter={open}
            onMouseLeave={scheduleClose}
          >
            <span className="hover-tip__title">{label}</span>
            <ul className="hover-tip__list">
              {normalized.map((item, index) => {
                const linked = interactive && item.entityId != null;
                return (
                  <li
                    key={`${index}-${item.label}`}
                    className={
                      linked
                        ? hoveredItemIndex === index
                          ? 'hover-tip__item hover-tip__item--active'
                          : 'hover-tip__item hover-tip__item--linked'
                        : undefined
                    }
                    onMouseEnter={linked ? () => hoverItem(index) : undefined}
                    onMouseLeave={linked ? () => hoverItem(null) : undefined}
                  >
                    {item.label}
                  </li>
                );
              })}
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
      onMouseEnter={open}
      onMouseLeave={scheduleClose}
      onFocus={open}
      onBlur={scheduleClose}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
      {popup}
    </span>
  );
}

function normalizeItem(item: string | HoverTipItem): HoverTipItem {
  return typeof item === 'string' ? { label: item } : item;
}
