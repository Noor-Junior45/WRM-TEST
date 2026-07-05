import React, { useState, useEffect, Suspense } from 'react';
import { Tab, User } from './types';
import { Package, ShoppingCart, Users, User as UserIcon, LayoutDashboard } from 'lucide-react';
import { supabase } from './services/supabase';
import { LoadingSpinner } from './components/UI';

// Pages
const Warehouse = React.lazy(() => import('./pages/Warehouse').then(m => ({ default: m.Warehouse })));
const POS = React.lazy(() => import('./pages/POS').then(m => ({ default: m.POS })));
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Customers = React.lazy(() => import('./pages/Customers').then(m => ({ default: m.Customers })));
const Profile = React.lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const Auth = React.lazy(() => import('./pages/Auth').then(m => ({ default: m.Auth })));
const PublicInvoice = React.lazy(() => import('./pages/PublicInvoice').then(m => ({ default: m.PublicInvoice })));
const CustomerPortal = React.lazy(() => import('./pages/CustomerPortal').then(m => ({ default: m.CustomerPortal })));

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const savedTab = localStorage.getItem('noor_active_tab');
    return (savedTab as Tab) || Tab.DASHBOARD;
  });
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [pendingAction, setPendingAction] = useState<string | undefined>(undefined);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isPublicMode, setIsPublicMode] = useState(false);

  // --- Browser/Gesture Back Navigation Logic ---
  useEffect(() => {
    // Handle popstate (Back/Forward buttons)
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.tab) {
        setActiveTab(event.state.tab as Tab);
        // Dispatch a custom event for sub-views (like CRM Profile or Warehouse Editor)
        // so they can decide whether to close themselves or let the tab change
        window.dispatchEvent(new CustomEvent('app-navigation-pop', { detail: event.state }));
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Initial history entry if none exists
    if (!window.history.state) {
      window.history.replaceState({ tab: activeTab, depth: 0 }, '');
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleTabChange = (newTab: Tab) => {
    if (newTab === activeTab) return;
    
    // Push new tab to history stack
    window.history.pushState({ tab: newTab, depth: 0 }, '');
    setActiveTab(newTab);
    localStorage.setItem('noor_active_tab', newTab);
  };

  useEffect(() => {
    if (currentUser && currentUser.role === 'staff') {
      const allowedTabs = [Tab.PROFILE];
      if (currentUser.staffRole === 'pos') {
        allowedTabs.push(Tab.POS);
      } else if (currentUser.staffRole === 'inventory') {
        allowedTabs.push(Tab.WAREHOUSE);
      }
      if (!allowedTabs.includes(activeTab)) {
        setActiveTab(allowedTabs[1] || Tab.PROFILE);
      }
    }
  }, [currentUser, activeTab]);

  useEffect(() => {
    if (window.location.pathname.startsWith('/invoice/') || window.location.pathname.startsWith('/c/')) {
        setIsPublicMode(true);
        setIsCheckingAuth(false);
        return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('access_mode') === 'crawler_granted') {
        const botUser: User = { id: 'adsense_bot', username: 'adsense_bot', name: 'Google Crawler', role: 'admin', pin: '' };
        setCurrentUser(botUser);
        setIsCheckingAuth(false);
        window.history.replaceState({}, document.title, "/");
        return;
    }

    // Safe onAuthStateChange - async work should be wrapped in IIFE to prevent deadlock
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Wrap in IIFE for safety - prevents deadlock if async work is added later
      (async () => {
        const supabaseUser = session?.user;
        if (supabaseUser) {
          const user: User = {
            id: supabaseUser.id,
            username: (supabaseUser.email || supabaseUser.id).split('@')[0],
            name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.username || (supabaseUser.email || supabaseUser.id).split('@')[0],
            role: 'admin',
            pin: '',
            photoURL: supabaseUser.user_metadata?.avatar_url || undefined
          };
          setCurrentUser(user);
          localStorage.setItem('noor_user_uid', supabaseUser.id);
          localStorage.removeItem('noor_staff_user');
        } else {
          const savedStaffStr = localStorage.getItem('noor_staff_user');
          if (savedStaffStr) {
            try {
              setCurrentUser(JSON.parse(savedStaffStr));
            } catch (e) {
              setCurrentUser(null);
              localStorage.removeItem('noor_user_uid');
            }
          } else {
            setCurrentUser(null);
            localStorage.removeItem('noor_user_uid');
          }
        }
        setIsCheckingAuth(false);
      })();
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const supabaseUser = session.user;
        const user: User = {
          id: supabaseUser.id,
          username: (supabaseUser.email || supabaseUser.id).split('@')[0],
          name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.username || (supabaseUser.email || supabaseUser.id).split('@')[0],
          role: 'admin',
          pin: '',
          photoURL: supabaseUser.user_metadata?.avatar_url || undefined
        };
        setCurrentUser(user);
        localStorage.setItem('noor_user_uid', supabaseUser.id);
        localStorage.removeItem('noor_staff_user');
      }
      setIsCheckingAuth(false);
    }).catch(() => {
      setIsCheckingAuth(false);
    });

    return () => {
      subscription?.unsubscribe();
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

  if (isCheckingAuth) return null;

  if (isPublicMode) {
      const isPortal = window.location.pathname.startsWith('/c/');
      return (
          <Suspense fallback={<div className="h-screen flex items-center justify-center"><LoadingSpinner/></div>}>
              {isPortal ? <CustomerPortal /> : <PublicInvoice />}
          </Suspense>
      );
  }

  if (!currentUser) {
      return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center"><LoadingSpinner/></div>}>
            <Auth onLogin={handleLogin} />
        </Suspense>
      );
  }

  const isStaff = currentUser?.role === 'staff';
  const staffRole = currentUser?.staffRole;

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
              {(showPOS || showDashboard || showCustomers) && <div className="w-px h-6 bg-gray-800/10 mx-1"></div>}
            </>
          )}

          {showPOS && (
            <>
              <button onClick={() => handleTabChange(Tab.POS)} className={`flex flex-col items-center gap-1 px-3 transition-all duration-300 ${activeTab === Tab.POS ? '' : 'text-gray-800'}`}>
                 <div className={`flex items-center justify-center transition-all duration-300 ${activeTab === Tab.POS ? 'bg-green-600 text-white w-14 h-14 rounded-full shadow-xl -mt-12 ring-4 ring-[#fdfdfc]' : 'bg-transparent text-gray-800 w-auto h-auto mt-0'}`}>
                    <ShoppingCart size={activeTab === Tab.POS ? 26 : 22} />
                </div>
                <span className={`text-[10px] font-bold tracking-wide ${activeTab === Tab.POS ? 'w-0 h-0 opacity-0' : 'opacity-100 mt-0.5'}`}>POS</span>
              </button>
              {(showDashboard || showCustomers) && <div className="w-px h-6 bg-gray-800/10 mx-1"></div>}
            </>
          )}

          {showDashboard && (
            <>
              <button onClick={() => handleTabChange(Tab.DASHBOARD)} className={`flex flex-col items-center gap-1 px-3 transition-all ${activeTab === Tab.DASHBOARD ? 'text-indigo-600 scale-105 font-bold' : 'text-gray-800'}`}>
                <LayoutDashboard size={22} />
                <span className="text-[10px] tracking-wide">Dash</span>
              </button>
              {showCustomers && <div className="w-px h-6 bg-gray-800/10 mx-1"></div>}
            </>
          )}

          {showCustomers && (
            <>
              <button onClick={() => handleTabChange(Tab.CUSTOMERS)} className={`flex flex-col items-center gap-1 px-3 transition-all ${activeTab === Tab.CUSTOMERS ? 'text-blue-600 scale-105 font-bold' : 'text-gray-800'}`}>
                <Users size={22} />
                <span className="text-[10px] tracking-wide">CRM</span>
              </button>
              <div className="w-px h-6 bg-gray-800/10 mx-1"></div>
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