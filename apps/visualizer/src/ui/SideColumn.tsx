import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { clampColumnWidth, COLLAPSED_COLUMN_WIDTH } from './columnLayout';

/**
 * Shell for a left (start) or right (end) side column. Collapse/expand and
 * resize live on a shared divider facing the center panel.
 */
export function SideColumn({
  edge,
  title,
  open,
  width,
  onToggle,
  onWidthChange,
  className,
  children,
}: {
  /** Watch sits on the start (left); current state on the end (right). */
  edge: 'start' | 'end';
  /** Optional column heading; omit when the body supplies its own titles. */
  title?: string;
  open: boolean;
  /** Expanded width in px (ignored while collapsed). */
  width: number;
  onToggle: () => void;
  onWidthChange: (width: number) => void;
  className?: string;
  children: ReactNode;
}) {
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  /** Arrow points toward the direction the panel will move when toggled. */
  const arrowPoints: 'left' | 'right' =
    edge === 'start' ? (open ? 'left' : 'right') : open ? 'right' : 'left';

  const collapseLabel =
    edge === 'start'
      ? open
        ? 'Collapse watched column'
        : 'Expand watched column'
      : open
        ? 'Collapse current state column'
        : 'Expand current state column';

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const delta =
        edge === 'start'
          ? event.clientX - drag.startX
          : drag.startX - event.clientX;
      onWidthChange(clampColumnWidth(drag.startWidth + delta));
    },
    [edge, onWidthChange],
  );

  const endDrag = useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      document.body.classList.remove('viz--resizing');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    },
    [onPointerMove],
  );

  const onResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!open) return;
    // Ignore presses that started on the toggle button.
    if ((event.target as HTMLElement).closest('.viz__divider-toggle')) return;
    event.preventDefault();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: width,
    };
    document.body.classList.add('viz--resizing');
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  };

  useEffect(() => {
    return () => {
      document.body.classList.remove('viz--resizing');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [endDrag, onPointerMove]);

  return (
    <aside
      className={[
        'viz__panel',
        'viz__column',
        open ? 'viz__column--open' : 'viz__column--collapsed',
        `viz__column--${edge}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        width: open ? width : COLLAPSED_COLUMN_WIDTH,
        flexBasis: open ? width : COLLAPSED_COLUMN_WIDTH,
      }}
    >
      {open && (
        <>
          {title ? (
            <div className="viz__panel-heading">
              <h3>{title}</h3>
            </div>
          ) : null}
          <div className="viz__column-body">{children}</div>
        </>
      )}

      <div
        className={[
          'viz__divider',
          edge === 'start' ? 'viz__divider--after' : 'viz__divider--before',
          open ? 'viz__divider--resizable' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onPointerDown={onResizePointerDown}
        role={open ? 'separator' : undefined}
        aria-orientation={open ? 'vertical' : undefined}
        aria-label={
          open
            ? `Resize ${title ? title.toLowerCase() : edge} column`
            : undefined
        }
        aria-valuenow={open ? width : undefined}
      >
        <button
          type="button"
          className="viz__divider-toggle"
          onClick={onToggle}
          onPointerDown={(event) => event.stopPropagation()}
          aria-expanded={open}
          aria-label={collapseLabel}
          title={collapseLabel}
        >
          <TriangleArrow points={arrowPoints} />
        </button>
      </div>
    </aside>
  );
}

function TriangleArrow({ points }: { points: 'left' | 'right' }) {
  const d =
    points === 'left'
      ? 'M10.5 3.25 4.25 8l6.25 4.75V3.25z'
      : 'M5.5 3.25 11.75 8 5.5 12.75V3.25z';
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d={d} fill="currentColor" />
    </svg>
  );
}
