import type { ReactNode } from "react";

/** Unique kebab-case id for a concept, e.g. "charakteristisches-polynom". */
export type ConceptId = string;

export interface ConceptDef {
  id: ConceptId;
  /** German display title of the concept. */
  title: string;
  /**
   * Tooltip body (German). May contain <ConceptLink> to other concepts
   * (nested tooltips) and small widgets after the explanation paragraph.
   */
  body: ReactNode;
}
