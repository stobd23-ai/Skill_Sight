import { PageHeader } from "@/components/PageHeader";

export default function EmployeeProfile() {
  return (
    <div>
      <PageHeader title="Employee Profile" subtitle="Detailed employee information" />
      <div className="p-8">
        <p className="text-sm text-muted-foreground">Employee profile will be loaded from the database.</p>
      </div>
    </div>
  );
}
