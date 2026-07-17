import { useEffect, useState } from 'react';
import {
  connectPopupReceiver,
  type CapturedMachine,
  type LoggedEvent,
  type VisualizerSnapshot,
} from '../viz';
import {
  VisualizerView,
  type ConnectionStatus,
} from './VisualizerView';
import './visualizer.css';

/**
 * Popup page — receives portable payloads via postMessage and renders with the
 * optional React visualizer UI.
 */
export default function PopupApp() {
  const [connection, setConnection] = useState<ConnectionStatus>('waiting');
  const [snapshot, setSnapshot] = useState<VisualizerSnapshot>({
    machines: [],
    actorStates: {},
    log: [],
    inlineVisible: false,
    popupStatus: 'idle',
  });

  useEffect(() => {
    if (!window.opener && window.parent === window) {
      setConnection('orphan');
      return;
    }

    return connectPopupReceiver((message) => {
      switch (message.type) {
        case '@viz.machine':
          setConnection('connected');
          setSnapshot((prev) => {
            const machine = message.payload as CapturedMachine;
            const existing = prev.machines.findIndex(
              (m) => m.sessionId === machine.sessionId,
            );
            const machines =
              existing >= 0
                ? prev.machines.map((m, i) => (i === existing ? machine : m))
                : [...prev.machines, machine];
            return { ...prev, machines, popupStatus: 'connected' };
          });
          break;
        case '@viz.snapshot':
          setConnection('connected');
          setSnapshot((prev) => ({
            ...prev,
            actorStates: {
              ...prev.actorStates,
              [message.payload.sessionId]: {
                value: message.payload.value,
                context: message.payload.context,
                eventType: message.payload.eventType,
              },
            },
            popupStatus: 'connected',
          }));
          break;
        case '@viz.log':
          setConnection('connected');
          setSnapshot((prev) => ({
            ...prev,
            log: [message.payload as LoggedEvent, ...prev.log].slice(0, 40),
            popupStatus: 'connected',
          }));
          break;
        case '@viz.closed':
          setConnection('closed');
          break;
      }
    });
  }, []);

  if (connection === 'orphan') {
    return (
      <div className="viz viz--popup">
        <header className="viz__header">
          <div className="viz__header-row">
            <div className="viz__header-start">
              <h1 className="viz__title">XState viz</h1>
              <span className="viz__status viz__status--err">no host</span>
            </div>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="viz viz--popup">
      <VisualizerView
        snapshot={snapshot}
        title="XState viz"
        connection={connection}
      />
    </div>
  );
}
