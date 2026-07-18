import { assign, fromPromise, setup } from 'xstate';

/**
 * Spawned child — appears under the demo actor in the registry tree and as a
 * clickable `worker` context ref.
 */
export const workerMachine = setup({
  types: {
    context: {} as { tag: string },
    input: {} as { tag: string },
    events: {} as { type: 'PING' } | { type: 'FINISH' },
  },
}).createMachine({
  id: 'worker',
  context: ({ input }) => ({ tag: input?.tag ?? 'anon' }),
  initial: 'idle',
  states: {
    idle: {
      on: { PING: 'busy' },
    },
    busy: {
      on: { FINISH: 'done' },
    },
    done: {
      type: 'final',
      output: ({ context }) => ({ tag: context.tag, ok: true }),
    },
  },
});

/**
 * A deliberately non-meaningful demo machine whose only job is to exercise the
 * structural features a visualizer must render:
 *
 * - a compound (composite) top-level flow: idle -> running -> idle
 * - a `parallel` region (`running`) with two independent sub-regions
 * - deeper nesting: `running.signal.red` is itself a compound state
 * - entry / exit / after affordances for lifecycle badge overlays
 * - `always` (eventless) gate + `invoke` with onDone/onError
 * - history state under `running.signal` (RESTORE)
 * - `spawn` child into `context.worker` on START
 * - parent+child both handle `NUDGE` (next-events multi-provider highlight)
 * - context dep-graph: multi-key assign, named + inline guards, invoke I/O
 *
 * Written with XState v5's `setup().createMachine()` so `actorRef.logic` exposes
 * a fully-resolved `.definition` we can capture for visualization.
 */
export const demoMachine = setup({
  types: {
    context: {} as {
      ticks: number;
      label: string;
      ready: boolean;
      fetchStatus: 'idle' | 'loading' | 'done' | 'error';
      lastResult: string | null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      worker: any;
    },
    events: {} as
      | { type: 'START' }
      | { type: 'STOP' }
      | { type: 'PAUSE' }
      | { type: 'RESUME' }
      | { type: 'TICK' }
      | { type: 'NUDGE' }
      | { type: 'CYCLE' }
      | { type: 'TOGGLE_MODE' }
      | { type: 'DONE' }
      | { type: 'ARM' }
      | { type: 'READY' }
      | { type: 'CHECK' }
      | { type: 'FETCH' }
      | { type: 'RESTORE' },
  },
  actions: {
    markIdle: () => {},
    clearIdle: () => {},
    markActive: () => {},
    clearActive: () => {},
    markFlashing: () => {},
    /** Named multi-key assign — write targets come from implementations. */
    bumpSession: assign({
      ticks: ({ context }) => context.ticks + 1,
      label: ({ context }) => `tick-${context.ticks + 1}`,
    }),
    noteParentNudge: assign({
      label: 'nudged-parent',
    }),
    spawnWorker: assign({
      worker: ({ spawn, context }) =>
        spawn('worker', {
          id: 'worker',
          input: { tag: `w-${context.ticks}` },
        }),
    }),
  },
  guards: {
    isReady: ({ context }) => context.ready === true,
  },
  actors: {
    demoFetch: fromPromise(
      async ({ input }: { input: { ticks: number; label: string } }) => {
        return `ok:${input.label}:${input.ticks}`;
      },
    ),
    worker: workerMachine,
  },
}).createMachine({
  id: 'demo',
  initial: 'idle',
  context: {
    ticks: 0,
    label: 'boot',
    ready: false,
    fetchStatus: 'idle',
    lastResult: null,
    worker: null,
  },
  states: {
    idle: {
      entry: 'markIdle',
      exit: 'clearIdle',
      on: {
        START: {
          target: 'running',
          actions: 'spawnWorker',
        },
        DONE: 'done',
        // Flip ready so the always-gate and ARM guard can fire.
        READY: {
          actions: assign({ ready: true }),
        },
        // Named guard read + named multi-key assign.
        ARM: {
          guard: 'isReady',
          actions: 'bumpSession',
        },
        // Eventless gate demo: CHECK → gate → always → running | idle.
        CHECK: 'gate',
        // Inline guard read (toString heuristic).
        FETCH: {
          guard: ({ context }) => context.ticks > 0,
          target: 'fetching',
        },
      },
    },
    /** Eventless (`always`) cascade — badge + target highlight. */
    gate: {
      always: [
        { guard: 'isReady', target: 'running' },
        { target: 'idle' },
      ],
    },
    fetching: {
      entry: assign({ fetchStatus: 'loading' }),
      invoke: {
        src: 'demoFetch',
        input: ({ context }) => ({
          ticks: context.ticks,
          label: context.label,
        }),
        onDone: {
          target: 'idle',
          actions: assign({
            fetchStatus: 'done',
            lastResult: ({ event }) => String(event.output),
          }),
        },
        onError: {
          target: 'idle',
          actions: assign({
            fetchStatus: 'error',
            lastResult: null,
          }),
        },
      },
    },
    // Parallel state: both regions are active simultaneously while `running`.
    running: {
      type: 'parallel',
      on: {
        STOP: 'idle',
        // Same event on parent + child → next-events lists both providers.
        NUDGE: { actions: 'noteParentNudge' },
      },
      states: {
        // Region 1 — a simple compound engine with pause/resume.
        engine: {
          initial: 'active',
          states: {
            active: {
              entry: 'markActive',
              exit: 'clearActive',
              // Demo delayed self-nudge so the "after" badge is visible.
              after: { 5000: { target: 'active' } },
              on: {
                PAUSE: 'paused',
                TICK: {
                  actions: assign({ ticks: ({ context }) => context.ticks + 1 }),
                },
                NUDGE: {
                  actions: assign({
                    ticks: ({ context }) => context.ticks + 1,
                  }),
                },
              },
            },
            paused: {
              on: { RESUME: 'active' },
            },
          },
        },
        // Region 2 — a signal that cycles and nests a compound `red` state.
        signal: {
          initial: 'green',
          on: {
            // Restore last signal leaf via shallow history.
            RESTORE: '.hist',
          },
          states: {
            green: { on: { CYCLE: 'amber' } },
            amber: {
              // Auto-advance after a short delay if CYCLE isn't sent.
              after: { 2000: 'red' },
              on: { CYCLE: 'red' },
            },
            red: {
              initial: 'solid',
              on: { CYCLE: 'green' },
              states: {
                solid: { on: { TOGGLE_MODE: 'flashing' } },
                flashing: {
                  entry: 'markFlashing',
                  on: { TOGGLE_MODE: 'solid' },
                },
              },
            },
            hist: {
              type: 'history',
              history: 'shallow',
            },
          },
        },
      },
    },
    done: {
      type: 'final',
      output: ({ context }) => ({
        ticks: context.ticks,
        label: context.label,
      }),
    },
  },
});


