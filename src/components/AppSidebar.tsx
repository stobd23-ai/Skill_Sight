import {
  LayoutDashboard,
  Users,
  MessageSquare,
  UserCheck,
  BarChart3,
  
  Target,
  Shuffle,
  Network,
  Briefcase,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navSections = [
  {
    label: "OVERVIEW",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Employees", url: "/employees", icon: Users },
    ],
  },
  {
    label: "PLANNING",
    items: [
      { title: "Internal Reorg", url: "/reorg", icon: Shuffle },
      { title: "Succession", url: "/succession", icon: Network },
      { title: "Roles", url: "/roles", icon: Briefcase },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent className="pt-5">
        {/* Logo */}
        <div className="px-4 pb-4 mb-2">
          {!collapsed && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-bmw-blue flex items-center justify-center">
                  <span className="text-xs font-bold text-white">BMW</span>
                </div>
                <div>
                  <h1 className="text-sm font-bold leading-tight">SkillSight</h1>
                  <p className="text-[11px] text-muted-foreground">BMW Group</p>
                </div>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-bmw-blue flex items-center justify-center mx-auto">
              <span className="text-[8px] font-bold text-white">BMW</span>
            </div>
          )}
        </div>

        {navSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest text-muted-foreground px-4">
              {!collapsed && section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                    >
                      <NavLink
                        to={item.url}
                        end={false}
                        className="transition-colors duration-150"
                        activeClassName="bg-bmw-blue/[0.06] text-bmw-blue font-medium"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="text-[13px]">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {/* Footer */}
        {!collapsed && (
          <div className="mt-auto px-4 pb-4 pt-6">
            <p className="text-[10px] text-muted-foreground">Workforce Intelligence Platform</p>
            <p className="text-[10px] text-muted-foreground font-mono">v1.0.0</p>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
