import React, { useState, useEffect, Suspense } from 'react';
import { Tab, User } from './types';
import { Package, ShoppingCart, Users, User as UserIcon, LayoutDashboard } from 'lucide-react';
import { supabase } from './services/firebase';
import { LoadingSpinner } from './components/UI';

const Warehouse = React.lazy(() => import('./pages/Warehouse').then(m => ({ default: m.Warehouse })));
const POS = React.lazy(() => import('./pages/POS').then(m => ({ default: m.POS })));
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Customers = React.lazy(() => import('./pages/Customers').then(m => ({ default: m.Customers })));
const Profile = React.lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const Auth = React.lazy(() => import('./pages/Auth').then(m => ({ default: m.Auth })));
const PublicInvoice = React.lazy(() => import('./pages/PublicInvoice').then(m => ({ default: m.PublicInvoice })));
const CustomerPortal = React.lazy(() => import('./pages/CustomerPortal').then(m => ({ default: m.CustomerPortal })));

const userFromSession = (supabaseUser: any): User => ({
  id: supabaseUser.id,
  username: (supabaseUser.email || supabaseUser.id).split('@')[0],
  name: supabaseUser.user_metadata?.display_name || (supabaseUser.email || supabaseUser.id).split('@')[0],
  role: 'admin',
  pin: '',
  photoURL: supabaseUser.user_metadata?.avatar_url || undefined,
});

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    return (localStorage.getItem('noor_active_tab') as Tab) || Tab.DASHBOARD;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [pendingAction, setPendingAction] = useState<string | undefined>(undefined);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isPublicMode, setIsPublicMode] = useState(false);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.tab) {
        setActiveTab(event.state.tab as Tab);
        window.dispatchEvent(new CustomEvent('app-navigation-pop', { detail: event.state }));
      }
    };
    window.addEventListener('popstate', handlePopState);
    if (!window.history.state) {
      window.history.replaceState({ tab: activeTab, depth: 0 }, '');
    }
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleTabChange = (newTab: Tab) => {
    if (newTab === activeTab) return;
    window.history.pushState({ tab: newTab, depth: 0 }, '');
    setActiveTab(newTab);
    localStorage.setItem('noor_active_tab', newTab);
  };

  useEffect(() => {
    if (currentUser?.role === 'staff') {
      const allowed = [Tab.PROFILE];
      if (currentUser.staffRole === 'pos') allowed.push(Tab.POS);
      else if (currentUser.staffRole === 'inventory') allowed.push(Tab.WAREHOUSE);
      if (!allowed.includes(activeTab)) setActiveTab(allowed[1] || Tab.PROFILE);
    }
  }, [currentUser, activeTab]);

  useEffect(() => {
    // Handle public routes immediately — no auth needed
    if (window.location.pathname.startsWith('/invoice/') || window.location.pathname.startsWith('/c/')) {
      setIsPublicMode(true);
      setIsCheckingAuth(false);
      return;
    }

    // Crawler bot bypass
    const params = new URLSearchParams(window.location.search);
    if (params.get('access_mode') === 'crawler_granted') {
      setCurrentUser({ id: 'adsense_bot', username: 'adsense_bot', name: 'Google Crawler', role: 'admin', pin: '' });
      setIsCheckingAuth(false);
      window.history.replaceState({}, document.title, '/');
      return;
    }

    // Hard timeout — never stay in loading state longer than 4 seconds
    const timeout = setTimeout(() => {
      setIsCheckingAuth(prev => {
        if (prev) {
          // Still loading after 4s — check localStorage for staff, else show login
          const savedStaff = localStorage.getItem('noor_staff_user');
          if (savedStaff) {
            try { setCurrentUser(JSON.parse(savedStaff)); } catch { /* noop */ }
          }
        }
        return false;
      });
    }, 4000);

    // onAuthStateChange fires immediately with INITIAL_SESSION event — no need for getSession()
    let resolved = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
      }

      if (session?.user) {
        setCurrentUser(userFromSession(session.user));
        localStorage.setItem('noor_user_uid', session.user.id);
        localStorage.removeItem('noor_staff_user');
      } else {
        const savedStaff = localStorage.getItem('noor_staff_user');
        if (savedStaff) {
          try {
            setCurrentUser(JSON.parse(savedStaff));
          } catch {
            setCurrentUser(null);
            localStorage.removeItem('noor_user_uid');
          }
        } else {
          setCurrentUser(null);
          localStorage.removeItem('noor_user_uid');
        }
      }

      setIsCheckingAuth(false);
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = (user: User) => setCurrentUser(user);

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('noor_active_tab');
    localStorage.removeItem('noor_user_uid');
    localStorage.removeItem('noor_staff_user');
  };

  const handleNavigate = (tab: Tab, action?: string) => {
    handleTabChange(tab);
    if (action) setPendingAction(action);
  };

  if (isCheckingAuth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, border: '4px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (isPublicMode) {
    const isPortal = window.location.pathname.startsWith('/c/');
    return (
      <Suspense fallback={<div className="h-screen flex items-center justify-center"><LoadingSpinner /></div>}>
        {isPortal ? <CustomerPortal /> : <PublicInvoice />}
      </Suspense>
    );
  }

  if (!currentUser) {
    return (
      <Suspense fallback={<div className="h-screen flex items-center justify-center"><LoadingSpinner /></div>}>
        <Auth onLogin={handleLogin} />
      </Suspense>
    );
  }

  const isStaff = currentUser.role === 'staff';
  const staffRole = currentUser.staffRole;
  const showWarehouse = !isStaff || staffRole === 'inventory';
  const showPOS = !isStaff || staffRole === 'pos';
  const showDashboard = !isStaff;
  const showCustomers = !isStaff;

  return (
    <div className="min-h-screen bg-[#fdfdfc] text-gray-800 selection:bg-yellow-500/30">
      <main className={`${activeTab === Tab.WAREHOUSE ? 'pb-28 md:pb-32' : 'p-4 md:p-6 pb-28 md:pb-32'} w-full max-w-[1920px] mx-auto min-h-screen`}>
        <Suspense fallback={<LoadingSpinner />}>
          {activeTab === Tab.WAREHOUSE && <Warehouse initialAction={pendingAction} onClearAction={() => setPendingAction(undefined)} />}
          {activeTab === Tab.POS && <POS />}
          {activeTab === Tab.DASHBOARD && <Dashboard onNavigate={handleNavigate} />}
          {activeTab === Tab.CUSTOMERS && <Customers initialAction={pendingAction} onClearAction={() => setPendingAction(undefined)} />}
          {activeTab === Tab.PROFILE && <Profile user={currentUser} onLogin={handleLogin} onLogout={handleLogout} />}
        </Suspense>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 z-40 flex justify-center pointer-events-none">
        <nav className="pointer-events-auto rounded-full px-5 py-3 flex gap-1 items-center shadow-[0_20px_50px_rgba(8,_112,_184,_0.1)] ring-1 ring-white/50 bg-white/40 backdrop-blur-3xl border border-white/80">
          {showWarehouse && (
            <>
              <button onClick={() => handleTabChange(Tab.WAREHOUSE)} className={`flex flex-col items-center gap-1 px-3 transition-all ${activeTab === Tab.WAREHOUSE ? 'text-yellow-600 scale-105 font-bold' : 'text-gray-800'}`}>
                <Package size={22} />
                <span className="text-[10px] tracking-wide">Stock</span>
              </button>
              {(showPOS || showDashboard || showCustomers) && <div className="w-px h-6 bg-gray-800/10 mx-1" />}
            </>
          )}

          {showPOS && (
            <>
              <button onClick={() => handleTabChange(Tab.POS)} className={`flex flex-col items-center gap-1 px-3 transition-all duration-300 ${activeTab === Tab.POS ? '' : 'text-gray-800'}`}>
                <div className={`flex items-center justify-center transition-all duration-300 ${activeTab === Tab.POS ? 'bg-green-600 text-white w-14 h-14 rounded-full shadow-xl -mt-12 ring-4 ring-[#fdfdfc]' : 'bg-transparent text-gray-800'}`}>
                  <ShoppingCart size={activeTab === Tab.POS ? 26 : 22} />
                </div>
                <span className={`text-[10px] font-bold tracking-wide ${activeTab === Tab.POS ? 'opacity-0 h-0' : 'opacity-100 mt-0.5'}`}>POS</span>
              </button>
              {(showDashboard || showCustomers) && <div className="w-px h-6 bg-gray-800/10 mx-1" />}
            </>
          )}

          {showDashboard && (
            <>
              <button onClick={() => handleTabChange(Tab.DASHBOARD)} className={`flex flex-col items-center gap-1 px-3 transition-all ${activeTab === Tab.DASHBOARD ? 'text-indigo-600 scale-105 font-bold' : 'text-gray-800'}`}>
                <LayoutDashboard size={22} />
                <span className="text-[10px] tracking-wide">Dash</span>
              </button>
              {showCustomers && <div className="w-px h-6 bg-gray-800/10 mx-1" />}
            </>
          )}

          {showCustomers && (
            <>
              <button onClick={() => handleTabChange(Tab.CUSTOMERS)} className={`flex flex-col items-center gap-1 px-3 transition-all ${activeTab === Tab.CUSTOMERS ? 'text-blue-600 scale-105 font-bold' : 'text-gray-800'}`}>
                <Users size={22} />
                <span className="text-[10px] tracking-wide">CRM</span>
              </button>
              <div className="w-px h-6 bg-gray-800/10 mx-1" />
            </>
          )}

          <button onClick={() => handleTabChange(Tab.PROFILE)} className={`flex flex-col items-center gap-1 px-3 transition-all ${activeTab === Tab.PROFILE ? 'text-purple-600 scale-105 font-bold' : 'text-gray-800'}`}>
            <UserIcon size={22} />
            <span className="text-[10px] tracking-wide">Profile</span>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default App;
