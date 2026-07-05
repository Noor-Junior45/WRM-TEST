import React, { useState } from 'react';
import { User } from '../types';
import { supabase } from '../services/supabase';
import { StoreService } from '../services/storeService';
import {
  Loader2,
  AlertTriangle,
  User as UserIcon,
  Mail,
  Lock,
  ShieldCheck,
  ArrowRight,
  Store,
  MapPin,
  Phone,
  Check
} from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  // Navigation & Form Views
  const [selectedRole, setSelectedRole] = useState<'admin' | 'staff' | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);

  // Auth Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Staff Login Fields
  const [staffId, setStaffId] = useState('');
  const [staffPin, setStaffPin] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  
  // Onboarding Wizard Fields
  const [onboardingUser, setOnboardingUser] = useState<User | null>(null);
  const [shopName, setShopName] = useState('');
  const [shopCategory, setShopCategory] = useState('general');
  const [shopLocation, setShopLocation] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [shopEmail, setShopEmail] = useState('');

  // Status State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    const testSupabase = async () => {
      try {
        const { error } = await supabase.from('settings').select('*').limit(1);
        if (error) {
          const errMsg = error.message || '';
          if (errMsg.toLowerCase().includes('suspended') || errMsg.toLowerCase().includes('permission')) {
            setError('Cloud service is temporarily suspended. Please use the "Run Sandbox Demo Mode" button below to access your local offline database.');
          }
        }
      } catch (e: any) {
        const errMsg = e?.message || String(e);
        if (errMsg.toLowerCase().includes('suspended') || errMsg.toLowerCase().includes('permission')) {
          setError('Cloud service is temporarily suspended. Please use the "Run Sandbox Demo Mode" button below to access your local offline database.');
        }
      }
    };
    testSupabase();
  }, []);

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId || !staffPin) {
      setError('Please enter both your Staff ID and PIN.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await StoreService.loginStaff(adminEmail.trim(), staffId.trim(), staffPin.trim());
      if (result) {
        localStorage.setItem('noor_user_uid', result.adminUid);
        const staffUser: User = {
          id: result.staff.id,
          name: result.staff.name,
          username: result.staff.id,
          pin: result.staff.pin,
          role: 'staff',
          staffRole: result.staff.role
        };
        localStorage.setItem('noor_staff_user', JSON.stringify(staffUser));
        onLogin(staffUser);
      } else {
        setError('Verification failed. Invalid Staff ID/PIN combination or Admin email mismatch.');
      }
    } catch (err: any) {
      setError('Staff login failed: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // Check if settings already exist in Supabase for this uid
  const checkIfNewUser = async (uid: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.from('settings').select('*').eq('user_id', uid);
      if (error) throw error;
      return !data || data.length === 0;
    } catch (err) {
      console.error('Error checking new user settings:', err);
      return false; // Safe default
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (isSignUp && !name) {
      setError('Please enter your name to register.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              name: name.trim()
            }
          }
        });
        if (error) throw error;
        
        const supabaseUser = data.user;
        if (!supabaseUser) throw new Error('Failed to retrieve user after sign up.');
        
        const user: User = {
          id: supabaseUser.id,
          username: (supabaseUser.email || '').split('@')[0],
          name: name.trim(),
          role: 'admin',
          pin: ''
        };
        // Prefill onboarding fields
        setShopName(`${name.trim()}'s Warehouse`);
        setShopEmail(email.trim());
        setOnboardingUser(user);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (error) throw error;

        const supabaseUser = data?.user;
        if (!supabaseUser) throw new Error('No user returned from login.');

        const user: User = {
          id: supabaseUser.id,
          username: (supabaseUser.email || '').split('@')[0],
          name: supabaseUser.user_metadata?.name || (supabaseUser.email || '').split('@')[0],
          role: 'admin',
          pin: '',
          photoURL: supabaseUser.user_metadata?.avatar_url || undefined
        };
        const isNew = await checkIfNewUser(supabaseUser.id);
        if (isNew) {
          setShopName(user.name ? `${user.name}'s Warehouse` : 'My Warehouse');
          setShopEmail(email.trim());
          setOnboardingUser(user);
        } else {
          onLogin(user);
        }
      }
    } catch (err: any) {
      console.error(err);
      let msg = 'Authentication failed. Please check your credentials.';
      const errMsg = err.message || '';
      if (errMsg.toLowerCase().includes('suspended') || errMsg.toLowerCase().includes('permission')) {
        msg = 'Cloud service is temporarily suspended. Please use the "Run Sandbox Demo Mode" button below to access your local offline database.';
      } else if (err.status === 400 || errMsg.includes('Invalid login credentials')) {
        msg = 'Incorrect email or password. Please try again.';
      } else if (errMsg.includes('User already registered')) {
        msg = 'This email is already registered. Please sign in instead.';
      } else if (errMsg.includes('Password should be at least')) {
        msg = 'Password is too weak. Please use at least 6 characters.';
      } else if (errMsg.includes('valid email')) {
        msg = 'Please enter a valid email address.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOnboarding = async (skip: boolean = false) => {
    if (!onboardingUser) return;
    setLoading(true);
    setError('');
    
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const uid = session?.user?.id || onboardingUser.id;
      const settingsId = Math.random().toString(36).substring(2, 9);
      
      const customSettings = {
        storeName: skip ? (onboardingUser.name ? `${onboardingUser.name}'s Warehouse` : 'My Warehouse') : (shopName || 'My Warehouse'),
        storeAddress: skip ? '' : shopLocation,
        storePhone: skip ? '' : shopPhone,
        storeEmail: skip ? (onboardingUser.id.includes('@') ? onboardingUser.id : '') : shopEmail,
        logo: onboardingUser.photoURL || '',
        expiryAlertDays: 7,
        lowStockDefault: 10,
        soundEnabled: true,
        notificationsEnabled: false,
        currencySymbol: '₹',
        recycleBinRetentionDays: 30,
        directPrintEnabled: false,
        scannerPreference: 'both',
        nasUrl: '',
        syncToNas: false,
        warehouseType: skip ? 'general' : shopCategory,
        salesTarget: 50000,
        receiptHeader: 'Thank you for your business!',
        receiptFooter: 'Please visit us again!',
        showLogoOnReceipt: true,
        taxRateDefault: 18
      };

      // Always write to local storage first so that custom settings are immediately saved offline
      try {
        const LS_BACKUP_KEY = 'noor_offline_store_v1';
        const local = localStorage.getItem(LS_BACKUP_KEY);
        const currentData = local ? JSON.parse(local) : {
          products: [],
          tags: [],
          sales: [],
          customers: [],
          users: [],
          deletedItems: [],
          settings: {}
        };
        currentData.settings = {
          ...currentData.settings,
          ...customSettings
        };
        localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(currentData));
        localStorage.setItem('noor_last_sync', new Date().toISOString());
        localStorage.setItem('noor_user_uid', uid);
      } catch (localErr) {
        console.warn("Failed to write onboarding settings to local storage fallback:", localErr);
      }

      // Try writing to Supabase settings table but do not block the user if it fails
      try {
        const { error } = await supabase.from('settings').upsert({
          id: settingsId,
          user_id: uid,
          store_name: customSettings.storeName,
          store_address: customSettings.storeAddress,
          store_phone: customSettings.storePhone,
          store_email: customSettings.storeEmail,
          logo: customSettings.logo,
          warehouse_type: customSettings.warehouseType,
          expiry_alert_days: customSettings.expiryAlertDays,
          low_stock_default: customSettings.lowStockDefault,
          sound_enabled: customSettings.soundEnabled,
          notifications_enabled: customSettings.notificationsEnabled,
          currency_symbol: customSettings.currencySymbol,
          recycle_bin_retention_days: customSettings.recycle_bin_retention_days,
          direct_print_enabled: customSettings.direct_print_enabled,
          scanner_preference: customSettings.scanner_preference,
          nas_url: customSettings.nasUrl,
          sync_to_nas: customSettings.sync_to_nas,
          sales_target: customSettings.salesTarget,
          receipt_header: customSettings.receiptHeader,
          receipt_footer: customSettings.receiptFooter,
          show_logo_on_receipt: customSettings.showLogoOnReceipt,
          tax_rate_default: customSettings.taxRateDefault,
        });
        if (error) {
          console.warn("Supabase settings upsert failed (will continue using offline local storage):", error.message);
        }
      } catch (cloudErr: any) {
        console.warn("Could not reach cloud database during onboarding (will continue using offline local storage):", cloudErr.message || cloudErr);
      }
      
      // Continue to application
      onLogin(onboardingUser);
    } catch (err: any) {
      console.error("Critical onboarding error, continuing with local fallback:", err);
      onLogin(onboardingUser);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    const guestUser: User = {
      id: 'guest_user',
      username: 'guest',
      name: 'Guest Administrator',
      role: 'admin',
      pin: ''
    };
    onLogin(guestUser);
  };

  // --- RENDERING ONBOARDING WIZARD ---
  if (onboardingUser) {
    return (
      <div className="min-h-screen flex flex-col justify-center bg-zinc-950 p-6 font-sans">
        <div className="w-full max-w-[500px] mx-auto animate-in fade-in duration-300">
          <div className="text-center mb-8">
            <span className="inline-flex p-3 bg-zinc-900 rounded-2xl text-[#3ecf8e] mb-3 border border-zinc-800">
              <Store size={32} className="animate-pulse" />
            </span>
            <h1 className="text-3xl font-extrabold text-zinc-100 tracking-tight">Configure Your Warehouse</h1>
            <p className="text-zinc-400 mt-2 text-sm font-medium">Configure store settings to suit your inventory</p>
          </div>

          <div className="bg-zinc-900 rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] p-8 border border-zinc-800">
            <div className="space-y-5">
              
              {/* Warehouse Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Warehouse / Shop Name</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                    <Store size={18} />
                  </span>
                  <input
                    type="text"
                    placeholder="E.g. Noor Enterprise"
                    value={shopName}
                    onChange={e => setShopName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl font-medium outline-none text-sm text-zinc-100 placeholder-zinc-500 transition-colors"
                  />
                </div>
              </div>

              {/* Warehouse Type / Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Warehouse Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'general', label: 'General / Hardware' },
                    { id: 'pharma', label: 'Pharmaceuticals' },
                    { id: 'grocery', label: 'Grocery / Foods' },
                    { id: 'electronics', label: 'Electronics & Tech' },
                    { id: 'clothing', label: 'Clothing & Apparel' }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setShopCategory(cat.id)}
                      className={`py-2.5 px-3 rounded-xl text-left border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                        shopCategory === cat.id 
                          ? 'border-[#3ecf8e] bg-emerald-500/10 text-emerald-400' 
                          : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      <span>{cat.label}</span>
                      {shopCategory === cat.id && <Check size={14} className="text-[#3ecf8e]" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Location / Address</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                    <MapPin size={18} />
                  </span>
                  <input
                    type="text"
                    placeholder="City, Country"
                    value={shopLocation}
                    onChange={e => setShopLocation(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl font-medium outline-none text-sm text-zinc-100 placeholder-zinc-500 transition-colors"
                  />
                </div>
              </div>

              {/* Basic details: Phone & Email */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Phone Number</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                      <Phone size={16} />
                    </span>
                    <input
                      type="text"
                      placeholder="+91 XXXXX XXXXX"
                      value={shopPhone}
                      onChange={e => setShopPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl font-medium outline-none text-xs text-zinc-100 placeholder-zinc-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Store Contact Email</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                      <Mail size={16} />
                    </span>
                    <input
                      type="email"
                      placeholder="store@email.com"
                      value={shopEmail}
                      onChange={e => setShopEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl font-medium outline-none text-xs text-zinc-100 placeholder-zinc-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-950/40 text-red-400 text-xs font-medium border border-red-900 rounded-xl flex items-start gap-2 leading-relaxed">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => handleCompleteOnboarding(true)}
                  disabled={loading}
                  className="flex-1 py-3 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 font-bold rounded-xl transition-all border border-zinc-800 text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Skip Setup</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCompleteOnboarding(false)}
                  disabled={loading}
                  className="flex-1 bg-[#3ecf8e] hover:bg-[#3ecf8e]/90 text-zinc-950 font-bold py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 border-0 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin text-zinc-950" />
                  ) : (
                    <>
                      <span>Complete Setup</span>
                      <Check size={16} />
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDERING GENERAL AUTHENTICATION ---
  return (
    <div className="min-h-screen flex flex-col justify-center bg-zinc-950 p-6 font-sans">
      <div className="w-full max-w-[420px] mx-auto animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-8 animate-in slide-in-from-top-4 duration-500">
          <img 
            src="https://lh3.googleusercontent.com/p/AF1QipPlp0QUwcp2FOnTGiGNf5fqWnskinCj4QxRKa3o=s1360-w1360-h1020-rw" 
            alt="Noor POS Logo" 
            className="w-16 h-16 rounded-full shadow-2xl mx-auto mb-4 border border-zinc-800 object-cover"
          />
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center justify-center gap-2">
            Noor Warehouse
          </h1>
          <p className="text-zinc-400 mt-1.5 text-xs font-medium">Cloud-based Enterprise Warehouse System</p>
        </div>

        <div className="bg-[#18181b] rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] p-6 md:p-8 border border-zinc-800/80">
          
          {/* Supabase-style Tabs for Admin and Staff Login */}
          <div className="flex border-b border-zinc-800 mb-6">
            <button
              type="button"
              onClick={() => { setSelectedRole('admin'); setError(''); }}
              className={`flex-1 pb-3 text-sm font-semibold text-center border-b-2 transition-all cursor-pointer ${
                selectedRole === 'admin' || selectedRole === null
                  ? 'border-[#3ecf8e] text-[#3ecf8e]'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Admin Portal
            </button>
            <button
              type="button"
              onClick={() => { setSelectedRole('staff'); setError(''); }}
              className={`flex-1 pb-3 text-sm font-semibold text-center border-b-2 transition-all cursor-pointer ${
                selectedRole === 'staff'
                  ? 'border-[#3ecf8e] text-[#3ecf8e]'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Staff Portal
            </button>
          </div>

          {selectedRole === 'staff' ? (
            /* --- STAFF LOGIN VIEW --- */
            <div>
              <div className="text-center mb-5">
                <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-widest">Staff Sign In</h2>
                <p className="text-xs text-zinc-500 mt-1">Access using your credentials and assigned PIN</p>
              </div>

              <form onSubmit={handleStaffLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Admin's Email / User ID</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                      <Mail size={18} />
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. admin@example.com"
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-zinc-900/50 border border-zinc-800 focus:border-[#3ecf8e] rounded-xl font-medium outline-none text-sm text-zinc-100 placeholder-zinc-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Staff Unique ID No.</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                      <UserIcon size={18} />
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. 1001"
                      value={staffId}
                      onChange={e => setStaffId(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-zinc-900/50 border border-zinc-800 focus:border-[#3ecf8e] rounded-xl font-medium outline-none text-sm text-zinc-100 placeholder-zinc-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Enter PIN</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                      <Lock size={18} />
                    </span>
                    <input
                      type="password"
                      placeholder="••••"
                      maxLength={6}
                      value={staffPin}
                      onChange={e => setStaffPin(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-zinc-900/50 border border-zinc-800 focus:border-[#3ecf8e] rounded-xl font-medium outline-none text-sm text-zinc-100 placeholder-zinc-500 transition-all text-center tracking-widest font-black"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-950/40 text-red-400 text-xs font-medium border border-red-900 rounded-xl flex items-start gap-2 leading-relaxed">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#3ecf8e] hover:bg-[#3ecf8e]/90 text-zinc-950 font-bold py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 border-0 mt-2 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 size={20} className="animate-spin text-zinc-950" />
                  ) : (
                    <>
                      <span>Staff Sign In</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* --- ADMIN EMAIL & PASSWORD LOGIN FORM --- */
            <div>
              <div className="text-center mb-5">
                <h2 id="admin-auth-title" className="text-sm font-bold text-zinc-300 uppercase tracking-widest">
                  {isSignUp ? 'Create Account' : 'Admin Sign In'}
                </h2>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {isSignUp && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Full Name</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                        <UserIcon size={18} />
                      </span>
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-zinc-900/50 border border-zinc-800 focus:border-[#3ecf8e] rounded-xl font-medium outline-none text-sm text-zinc-100 placeholder-zinc-500 transition-colors"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Email Address</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                      <Mail size={18} />
                    </span>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-zinc-900/50 border border-zinc-800 focus:border-[#3ecf8e] rounded-xl font-medium outline-none text-sm text-zinc-100 placeholder-zinc-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Password</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                      <Lock size={18} />
                    </span>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-zinc-900/50 border border-zinc-800 focus:border-[#3ecf8e] rounded-xl font-medium outline-none text-sm text-zinc-100 placeholder-zinc-500 transition-colors"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-950/40 text-red-400 text-xs font-medium border border-red-900 rounded-xl flex items-start gap-2 leading-relaxed">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#3ecf8e] hover:bg-[#3ecf8e]/90 text-zinc-950 font-bold py-3.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 border-0 mt-2 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 size={20} className="animate-spin text-zinc-950" />
                  ) : (
                    <>
                      <span>{isSignUp ? 'Register Account' : 'Sign In'}</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              <div className="text-center mt-5">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError('');
                  }}
                  className="text-xs font-bold text-[#3ecf8e] hover:underline cursor-pointer"
                >
                  {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </button>
              </div>
            </div>
          )}

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
              <span className="px-2 bg-[#18181b] text-zinc-500">Sandbox</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-zinc-900/30 hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 font-bold py-3 rounded-xl transition-all text-xs border border-zinc-800/80 cursor-pointer"
          >
            <span>Run Sandbox Demo Mode</span>
          </button>
        </div>

        <div className="text-center mt-8">
          <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-[#3ecf8e] flex items-center gap-1 transition-colors">
              <ShieldCheck size={14} /> Privacy Policy
            </a>
            <span className="text-zinc-700">•</span>
            <a href="https://terms-conditions-store.vercel.app" target="_blank" rel="noopener noreferrer" className="hover:text-[#3ecf8e] transition-colors">
              Terms
            </a>
          </div>
        </div>
        <div className="text-center mt-4 text-[10px] font-medium text-zinc-600 font-mono">Noor Warehouse POS v1.7</div>
      </div>
    </div>
  );
};
