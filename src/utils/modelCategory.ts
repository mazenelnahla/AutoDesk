/** Match category intent against identity fields, never materials or arbitrary metadata. */
export function normalizeCategory(value: string): string {
  return value.toLowerCase().trim().replace(/\s+only$/, '').replace(/^ifc/, '').replace(/s$/, '')
    .replace(/\bfire[\s-]?proof(?:ing)?\b/g, 'fireproofing');
}

type ModelProperty = { displayName?: string; attributeName?: string; displayValue?: unknown };
type ModelElement = { name?: string; properties?: ModelProperty[] };

export function matchesModelCategory(element: ModelElement, category: string, completeWords = false): boolean {
  const term = normalizeCategory(category);
  if (!term) return false;
  const identity = (element.properties || []).filter((property) =>
    /^(element\s*:?|category|family|family name|type|type name|name|object type|ifc type|ifc class|entity|class)$/i.test((property.displayName || property.attributeName || '').trim())
  ).map((property) => String(property.displayValue || ''));
  const identityValues = [...identity, element.name || ''];
  // Exported IFC names carry the actual element kind after ::. Once present,
  // this classification overrides generic IFC classes in every other field.
  const classified = identityValues.filter((value) => value.includes('::'));
  const values = classified.length
    ? classified.map((value) => value.slice(value.indexOf('::') + 2).trim()).filter(Boolean)
    : identityValues;
  // Tubular railings are still railings, even when a name mentions pipe.
  const pipeIntent = /^(pipe|piping)/.test(term) || (completeWords && term.length >= 3 && ['pipe', 'piping'].some((word) => word.startsWith(term)));
  if (pipeIntent && values.some((value) => /hand[\s_-]*rail|guard[\s_-]*rail|railing/i.test(value))) return false;
  return values.some((value) => {
    const normalized = normalizeCategory(value);
    if (completeWords) {
      const queryWords = term.split(/[^a-z0-9]+/).filter(Boolean);
      const words = normalizeCategory(value.replace(/([a-z])([A-Z])/g, '$1 $2')).split(/[^a-z0-9]+/).filter(Boolean);
      // Complete whole word prefixes, never arbitrary substrings. Short words
      // must match exactly to avoid broad accidental selections.
      return queryWords.length > 0 && queryWords.every((query) => words.some((word) =>
        word === query || (query.length >= 3 && word.startsWith(query))
      ));
    }
    if (/^(pipe|piping)$/.test(term)) return /^(pipe|piping)(segment|fitting|accessory|insulation)?$/.test(normalized.replace(/[\s_-]/g, '')) || /\bpipes?\b/i.test(normalized);
    if (/^(handrail|railing|rail)$/.test(term)) return /hand[\s_-]*rail|guard[\s_-]*rail|\brailings?\b/i.test(normalized);
    return normalized === term || normalized.split(/[^a-z0-9]+/).some((word) => normalizeCategory(word) === term);
  });
}
