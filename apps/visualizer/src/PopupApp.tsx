import { useEffect, useState } from 'react';
import {
  connectPopupReceiver,
  DEFAULT_MAX_LOG_ENTRIES_PER_SESSION,
  retainLogEntriesPerSession,
  type VizLogEntry,
  type VizMachine,
  type VisualizerSnapshot,
} from '@r-a-i-t-h/viz-protocol';
import {
  VisualizerView,
  type ConnectionStatus,
} from './ui/VisualizerView';
import { readStoredTheme } from './ui/theme';
import './ui/visualizer.css';

/**
 * Popup page — receives projected Viz* payloads via postMessage and renders
 * with the optional React visualizer UI.
 */
export default function PopupApp() {
  const [connection, setConnection] = useState<ConnectionStatus>('waiting');
  const [snapshot, setSnapshot] = useState<VisualizerSnapshot>({
    machines: [],
    frames: {},
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
            const machine = message.payload as VizMachine;
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
        case '@viz.frame':
          setConnection('connected');
          setSnapshot((prev) => ({
            ...prev,
            frames: {
              ...prev.frames,
              [message.payload.sessionId]: message.payload,
            },
            popupStatus: 'connected',
          }));
          break;
        case '@viz.log':
          setConnection('connected');
          setSnapshot((prev) => {
            const entry = message.payload as VizLogEntry;
            return {
              ...prev,
              log: retainLogEntriesPerSession(
                [entry, ...prev.log],
                entry.sessionId,
                DEFAULT_MAX_LOG_ENTRIES_PER_SESSION,
              ),
              popupStatus: 'connected',
            };
          });
          break;
        case '@viz.closed':
          setConnection('closed');
          break;
      }
    });
  }, []);

  if (connection === 'orphan') {
    return (
      <div className="viz--popup">
        <div className="viz" data-theme={readStoredTheme()}>
          <header className="viz__header">
            <div className="viz__header-row">
              <div className="viz__header-start">
                <h1 className="viz__title">XState viz</h1>
                <span className="viz__status viz__status--err">no host</span>
              </div>
            </div>
          </header>
        </div>
      </div>
    );
  }

  return (
    <div className="viz--popup">
      <VisualizerView
        snapshot={snapshot}
        title="XState viz"
        connection={connection}
        syncDocumentTheme
      />
    </div>
  );
}
