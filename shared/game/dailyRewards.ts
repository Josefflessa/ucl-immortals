import type { AlbumItemKey } from './album';

/** Weekly album rewards follow the São Paulo calendar: Monday through Sunday. */
export const WEEKLY_PACK_REWARDS = [
  { dayIndex: 0, day: 'Segunda-feira', shortDay: 'Segunda', itemKey: 'pack:bronze' },
  { dayIndex: 1, day: 'Terça-feira', shortDay: 'Terça', itemKey: 'pack:bronze' },
  { dayIndex: 2, day: 'Quarta-feira', shortDay: 'Quarta', itemKey: 'pack:silver' },
  { dayIndex: 3, day: 'Quinta-feira', shortDay: 'Quinta', itemKey: 'pack:silver' },
  { dayIndex: 4, day: 'Sexta-feira', shortDay: 'Sexta', itemKey: 'pack:gold' },
  { dayIndex: 5, day: 'Sábado', shortDay: 'Sábado', itemKey: 'pack:gold' },
  { dayIndex: 6, day: 'Domingo', shortDay: 'Domingo', itemKey: 'pack:legendary' },
] as const satisfies readonly { dayIndex: number; day: string; shortDay: string; itemKey: AlbumItemKey }[];

export type WeeklyPackReward = typeof WEEKLY_PACK_REWARDS[number];
