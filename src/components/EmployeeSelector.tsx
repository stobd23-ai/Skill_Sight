import { useNavigate } from "react-router-dom";
import { useEmployees } from "@/hooks/useData";
import { PageHeader } from "@/components/PageHeader";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Card, CardContent } from "@/components/ui/card";
import { Users, ChevronRight } from "lucide-react";

interface EmployeeSelectorProps {
  title: string;
  subtitle: string;
  navigateTo: string;
}

export function EmployeeSelector({ title, subtitle, navigateTo }: EmployeeSelectorProps) {
  const navigate = useNavigate();
  const { data: employees, isLoading } = useEmployees();

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>
        ) : !employees?.length ? (
          <div className="text-center py-12">
            <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No employees found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {employees.map(emp => (
              <Card
                key={emp.id}
                className="cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => navigate(`${navigateTo}/${emp.id}`)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0"
                    style={{ backgroundColor: emp.avatar_color || 'hsl(213, 77%, 47%)' }}
                  >
                    {emp.avatar_initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{emp.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{emp.job_title} · {emp.department}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
