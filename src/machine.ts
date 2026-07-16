import { assign, setup } from 'xstate';

/**
 * A deliberately non-meaningful demo machine whose only job is to exercise the
 * structural features a visualizer must render:
 *
 * - a compound (composite) top-level flow: idle -> running -> idle
 * - a `parallel` region (`running`) with two independent sub-regions
 * - deeper nesting: `running.signal.red` is itself a compound state
 * - entry / exit / after affordances for lifecycle badge overlays
 *
 * Written with XState v5's `setup().createMachine()` so `actorRef.logic` exposes
 * a fully-resolved `.definition` we can capture for visualization.
 */
export const demoMachine = setup({
  types: {
    context: {} as { ticks: number },
    events: {} as
      | { type: 'START' }
      | { type: 'STOP' }
      | { type: 'PAUSE' }
      | { type: 'RESUME' }
      | { type: 'TICK' }
      | { type: 'CYCLE' }
      | { type: 'TOGGLE_MODE' }
      | { type: 'DONE' },
  },
  actions: {
    markIdle: () => {},
    clearIdle: () => {},
    markActive: () => {},
    clearActive: () => {},
    markFlashing: () => {},
  },
}).createMachine({
  id: 'demo',
  initial: 'idle',
  context: { ticks: 0 },
  states: {
    idle: {
      entry: 'markIdle',
      exit: 'clearIdle',
      on: {
        START: 'running',
        DONE: 'done',
      },
    },
    // Parallel state: both regions are active simultaneously while `running`.
    running: {
      type: 'parallel',
      on: { STOP: 'idle' },
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
          },
        },
      },
    },
    done: {
      type: 'final',
    },
  },
});
