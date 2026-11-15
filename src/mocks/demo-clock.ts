import type { DemoStore } from './demo-storage.ts';

export function getDemoTime(clock: Pick<DemoStore, 'demoEpoch' | 'realEpoch'>, realNow: number) {
  return clock.demoEpoch + Math.max(0, realNow - clock.realEpoch);
}
export function advanceDemoClock(store: DemoStore, milliseconds: number, realNow: number): DemoStore {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) throw new Error('Khoảng tiến thời gian mô phỏng phải lớn hơn 0.');
  const demoEpoch = getDemoTime(store, realNow) + milliseconds;
  return { ...store, demoEpoch, realEpoch: realNow, state: { ...store.state, referenceTime: new Date(demoEpoch).toISOString() } };
}
