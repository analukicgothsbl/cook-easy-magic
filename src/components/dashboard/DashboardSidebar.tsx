import { 
  LayoutDashboard, 
  ChefHat, 
  BookOpen, 
  Heart, 
  Library, 
  CalendarDays, 
  Settings, 
  LogOut,
  Utensils,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import type { DashboardView } from '@/pages/Dashboard';

interface DashboardSidebarProps {
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
}

const mainMenuItems = [
  { id: 'overview' as const, title: 'Overview', icon: LayoutDashboard },
  { id: 'generate' as const, title: 'Generate New Recipe', icon: ChefHat },
  { id: 'my-recipes' as const, title: 'My Recipes', icon: BookOpen },
  { id: 'favorites' as const, title: 'Favorite Recipes', icon: Heart },
  { id: 'cookbook' as const, title: 'My Cook Book', icon: Utensils },
  { id: 'library' as const, title: 'Open Library', icon: Library },
  { id: 'meal-planner' as const, title: 'Meal Planner', icon: CalendarDays },
  { id: 'settings' as const, title: 'Settings', icon: Settings },
];

export function DashboardSidebar({ activeView, onViewChange }: DashboardSidebarProps) {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
    navigate('/');
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div 
          className="flex items-center gap-3 cursor-pointer" 
          onClick={() => navigate('/')}
        >
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <ChefHat className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-bold text-lg text-sidebar-foreground">Cook Master</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <div className={cn("flex items-center py-1", collapsed ? "justify-center px-0" : "justify-between px-2")}>
            {!collapsed && <SidebarGroupLabel className="p-0">Menu</SidebarGroupLabel>}
            <button
              onClick={toggleSidebar}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card shadow-sm hover:bg-accent transition-colors"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onViewChange(item.id)}
                    isActive={activeView === item.id}
                    tooltip={item.title}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && user && (
          <div className="mb-1 px-4 pt-3">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user.email}
            </p>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut} tooltip="Sign Out">
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
