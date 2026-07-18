/**
 * Static context dependency graph shape — shared by host analysis and UI.
 * The analyzer that builds this lives in `@viz/host` (needs live XState logic).
 */

export type DepEntityKind = 'contextKey' | 'action' | 'guard' | 'invoke';

export type DepCoverage = 'known' | 'partial' | 'opaque';

export type DepRelation = 'reads' | 'writes';

export type DepSite = 'entry' | 'exit' | 'transition' | 'invoke';

export interface ContextDepNode {
  id: string;
  kind: DepEntityKind;
  label: string;
  coverage: DepCoverage;
}

export interface ContextDepEdge {
  from: string;
  to: string;
  relation: DepRelation;
  at: {
    stateId: string;
    site: DepSite;
    eventType?: string;
  };
}

export interface ContextDepGraph {
  nodes: ContextDepNode[];
  edges: ContextDepEdge[];
}