export const blinkerMachine = setup({}).createMachine({
  id: 'blinker',
  initial: 'off',
  states: {
    off: {
      after: { 1500: 'on' },
    },
    on: {
      after: { 1500: 'dim' },
    },
    dim: {
      after: { 1500: 'off' },
    },
  },
});

/**
 * Stress machine: a compound root with many sequential siblings (vertical
 * stretch) plus one wide parallel band (horizontal stretch). Used to verify
 * the visualizer scrolls the whole graph as one surface — never per-node.
 *
 * Each parallel region is a small compound state (a↔b) so nodes have height as
 * well as width — not just a flat row of atomics.
 */
const WIDE_REGION_KEYS = [
  'alpha',
  'bravo',
  'charlie',
  'delta',
  'echo',
  'foxtrot',
  'golf',
  'hotel',
  'india',
  'juliet',
  'kilo',
  'lima',
] as const;

const TALL_STAGE_KEYS = [
  'prep',
  'warmup',
  'ready',
  'armed',
  'staged',
  'band',
  'cooldown',
  'wrapUp',
  'archive',
  'sealed',
] as const;

function wideRegion(key: (typeof WIDE_REGION_KEYS)[number]) {
  const flip = `FLIP_${key.toUpperCase()}` as const;
  return {
    initial: 'a' as const,
    states: {
      a: { on: { [flip]: 'b' } },
      b: { on: { [flip]: 'a' } },
    },
  };
}

function tallStage(
  key: (typeof TALL_STAGE_KEYS)[number],
  next: (typeof TALL_STAGE_KEYS)[number] | 'done',
) {
  if (key === 'band') {
    return {
      type: 'parallel' as const,
      on: { NEXT: next },
      states: Object.fromEntries(
        WIDE_REGION_KEYS.map((region) => [region, wideRegion(region)]),
      ),
    };
  }

  // Nested a→b→c compound so each sequential sibling adds real vertical depth.
  return {
    initial: 'a' as const,
    on: { NEXT: next },
    states: {
      a: { on: { STEP: 'b' } },
      b: { on: { STEP: 'c' } },
      c: {},
    },
  };
}

export const wideParallelMachine = setup({}).createMachine({
  id: 'wideParallel',
  initial: 'prep',
  states: {
    ...Object.fromEntries(
      TALL_STAGE_KEYS.map((key, index) => {
        const next = TALL_STAGE_KEYS[index + 1] ?? 'done';
        return [key, tallStage(key, next)];
      }),
    ),
    done: { type: 'final' },
  },
});
