import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { OverviewView } from '@/components/dashboard/OverviewView';
import { GenerateRecipeView } from '@/components/dashboard/GenerateRecipeView';
import { MyRecipesView } from '@/components/dashboard/MyRecipesView';
import { FavoriteRecipesView } from '@/components/dashboard/FavoriteRecipesView';
import { LibraryView } from '@/components/dashboard/LibraryView';
import { CookbookView } from '@/components/dashboard/CookbookView';
import { SettingsView } from '@/components/dashboard/SettingsView';
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
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCapturingPayment, setIsCapturingPayment] = useState(false);

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
            body: { orderId: token },
          });

          toast.dismiss(loadingToast);

          if (error || !data?.success) {
            toast.error('Payment confirmed, but credits were not added. Contact support.');
            console.error('PayPal capture error:', error || data?.error);
          } else {
            toast.success(`✅ ${data.credits} credits added!`);
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
        return <OverviewView onNavigate={setActiveView} />;
      case 'generate':
        return <GenerateRecipeView />;
      case 'my-recipes':
        return <MyRecipesView />;
      case 'favorites':
        return <FavoriteRecipesView />;
      case 'library':
        return <LibraryView />;
      case 'settings':
        return <SettingsView />;
      case 'cookbook':
        return <CookbookView />;
      case 'meal-planner':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8">
              <p className="text-muted-foreground">Coming soon...</p>
            </div>
          </div>
        );
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
            <SidebarTrigger className="mr-4" />
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
