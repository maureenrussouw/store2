import type { FileRef } from "../schemas/file-ref";

export interface Category {
  id: string;
  name: string;
  slug: string;
  image: FileRef | null;
  featured: boolean;
  parent_id: string | null;
  parent?: Category;
  children?: Category[];
  path: string;
  depth: number;
  position: number;
  version: number;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}
