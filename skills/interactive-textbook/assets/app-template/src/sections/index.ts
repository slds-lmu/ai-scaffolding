/**
 * Section registry. Every S*.mdx file exports `id` and `title`; the glob
 * makes registration automatic, while mdxSection supplies page typography.
 * Section writers therefore edit only their assigned MDX file and widgets.
 *
 * Equivalent one-file shape:
 *
 *   import Body from "./S41.mdx";
 *   const S41 = mdxSection(Body);
 */
import type { ComponentType } from "react";
import { mdxSection } from "../mdx/adapters";

export interface SectionEntry {
  /** the SOURCE's section number, e.g. "4.6" — also the anchor #sec-4.6 */
  id: string;
  /**
   * Optional stable alias, e.g. "scaling-maps". It adds a second anchor
   * #sec-<key> and lets `@sec:<key>` keep working if the adaptation ever
   * renumbers. Sections that mirror a source's numbering rarely need it.
   */
  key?: string;
  title: string;
  C: ComponentType;
}

type SectionModule = {
  default: ComponentType;
  id?: string;
  key?: string;
  title?: string;
};

const modules = import.meta.glob("./S*.mdx", { eager: true }) as Record<string, SectionModule>;

export const sections: SectionEntry[] = Object.entries(modules)
  .map(([file, mod]) => {
    if (!mod.id?.trim() || !mod.title?.trim()) {
      throw new Error(
        `Section ${file} must export non-empty strings named id and title. ` +
          `Copy the metadata shape from src/sections/_demo.mdx.`
      );
    }
    return { id: mod.id, key: mod.key, title: mod.title, C: mdxSection(mod.default) };
  })
  .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
