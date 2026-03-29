import { User, MessageSquare, BarChart3 } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import bmwLogo from "@/assets/bmw_logo.svg";

const employeeNavItems = [
  { title: "My Profile", url: "/my-profile", icon: User },
  { title: "My Interview", url: "/my-interview", icon: MessageSquare },
  { title: "My Results", url: "/my-analysis", icon: BarChart3 },
];

export function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Narrow sidebar */}
      <div className="w-[200px] border-r border-border bg-background flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-4 pt-5 pb-4 mb-2">
          <div className="flex items-center gap-2">
            <img src={bmwLogo} alt="BMW" className="w-7 h-7 rounded-lg" />
            <div>
              <h1 className="text-sm font-bold leading-tight">SkillSight</h1>
              <p className="text-[10px] text-muted-foreground">My Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 space-y-1">
          {employeeNavItems.map(item => {
            const active = location.pathname === item.url;
            return (
              <NavLink
                key={item.url}
                to={item.url}
                end
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors ${
                  active
                    ? "bg-primary/[0.06] text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="px-4 pb-4 pt-6">
          <p className="text-[10px] text-muted-foreground">Powered by SkillSight</p>
          <p className="text-[10px] text-muted-foreground">BMW Group</p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
