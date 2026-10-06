import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster as SonnerToaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConfigScreen, DashboardPage, FoodDetailsPage, FoodFormPage, InventoryPage, LandingPage, AuthPage, NotificationsPage, AnalyticsPage, SettingsPage, ProfilePage, NotFoundPage } from '@/pages/pages';
import { SessionProvider, useSession } from '@/lib/session';
import { supabaseConfigured } from '@/lib/supabase';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { useEffect } from 'react';
import { LoadingBlock } from '@/components/fresh-ui';
import { useGenerateExpiryReminders } from '@/hooks/use-freshtrack';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

function Private({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  const [, setLocation] = useLocation();
  useGenerateExpiryReminders();
  useEffect(() => { if (!loading && !user) setLocation('/login'); }, [loading, user, setLocation]);
  if (loading || !user) return <div className="route-loading"><LoadingBlock rows={3}/></div>;
  return <>{children}</>;
}
function PrivatePage({ children }: { children: ReactNode }) {
  return <Private>{children}</Private>;
}
function Router() {
  const [location] = useLocation();
  if (!supabaseConfigured && location !== '/') return <ConfigScreen/>;
  return <RoutedErrorBoundary>
    <Switch>
      <Route path="/" component={LandingPage}/>
      <Route path="/login"><AuthPage mode="login"/></Route>
      <Route path="/signup"><AuthPage mode="signup"/></Route>
      <Route path="/forgot-password"><AuthPage mode="forgot"/></Route>
      <Route path="/reset-password"><AuthPage mode="reset"/></Route>
      <Route path="/dashboard"><PrivatePage><DashboardPage/></PrivatePage></Route>
      <Route path="/inventory"><PrivatePage><InventoryPage/></PrivatePage></Route>
      <Route path="/inventory/add"><PrivatePage><FoodFormPage/></PrivatePage></Route>
      <Route path="/inventory/:id/edit"><PrivatePage><FoodFormPage editing/></PrivatePage></Route>
      <Route path="/inventory/:id"><PrivatePage><FoodDetailsPage/></PrivatePage></Route>
      <Route path="/expiring"><PrivatePage><InventoryPage expiringOnly/></PrivatePage></Route>
      <Route path="/notifications"><PrivatePage><NotificationsPage/></PrivatePage></Route>
      <Route path="/analytics"><PrivatePage><AnalyticsPage/></PrivatePage></Route>
      <Route path="/settings"><PrivatePage><SettingsPage/></PrivatePage></Route>
      <Route path="/profile"><PrivatePage><ProfilePage/></PrivatePage></Route>
      <Route component={NotFoundPage}/>
    </Switch>
  </RoutedErrorBoundary>;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><SessionProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router/></WouterRouter><SonnerToaster position="top-right" richColors/></SessionProvider></TooltipProvider></QueryClientProvider>;
}
export default App;
