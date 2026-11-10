import { brand } from "@repo/shared/brand.config";

// tint is the brand colour and fg the letter on it. Defaulting to a wash of
// white made the mark invisible on the six themes whose hero panel is light,
// which is where the shell with no tint used it.
export function BrandMark({ tint, fg }: { tint: string; fg: string }) {
  if (brand.logo.image) {
    return <img src={brand.logo.image} alt={brand.name} className="h-8 w-8" />;
  }
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-md font-bold"
      style={{ background: tint, color: fg }}
    >
      {brand.logo.text}
    </span>
  );
}
