export interface Customer {
  id: string;
  name: string;
  email: string;
  company: string;
  version: number;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}
