import type { ElementScheduleData, ScannedModelIdentMap } from '../types/aps';

/** Generate model-specific sample rows without replacing any existing part record. */
export function generateModelSchedule(scanned: ScannedModelIdentMap, existing: ElementScheduleData[], modelUrn: string, projectId: string, projectName?: string): ElementScheduleData[] {
  const source = existing.filter(row => (!row.modelUrn || row.modelUrn === modelUrn) && (!row.projectId || row.projectId === projectId));
  const occupied = new Set(source.filter(row => row.dbId != null).map(row => row.dbId));
  const generated: ElementScheduleData[] = [];
  for (const [ident, info] of Object.entries(scanned)) {
    for (const dbId of info.dbIds) {
      if (occupied.has(dbId)) continue;
      const element = info.elements?.[dbId];
      const templates = source.filter(row => row.category === (element?.category || info.category));
      const candidates = templates.length ? templates : source;
      // Stable distribution follows the examples instead of inventing live progress.
      const template = candidates.length ? candidates[dbId % candidates.length] : undefined;
      generated.push({
        saipemIdent: ident, dbId, modelUrn, projectId, projectName,
        elementName: element?.name || info.name || `Element ${dbId}`,
        category: element?.category || info.category,
        status: template?.status || 'not_started',
        completionPercentage: template?.completionPercentage || 0,
        startDate: template?.startDate, endDate: template?.endDate,
        assignee: template?.assignee,
        notes: `GENERATED SAMPLE DATA from ${template ? `dbId ${template.dbId ?? 'shared IDENT'}` : 'model inventory'}. Verify before using as actual progress.`,
        customFields: {
          Saipem_IDENT: ident,
          dbId: String(dbId),
          ModelUrn: modelUrn,
          ...(element?.externalId ? { ExternalId: element.externalId } : {}),
          DataSource: 'Generated sample',
          ...(template ? { TemplateRecord: `${template.saipemIdent} / ${template.dbId ?? 'shared'}` } : {}),
        },
        updatedAt: new Date().toISOString(),
      });
      occupied.add(dbId);
    }
  }
  return generated;
}
