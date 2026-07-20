import { HoverTip, type HoverTipItem } from './HoverTip';
import { depEntityId } from './contextDepHighlights';
import type { VizBadge, VizInvoke, VizNode, VizSymbol } from '@r-a-i-t-h/viz-protocol';
import {
  AfterIcon,
  AlwaysIcon,
  EntryIcon,
  ExitIcon,
  HistoryIcon,
  InvokeIcon,
} from './nodeIcons';
import {
  NO_TRANSITION_HIGHLIGHT,
  targetHighlight,
  type TransitionHighlight,
} from './transitionHighlight';

const LIFECYCLE_KINDS = new Set([
  'entry',
  'exit',
  'after',
  'always',
  'invoke',
  'history',
]);

/** Entry / after / exit / always / invoke / history badge row with hover tips. */
export function NodeLifecycleBadges({
  node,
  align = 'right',
  className,
  onHighlightTransition,
  onEntityHover,
}: {
  node: VizNode;
  align?: 'left' | 'right';
  className?: string;
  /** Highlight badge transition targets while hovered. */
  onHighlightTransition?: (highlight: TransitionHighlight) => void;
  /** Highlight context keys for hovered action/guard entities. */
  onEntityHover?: (entityIds: string[]) => void;
}) {
  const badges = node.badges.filter((b) => LIFECYCLE_KINDS.has(b.kind));
  if (badges.length === 0) return null;

  return (
    <div className={['node__badges', className].filter(Boolean).join(' ')}>
      {badges.map((badge) => (
        <BadgeTip
          key={badge.kind}
          badge={badge}
          node={node}
          align={align}
          onHighlightTransition={onHighlightTransition}
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
  onHighlightTransition,
  onEntityHover,
}: {
  badge: VizBadge;
  node: VizNode;
  align: 'left' | 'right';
  onHighlightTransition?: (highlight: TransitionHighlight) => void;
  onEntityHover?: (entityIds: string[]) => void;
}) {
  const Icon =
    badge.kind === 'entry'
      ? EntryIcon
      : badge.kind === 'exit'
        ? ExitIcon
        : badge.kind === 'after'
          ? AfterIcon
          : badge.kind === 'always'
            ? AlwaysIcon
            : badge.kind === 'history'
              ? HistoryIcon
              : InvokeIcon;

  const items = tipItemsForBadge(badge, node);
  const entityHover =
    badge.kind === 'entry' || badge.kind === 'exit'
      ? onEntityHover
      : undefined;

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
              onHighlightTransition?.(
                active
                  ? targetHighlight(badge.highlightIds)
                  : NO_TRANSITION_HIGHLIGHT,
              )
          : undefined
      }
      onEntityHover={entityHover}
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
  if (badge.kind === 'invoke') {
    return node.details.invokes.flatMap(invokeTipItems);
  }
  return badge.lines.map((label) => ({ label }));
}

function invokeTipItems(inv: VizInvoke): HoverTipItem[] {
  const items: HoverTipItem[] = [{ label: `src ${inv.src}` }];
  if (inv.id) items.push({ label: `id ${inv.id}` });
  if (inv.inputSummary) items.push({ label: inv.inputSummary });
  for (const t of inv.onDone) items.push({ label: t.line });
  for (const t of inv.onError) items.push({ label: t.line });
  return items;
}

function symbolTipItem(symbol: VizSymbol): HoverTipItem {
  const entityId = depEntityId(symbol) ?? undefined;
  return {
    label: symbol.detail ? `${symbol.name} (${symbol.detail})` : symbol.name,
    entityId,
  };
}
