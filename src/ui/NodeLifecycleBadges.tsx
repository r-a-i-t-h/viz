import { HoverTip, type HoverTipItem } from './HoverTip';
import { depEntityId } from './contextDepHighlights';
import type { VizBadge, VizNode, VizSymbol } from '../viz';
import { AfterIcon, EntryIcon, ExitIcon } from './nodeIcons';

/** Entry / after / exit badge row with hover tips (graph + watch). */
export function NodeLifecycleBadges({
  node,
  align = 'right',
  className,
  onHighlightTargets,
  onEntityHover,
}: {
  node: VizNode;
  align?: 'left' | 'right';
  className?: string;
  /** Highlight badge transition targets while hovered. */
  onHighlightTargets?: (targets: Set<string>) => void;
  /** Highlight context keys for hovered action/guard entities. */
  onEntityHover?: (entityIds: string[]) => void;
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
          node={node}
          align={align}
          onHighlightTargets={onHighlightTargets}
          onEntityHover={onEntityHover}
        />
      ))}
    </div>
  );
}

function BadgeTip({
  badge,
  node,
  align,
  onHighlightTargets,
  onEntityHover,
}: {
  badge: VizBadge;
  node: VizNode;
  align: 'left' | 'right';
  onHighlightTargets?: (targets: Set<string>) => void;
  onEntityHover?: (entityIds: string[]) => void;
}) {
  const Icon =
    badge.kind === 'entry'
      ? EntryIcon
      : badge.kind === 'exit'
        ? ExitIcon
        : AfterIcon;

  const items = tipItemsForBadge(badge, node);

  return (
    <HoverTip
      className={`node__badge node__badge--${badge.kind}`}
      label={badge.label}
      items={items}
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
      onEntityHover={
        badge.kind === 'entry' || badge.kind === 'exit'
          ? onEntityHover
          : undefined
      }
    >
      <Icon />
      <span className="node__badge-label">{badge.label}</span>
    </HoverTip>
  );
}

function tipItemsForBadge(badge: VizBadge, node: VizNode): HoverTipItem[] {
  if (badge.kind === 'entry') {
    return node.details.entry.map(symbolTipItem);
  }
  if (badge.kind === 'exit') {
    return node.details.exit.map(symbolTipItem);
  }
  return badge.lines.map((label) => ({ label }));
}

function symbolTipItem(symbol: VizSymbol): HoverTipItem {
  const entityId = depEntityId(symbol) ?? undefined;
  return {
    label: symbol.detail ? `${symbol.name} (${symbol.detail})` : symbol.name,
    entityId,
  };
}
