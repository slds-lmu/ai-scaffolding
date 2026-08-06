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
  id: string;
  title: string;
  C: ComponentType;
}

type SectionModule = {
  default: ComponentType;
  id?: string;
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
    return { id: mod.id, title: mod.title, C: mdxSection(mod.default) };
  })
  .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
