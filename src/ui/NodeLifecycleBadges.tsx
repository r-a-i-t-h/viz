import { HoverTip } from './HoverTip';
import type { VizBadge, VizNode } from '../viz';
import { AfterIcon, EntryIcon, ExitIcon } from './nodeIcons';

/** Entry / after / exit badge row with hover tips (graph + watch). */
export function NodeLifecycleBadges({
  node,
  align = 'right',
  className,
  onHighlightTargets,
}: {
  node: VizNode;
  align?: 'left' | 'right';
  className?: string;
  /** Highlight badge transition targets while hovered. */
  onHighlightTargets?: (targets: Set<string>) => void;
}) {
  const badges = node.badges.filter(
    (b) => b.kind === 'entry' || b.kind === 'exit' || b.kind === 'after',
  );
  if (badges.length === 0) return null;

  return (
    <div className={['node__badges', className].filter(Boolean).join(' ')}>
      {badges.map((badge) => (
        <BadgeTip
          key={badge.kind}
          badge={badge}
          align={align}
          onHighlightTargets={onHighlightTargets}
        />
      ))}
    </div>
  );
}

function BadgeTip({
  badge,
  align,
  onHighlightTargets,
}: {
  badge: VizBadge;
  align: 'left' | 'right';
  onHighlightTargets?: (targets: Set<string>) => void;
}) {
  const Icon =
    badge.kind === 'entry'
      ? EntryIcon
      : badge.kind === 'exit'
        ? ExitIcon
        : AfterIcon;

  return (
    <HoverTip
      className={`node__badge node__badge--${badge.kind}`}
      label={badge.label}
      items={badge.lines}
      placement="below"
      align={align}
      onActiveChange={
        badge.highlightIds.length > 0
          ? (active) =>
              onHighlightTargets?.(
                active ? new Set(badge.highlightIds) : new Set(),
              )
          : undefined
      }
    >
      <Icon />
      <span className="node__badge-label">{badge.label}</span>
    </HoverTip>
  );
}
