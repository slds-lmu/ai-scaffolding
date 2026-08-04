import type { ConceptDef, ConceptId } from "./types";

const registry = new Map<ConceptId, ConceptDef>();

/** Register a concept definition. Called once per concept module at import time. */
export function registerConcept(def: ConceptDef): void {
  // in dev, Vite HMR legitimately re-registers modules — only warn in prod
  if (registry.has(def.id) && !import.meta.env.DEV) {
    console.warn(`[registry] duplicate concept id "${def.id}" — overwriting`);
  }
  registry.set(def.id, def);
}

export function getConcept(id: ConceptId): ConceptDef | undefined {
  return registry.get(id);
}

export function allConceptIds(): ConceptId[] {
  return [...registry.keys()];
}
