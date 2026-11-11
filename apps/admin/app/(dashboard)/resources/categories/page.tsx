"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { categoryResource } from "@/resources/categories/categories";

export default function CategoriesPage() {
  return <ResourcePage resource={categoryResource} />;
}
