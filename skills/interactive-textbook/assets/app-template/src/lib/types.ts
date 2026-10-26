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
  /**
   * "course": a term the text itself defines (the body is its own
   * definition). Links render with a quiet grey underline instead of the
   * blue prerequisite style. Default: prerequisite concept.
   */
  variant?: "course";
  /** Small label in the window header, e.g. "Definition 3.3.1". */
  badge?: string;
  /** Rendered below the body, e.g. a link to where the concept is defined. */
  footer?: ReactNode;
}
