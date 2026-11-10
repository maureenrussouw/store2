import { AdminLayout } from "@/components/layout/admin-layout";
import { SystemGuard } from "@/components/chrome/system-guard";

export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminLayout>
      <SystemGuard />
      {children}
    </AdminLayout>
  );
}
