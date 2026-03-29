import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, ChevronDown, LogOut, Settings } from "lucide-react";

const routeNames: Record<string, string> = {
  "/dashboard": "Executive Dashboard",
  "/employees": "People",
  "/analysis": "Analysis",
  "/interview/employee": "Employee Interview",
  "/interview/manager": "Manager Interview",
  "/reorg": "Organization",
  "/succession": "Succession Board",
  "/roles": "Roles Manager",
  
  "/my-profile": "My Profile",
  "/my-interview": "My Interview",
  "/my-analysis": "My Results",
};

export function TopBar() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!profile) return null;

  // Main sections where no back button should appear
  const mainSections = ["/dashboard", "/employees", "/reorg", "/succession", "/roles", "/my-profile", "/my-interview", "/my-analysis"];
  const isMainSection = mainSections.some(path => location.pathname === path);
  const canGoBack = location.key !== "default" && !isMainSection;

  // Smart back navigation: preserve tab context
  const handleBack = () => {
    // If we're on an external candidate page, go back to external tab
    if (location.pathname.startsWith("/external-candidate") || location.pathname.startsWith("/analysis-external")) {
      navigate("/employees?tab=external");
      return;
    }
    navigate(-1);
  };

  const isManager = profile.role === "manager";
  const initials = profile.full_name
    ? profile.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "??";

  // Find matching route name
  const currentRoute = Object.entries(routeNames).find(([path]) =>
    location.pathname.startsWith(path)
  );
  const pageName = currentRoute?.[1] || "SkillSight";

  return (
    <div className="h-12 border-b border-border bg-background px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2">
        {canGoBack && (
          <button
            onClick={handleBack}
            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <span className="text-sm font-medium text-foreground">{pageName}</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 outline-none">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ backgroundColor: isManager ? "#1c69d3" : "#6b7280" }}
          >
            {initials}
          </div>
          <span className="text-[13px] font-medium text-foreground hidden sm:inline">
            {profile.full_name}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              isManager
                ? "bg-primary/10 text-primary"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {isManager ? "Manager" : "Employee"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem disabled>
            <Settings className="h-3.5 w-3.5 mr-2" />
            Account Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => signOut()}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5 mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
