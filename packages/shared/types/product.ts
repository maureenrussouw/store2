import type { Category } from "./category";
import type { FileRef } from "../schemas/file-ref";

export interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  description: string;
  thumbnail: FileRef | null;
  images: FileRef[];
  category_id: string;
  category?: Category;
  parent_id: string | null;
  parent?: Product;
  children?: Product[];
  path: string;
  depth: number;
  position: number;
  version: number;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}
