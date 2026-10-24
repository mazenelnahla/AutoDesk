import type { ElementScheduleData } from '../types/aps';

export function scheduleRecordKey(item: Pick<ElementScheduleData, 'saipemIdent' | 'dbId' | 'modelUrn'>): string {
  const ident = item.saipemIdent.trim().toLowerCase();
  const key = item.dbId == null ? ident : JSON.stringify([ident, item.dbId]);
  return item.modelUrn ? JSON.stringify([item.modelUrn, key]) : key;
}

export function indexScheduleRecords(items: ElementScheduleData[]): Record<string, ElementScheduleData> {
  return Object.fromEntries(items.map((item) => [scheduleRecordKey(item), item]));
}

/** An element-specific row overrides the shared IDENT schedule. */
export function findScheduleRecord(records: Record<string, ElementScheduleData>, ident: string, dbId?: number): ElementScheduleData | undefined {
  const matching = Object.values(records).filter((item) => item.saipemIdent.trim().toLowerCase() === ident.trim().toLowerCase());
  const shared = matching.find((item) => item.dbId == null);
  if (dbId != null) return matching.find((item) => item.dbId === dbId) || shared;
  if (shared || !matching.length) return shared;
  const completionPercentage = Math.round(matching.reduce((sum, item) => sum + item.completionPercentage, 0) / matching.length);
  return {
    ...matching[0], dbId: undefined, elementName: undefined,
    completionPercentage,
    status: matching.some((item) => item.status === 'delayed') ? 'delayed' : completionPercentage === 100 ? 'completed' : completionPercentage > 0 ? 'in_progress' : 'not_started',
  };
}
