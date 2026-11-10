export interface Blog {
  id: string;
  title: string;
  slug: string;
  content: string;
  image: string;
  excerpt: string;
  published: boolean;
  published_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}
