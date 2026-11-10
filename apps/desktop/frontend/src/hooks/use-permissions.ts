import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

interface MyPermissions {
  grants: string[];
  permissions: string[];
  is_super: boolean;
}

export function usePermissions() {
  const { data, isLoading } = useQuery<MyPermissions>({
    queryKey: ["my-permissions"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: MyPermissions }>("/auth/permissions");
      return data.data;
    },
  });

  const granted = new Set(data?.permissions ?? []);
  const isSuper = data?.is_super ?? false;

  /**
   * can("users.delete") — exact permission
   * can("users.*")      — any permission on that resource
   *
   * False while loading, so gated UI stays hidden rather than flashing in.
   */
  function can(permission: string): boolean {
    if (isSuper) return true;
    if (permission.endsWith(".*")) {
      const prefix = permission.slice(0, -1);
      for (const p of granted) if (p.startsWith(prefix)) return true;
      return false;
    }
    return granted.has(permission);
  }

  return { can, isSuper, isLoading, permissions: data?.permissions ?? [] };
}
