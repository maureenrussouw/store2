import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Category, CategoryInput } from "@/hooks/use-categories";
import { FileDropzone } from "@/components/file-dropzone";
import type { FileRef } from "@/lib/api-client";
import { useCategories } from "@/hooks/use-categories";
import { SearchableSelect } from "@/components/searchable-select";

const inputCls =
  "w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-[13px] text-foreground placeholder:text-foreground-muted outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent";

interface CategoryFormProps {
  // The typed resource, so passing the wrong record is a compile error rather
  // than a form that silently prefills nothing.
  record?: Category | null;
  submitting?: boolean;
  submitLabel: string;
  onSubmit: (values: CategoryInput) => void | Promise<void>;
  onCancel?: () => void;
}

export function CategoryForm({ record, submitting, submitLabel, onSubmit, onCancel }: CategoryFormProps) {
  const [name, setName] = useState<string>("");
  const [image, setImage] = useState<FileRef | null>(null);
  const [featured, setFeatured] = useState<boolean>(false);
  const [parentID, setParentID] = useState<string>("");
  const categoriesOpts = useCategories().data ?? [];

  useEffect(() => {
    if (!record) return;
      setName(String(record.name ?? ""));
      setImage((record.image as FileRef | null) ?? null);
      setFeatured(Boolean(record.featured));
      setParentID(String(record.parent_id ?? ""));
  }, [record]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      name: name,
      image: image as CategoryInput["image"],
      featured: featured,
      parent_id: parentID,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <div className="flex-1 space-y-4">
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>
        <FileDropzone label="Image" value={image} onChange={(v) => setImage((v as FileRef) ?? null)} accept="image/*" />
        <label className="flex items-center gap-2 text-[13px] text-foreground">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="h-4 w-4" />
          Featured
        </label>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Parent</label>
          <SearchableSelect value={parentID} onChange={(v) => setParentID(v ?? "")} placeholder="Select parent…"
            options={categoriesOpts.map((o: any) => ({ value: String(o.id), label: String(o.name ?? o.title ?? ([o.first_name, o.last_name].filter(Boolean).join(" ") || o.email || o.id)) }))} />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-foreground-secondary transition-colors hover:bg-surface-hover"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
