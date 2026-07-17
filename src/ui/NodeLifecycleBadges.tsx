import { HoverTip } from './HoverTip';
import { nodeLifecycleFlags } from './lifecycleBadges';
import {
  formatAfterTransitions,
  formatEntryActions,
  formatExitActions,
  getAfterTransitionTargetIds,
} from './nodeDetails';
import { AfterIcon, EntryIcon, ExitIcon } from './nodeIcons';

/** Entry / after / exit badge row with hover tips (graph + watch). */
export function NodeLifecycleBadges({
  node,
  align = 'right',
  className,
  onHighlightTargets,
}: {
  node: {
    entry?: unknown[] | undefined;
    exit?: unknown[] | undefined;
    on?: Record<string, unknown> | undefined;
    transitions?: unknown[] | undefined;
  };
  align?: 'left' | 'right';
  className?: string;
  /** Highlight `after` transition targets while the after badge is hovered. */
  onHighlightTargets?: (targets: Set<string>) => void;
}) {
  const lifecycle = nodeLifecycleFlags(node);
  if (!lifecycle.entry && !lifecycle.exit && !lifecycle.after) return null;

  const entryItems = formatEntryActions(node.entry);
  const exitItems = formatExitActions(node.exit);
  const afterItems = formatAfterTransitions(node.on, node.transitions);

  return (
    <div className={['node__badges', className].filter(Boolean).join(' ')}>
      {lifecycle.entry && (
        <HoverTip
          className="node__badge node__badge--entry"
          label="entry"
          items={entryItems}
          placement="below"
          align={align}
        >
          <EntryIcon />
          <span className="node__badge-label">entry</span>
        </HoverTip>
      )}
      {lifecycle.after && (
        <HoverTip
          className="node__badge node__badge--after"
          label="after"
          items={afterItems}
          placement="below"
          align={align}
          onActiveChange={(active) =>
            onHighlightTargets?.(
              active
                ? getAfterTransitionTargetIds(node.on, node.transitions)
                : new Set(),
            )
          }
        >
          <AfterIcon />
          <span className="node__badge-label">after</span>
        </HoverTip>
      )}
      {lifecycle.exit && (
        <HoverTip
          className="node__badge node__badge--exit"
          label="exit"
          items={exitItems}
          placement="below"
          align={align}
        >
          <ExitIcon />
          <span className="node__badge-label">exit</span>
        </HoverTip>
      )}
    </div>
  );
}
