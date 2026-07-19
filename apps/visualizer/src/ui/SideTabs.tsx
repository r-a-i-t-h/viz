import { useState, type ReactNode } from 'react';

export type SideTabId = 'state' | 'context' | 'log';

const TABS: { id: SideTabId; label: string }[] = [
  { id: 'state', label: 'State' },
  { id: 'context', label: 'Context' },
  { id: 'log', label: 'Event log' },
];

/** Tab strip + one active panel for the right-side inspector column. */
export function SideTabs({
  panels,
  defaultTab = 'state',
}: {
  panels: Record<SideTabId, ReactNode>;
  defaultTab?: SideTabId;
}) {
  const [active, setActive] = useState<SideTabId>(defaultTab);

  return (
    <div className="viz__side-tabs">
      <div className="viz__side-tablist" role="tablist" aria-label="Inspector">
        {TABS.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`viz-side-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`viz-side-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={[
                'viz__side-tab',
                selected ? 'viz__side-tab--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setActive(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <div
            key={tab.id}
            role="tabpanel"
            id={`viz-side-panel-${tab.id}`}
            aria-labelledby={`viz-side-tab-${tab.id}`}
            hidden={!selected}
            className="viz__side-tabpanel"
          >
            {selected ? panels[tab.id] : null}
          </div>
        );
      })}
    </div>
  );
}
