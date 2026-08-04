/**
 * Section registry — PRE-POPULATE this file with ALL sections (importing stub
 * components) BEFORE launching the section-writer agents, then never let an
 * agent edit it: each agent only overwrites its own stub file. This removes
 * every shared-file conflict between concurrent agents.
 *
 * Example (adapt ids/titles to the chapter being converted):
 *
 *   import { S41 } from "./S41";
 *   export const sections: SectionEntry[] = [
 *     { id: "4.1", title: "Determinant and Trace", C: S41 },
 *     ...
 *   ];
 */
import type { ComponentType } from "react";

export interface SectionEntry {
  id: string;
  title: string;
  C: ComponentType;
}

export const sections: SectionEntry[] = [];
