import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Users } from "lucide-react";

export default function EmployeeList() {
  return (
    <div>
      <PageHeader title="Employees" subtitle="Manage and view employee profiles" />
      <div className="p-8">
        <EmptyState
          icon={Users}
          title="No employees loaded"
          description="Connect your database to view employee data."
        />
      </div>
    </div>
  );
}
