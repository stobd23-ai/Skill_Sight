import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Users, BarChart3, GraduationCap, Target } from "lucide-react";

export default function ExecutiveDashboard() {
  return (
    <div>
      <PageHeader title="Executive Dashboard" subtitle="Workforce intelligence overview" />
      <div className="p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Employees" value={8} subtitle="Across all departments" color="blue" />
          <StatCard icon={BarChart3} label="Avg. Readiness" value="72%" subtitle="Across target roles" color="green" trend={{ value: 4, direction: "up" }} />
          <StatCard icon={GraduationCap} label="Active Bootcamps" value={0} subtitle="In progress" color="amber" />
          <StatCard icon={Target} label="Open Roles" value={0} subtitle="Requiring placement" color="red" />
        </div>
      </div>
    </div>
  );
}
