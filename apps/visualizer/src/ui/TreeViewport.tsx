import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  IDENTITY_VIEWPORT,
  panViewport,
  type GraphViewportTransform,
  viewportTransformStyle,
  zoomFactorFromWheelDelta,
  zoomViewportAt,
} from './viewportTransform';

type PanCursor = 'default' | 'grab' | 'grabbing';

/**
 * Scrollable/scalable shell around the state graph.
 *
 * - Two-finger trackpad scroll → pan
 * - Pinch (ctrl+wheel on Chromium/Firefox; Safari GestureEvent) or
 *   Ctrl/Cmd+scroll → pure scale zoom
 * - Space + drag or right-button drag → pan
 * - Escape (via parent resetKey) → reset pan/scale to origin
 *
 * Independent of node neighborhood zoom (`zoom.ts`).
 */
export function TreeViewport({
  children,
  /** Reset pan/scale when this key changes (actor switch, Escape, etc.). */
  resetKey,
}: {
  children: ReactNode;
  resetKey?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const gestureScaleRef = useRef(1);
  const spacePressedRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
  } | null>(null);
  const [panCursor, setPanCursor] = useState<PanCursor>('default');
  const [transform, setTransform] =
    useState<GraphViewportTransform>(IDENTITY_VIEWPORT);

  useEffect(() => {
    const el = viewportRef.current;
    const drag = dragRef.current;
    if (drag && el?.hasPointerCapture(drag.pointerId)) {
      el.releasePointerCapture(drag.pointerId);
    }
    dragRef.current = null;
    gestureScaleRef.current = 1;
    setPanCursor(spacePressedRef.current ? 'grab' : 'default');
    setTransform(IDENTITY_VIEWPORT);
  }, [resetKey]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.isContentEditable ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      );
    };

    const syncPanCursor = () => {
      if (dragRef.current) {
        setPanCursor('grabbing');
        return;
      }
      setPanCursor(spacePressedRef.current ? 'grab' : 'default');
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || isEditableTarget(event.target)) {
        return;
      }
      event.preventDefault();
      spacePressedRef.current = true;
      syncPanCursor();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      spacePressedRef.current = false;
      syncPanCursor();
    };

    const onBlur = () => {
      spacePressedRef.current = false;
      syncPanCursor();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const endDrag = (pointerId: number) => {
      if (dragRef.current?.pointerId !== pointerId) return;
      dragRef.current = null;
      setPanCursor(spacePressedRef.current ? 'grab' : 'default');
    };

    const onPointerDown = (event: PointerEvent) => {
      const spacePan = spacePressedRef.current && event.button === 0;
      const rightPan = event.button === 2;
      if (!spacePan && !rightPan) return;

      event.preventDefault();
      event.stopPropagation();

      dragRef.current = {
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY,
      };
      setPanCursor('grabbing');
      el.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - drag.lastX;
      const deltaY = event.clientY - drag.lastY;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;

      setTransform((current) => panViewport(current, -deltaX, -deltaY));
    };

    const onPointerUp = (event: PointerEvent) => {
      if (dragRef.current?.pointerId !== event.pointerId) return;
      endDrag(event.pointerId);
      if (el.hasPointerCapture(event.pointerId)) {
        el.releasePointerCapture(event.pointerId);
      }
    };

    const onContextMenu = (event: Event) => {
      event.preventDefault();
    };

    const onWheel = (event: WheelEvent) => {
      const { deltaX, deltaY } = normalizedWheelDeltas(event);

      // Pinch-zoom and Ctrl/Cmd+scroll → scale. Plain two-finger scroll → pan.
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        event.stopPropagation();
        const rect = el.getBoundingClientRect();
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;
        const factor = zoomFactorFromWheelDelta(deltaY);
        setTransform((current) =>
          zoomViewportAt(current, pointerX, pointerY, factor),
        );
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setTransform((current) => panViewport(current, deltaX, deltaY));
    };

    // Safari trackpad pinch (GestureEvent).
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      gestureScaleRef.current = 1;
    };

    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const gesture = event as Event & {
        scale?: number;
        clientX?: number;
        clientY?: number;
      };
      if (typeof gesture.scale !== 'number' || !Number.isFinite(gesture.scale)) {
        return;
      }
      const rect = el.getBoundingClientRect();
      const pointerX =
        typeof gesture.clientX === 'number'
          ? gesture.clientX - rect.left
          : rect.width / 2;
      const pointerY =
        typeof gesture.clientY === 'number'
          ? gesture.clientY - rect.top
          : rect.height / 2;
      const prev = gestureScaleRef.current || 1;
      const factor = gesture.scale / prev;
      gestureScaleRef.current = gesture.scale;
      setTransform((current) =>
        zoomViewportAt(current, pointerX, pointerY, factor),
      );
    };

    el.addEventListener('pointerdown', onPointerDown, { capture: true });
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('contextmenu', onContextMenu);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart, { passive: false });
    el.addEventListener('gesturechange', onGestureChange, { passive: false });

    return () => {
      el.removeEventListener('pointerdown', onPointerDown, { capture: true });
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('contextmenu', onContextMenu);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
    };
  }, []);

  const scrollClass =
    panCursor === 'grabbing'
      ? 'viz__tree-scroll--panning'
      : panCursor === 'grab'
        ? 'viz__tree-scroll--pan-ready'
        : '';

  return (
    <div
      ref={viewportRef}
      className={`viz__tree-scroll${scrollClass ? ` ${scrollClass}` : ''}`}
    >
      <div
        className="viz__tree-canvas"
        style={{ transform: viewportTransformStyle(transform) }}
      >
        {children}
      </div>
    </div>
  );
}

/** Normalize wheel deltas to approximate CSS pixels. */
function normalizedWheelDeltas(event: WheelEvent): {
  deltaX: number;
  deltaY: number;
} {
  let { deltaX, deltaY } = event;
  if (event.deltaMode === 1) {
    // Lines
    deltaX *= 16;
    deltaY *= 16;
  } else if (event.deltaMode === 2) {
    // Pages
    deltaX *= 800;
    deltaY *= 800;
  }
  return { deltaX, deltaY };
}
