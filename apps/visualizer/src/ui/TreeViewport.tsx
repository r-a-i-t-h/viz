import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  IDENTITY_VIEWPORT,
  panViewport,
  type GraphViewportTransform,
  viewportTransformStyle,
  zoomFactorFromWheelDelta,
  zoomViewportAt,
} from './viewportTransform';

/**
 * Scrollable/scalable shell around the state graph.
 *
 * - Two-finger trackpad scroll → pan
 * - Pinch (ctrl+wheel on Chromium/Firefox; Safari GestureEvent) or
 *   Ctrl/Cmd+scroll → pure scale zoom
 *
 * Independent of node neighborhood zoom (`zoom.ts`).
 */
export function TreeViewport({
  children,
  /** Reset pan/scale when this key changes (e.g. selected actor session). */
  resetKey,
}: {
  children: ReactNode;
  resetKey?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const gestureScaleRef = useRef(1);
  const [transform, setTransform] =
    useState<GraphViewportTransform>(IDENTITY_VIEWPORT);

  useEffect(() => {
    setTransform(IDENTITY_VIEWPORT);
  }, [resetKey]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

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

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart, { passive: false });
    el.addEventListener('gesturechange', onGestureChange, { passive: false });

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
    };
  }, []);

  return (
    <div ref={viewportRef} className="viz__tree-scroll">
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
