import { PageHeader } from "@/components/PageHeader";

export default function RolesPage() {
  return (
    <div>
      <PageHeader title="Roles" subtitle="Manage target roles and skill requirements" />
      <div className="p-8">
        <p className="text-sm text-muted-foreground">Role definitions will be loaded from the database.</p>
      </div>
    </div>
  );
}
