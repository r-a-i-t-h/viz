import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createActor } from 'xstate';
import {
  createVisualizerHost,
  type HostBridgeStatus,
  type VisualizerHost,
  type VisualizerSnapshot,
} from '../viz';
import { blinkerMachine, demoMachine, wideParallelMachine } from '../machine';
import './host.css';

// Lazy: visualizer.css is only fetched when inline viz is shown.
const VisualizerView = lazy(() =>
  import('./VisualizerView').then((m) => ({ default: m.VisualizerView })),
);

type ActorEvent = Parameters<
  ReturnType<typeof createActor<typeof demoMachine>>['send']
>[0];

const SEND_BUTTONS: { label: string; event: ActorEvent }[] = [
  { label: 'START', event: { type: 'START' } },
  { label: 'READY', event: { type: 'READY' } },
  { label: 'CHECK', event: { type: 'CHECK' } },
  { label: 'ARM', event: { type: 'ARM' } },
  { label: 'FETCH', event: { type: 'FETCH' } },
  { label: 'TICK', event: { type: 'TICK' } },
  { label: 'NUDGE', event: { type: 'NUDGE' } },
  { label: 'PAUSE', event: { type: 'PAUSE' } },
  { label: 'RESUME', event: { type: 'RESUME' } },
  { label: 'CYCLE', event: { type: 'CYCLE' } },
  { label: 'TOGGLE_MODE', event: { type: 'TOGGLE_MODE' } },
  { label: 'RESTORE', event: { type: 'RESTORE' } },
  { label: 'STOP', event: { type: 'STOP' } },
  { label: 'DONE', event: { type: 'DONE' } },
];

const POPUP_LABEL: Record<HostBridgeStatus, string> = {
  idle: 'popup closed',
  opening: 'opening…',
  'awaiting-hello': 'awaiting hello…',
  connected: 'popup connected',
  blocked: 'popup blocked',
};

declare global {
  interface Window {
    /**
     * PoC global: call from the console without React buttons.
     * @example viz.openPopup(); viz.showInline(); viz.hideInline();
     */
    viz?: VisualizerHost;
  }
}

/**
 * PoC shell. Machine + visualizer are driven by {@link createVisualizerHost};
 * React only renders state and forwards clicks to the API (same as `window.viz`).
 */
export default function HostApp() {
  const actorRef = useRef<ReturnType<
    typeof createActor<typeof demoMachine>
  > | null>(null);
  const [host, setHost] = useState<VisualizerHost | null>(null);
  const [snapshot, setSnapshot] = useState<VisualizerSnapshot | null>(null);

  useEffect(() => {
    const visualizerUrl = new URL('visualizer.html', window.location.href).href;
    const viz = createVisualizerHost({ visualizerUrl });
    window.viz = viz;
    setHost(viz);

    const unsub = viz.subscribe(setSnapshot);

    const actor = createActor(demoMachine, { inspect: viz.inspect });
    actorRef.current = actor;
    actor.start();

    // Extra top-level actors: same inspect hook. Each @xstate.actor event is
    // enough for the viz to pick them up and list them in the actor dropdown.
    const blinker = createActor(blinkerMachine, { inspect: viz.inspect });
    blinker.start();

    const wide = createActor(wideParallelMachine, { inspect: viz.inspect });
    wide.start();

    return () => {
      unsub();
      actor.stop();
      blinker.stop();
      wide.stop();
      viz.dispose();
      actorRef.current = null;
      if (window.viz === viz) delete window.viz;
    };
  }, []);

  const popupOpen =
    snapshot?.popupStatus === 'opening' ||
    snapshot?.popupStatus === 'awaiting-hello' ||
    snapshot?.popupStatus === 'connected';

  return (
    <div className="poc">
      <header>
        <div className="poc__title-row">
          <h1>Machine host</h1>
          <span
            className={`poc__status ${snapshot?.inlineVisible ? 'poc__status--on' : ''}`}
          >
            inline {snapshot?.inlineVisible ? 'on' : 'off'}
          </span>
          <span
            className={`poc__status poc__status--${snapshot?.popupStatus ?? 'idle'}`}
          >
            {POPUP_LABEL[snapshot?.popupStatus ?? 'idle']}
          </span>
        </div>
        <p className="poc__lead">
          PoC UI only. Real hosts use the <code>viz</code> API with no React
          visualizer (popup only).
        </p>
        <p className="poc__api">
          Console: <code>viz.openPopup()</code>, <code>viz.showInline()</code>,{' '}
          <code>viz.hideInline()</code>, <code>viz.toggleInline()</code>
        </p>
      </header>

      <section className="poc__controls">
        <button
          type="button"
          className="poc__api-btn"
          onClick={() => host?.toggleInline()}
        >
          {snapshot?.inlineVisible
            ? 'Hide inline visualizer'
            : 'Show inline visualizer'}
        </button>
        <button
          type="button"
          className="poc__api-btn"
          onClick={() => host?.openPopup()}
          disabled={popupOpen}
        >
          {popupOpen ? 'Popup visualizer open' : 'Open popup visualizer'}
        </button>
        {SEND_BUTTONS.map(({ label, event }) => (
          <button
            key={label}
            type="button"
            onClick={() => actorRef.current?.send(event)}
          >
            {label}
          </button>
        ))}
      </section>

      {snapshot?.popupStatus === 'blocked' && (
        <p className="poc__banner poc__banner--warn">
          Popup was blocked. Allow popups for this origin, then call{' '}
          <code>viz.openPopup()</code> again from a user gesture.
        </p>
      )}

      {!snapshot?.inlineVisible && !popupOpen && (
        <p className="poc__banner">
          No visualizer active. Call the API (or use the buttons) to open
          inline, popup, or both.
        </p>
      )}

      {snapshot?.inlineVisible && (
        <Suspense fallback={<p className="poc__banner">Loading visualizer…</p>}>
          <VisualizerView snapshot={snapshot} title="Inline visualizer" />
        </Suspense>
      )}
    </div>
  );
}
