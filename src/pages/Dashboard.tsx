import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { OverviewView } from '@/components/dashboard/OverviewView';
import { GenerateRecipeView } from '@/components/dashboard/GenerateRecipeView';
import { MyRecipesView } from '@/components/dashboard/MyRecipesView';
import { FavoriteRecipesView } from '@/components/dashboard/FavoriteRecipesView';
import { LibraryView } from '@/components/dashboard/LibraryView';
import { CookbookView } from '@/components/dashboard/CookbookView';
import { SettingsView } from '@/components/dashboard/SettingsView';
import { MealPlannerView } from '@/components/dashboard/MealPlannerView';
import { Loader2 } from 'lucide-react';

export type DashboardView = 
  | 'overview' 
  | 'generate' 
  | 'my-recipes' 
  | 'favorites' 
  | 'cookbook' 
  | 'library' 
  | 'meal-planner' 
  | 'settings';

const Dashboard = () => {
  const [activeView, setActiveView] = useState<DashboardView>('overview');
  const [settingsTab, setSettingsTab] = useState<string | null>(null);
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCapturingPayment, setIsCapturingPayment] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Handle navigation state (e.g., from RecipeCard "Buy credits" button)
  useEffect(() => {
    const state = location.state as { view?: DashboardView; settingsTab?: string } | null;
    if (state?.view) {
      setActiveView(state.view);
      if (state.settingsTab) {
        setSettingsTab(state.settingsTab);
      }
      // Clear the state to prevent re-triggering on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  // Handle PayPal return with token
  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token && user && !isCapturingPayment) {
      setIsCapturingPayment(true);
      
      const capturePayment = async () => {
        const loadingToast = toast.loading('Confirming PayPal payment…');
        
        try {
          const { data, error } = await supabase.functions.invoke('paypal-capture-order', {
            body: { order_id: token },
          });

          toast.dismiss(loadingToast);

          if (error || !data?.success) {
            toast.error('Payment confirmed, but credits were not added. Contact support.');
            console.error('PayPal capture error:', error || data?.error);
          } else {
            toast.success(`✅ ${data.credits} credits added!`);
            setRefreshKey((k) => k + 1); // Trigger data refresh
          }
        } catch (err) {
          toast.dismiss(loadingToast);
          toast.error('Payment confirmed, but credits were not added. Contact support.');
          console.error('PayPal capture exception:', err);
        } finally {
          // Clean URL by removing query params
          setSearchParams({});
          setIsCapturingPayment(false);
        }
      };

      capturePayment();
    }
  }, [searchParams, user, isCapturingPayment, setSearchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const renderView = () => {
    switch (activeView) {
      case 'overview':
        return <OverviewView onNavigate={setActiveView} refreshKey={refreshKey} />;
      case 'generate':
        return <GenerateRecipeView />;
      case 'my-recipes':
        return <MyRecipesView />;
      case 'favorites':
        return <FavoriteRecipesView />;
      case 'library':
        return <LibraryView />;
      case 'settings':
        return <SettingsView initialTab={settingsTab} onTabChange={() => setSettingsTab(null)} />;
      case 'cookbook':
        return <CookbookView />;
      case 'meal-planner':
        return <MealPlannerView />;
      default:
        return <OverviewView onNavigate={setActiveView} />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar activeView={activeView} onViewChange={setActiveView} />
        <main className="flex-1 flex flex-col min-h-screen">
          <header className="h-14 flex items-center border-b border-border px-4 bg-card">
            <h1 className="text-lg font-semibold text-foreground capitalize">
              {activeView.replace('-', ' ').replace('settings ', '')}
            </h1>
          </header>
          <div className="flex-1 overflow-auto">
            {renderView()}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
