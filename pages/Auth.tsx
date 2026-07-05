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
  Check,
  Package,
  Sparkles,
  Eye,
  EyeOff
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
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);

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

  // Playful Direct Colors & Styling Helper Objects
  const ink = "#1D1818";
  const bg = "#FFFEF2";
  const accent = "#FF5C00";

  // --- RENDERING ONBOARDING WIZARD ---
  if (onboardingUser) {
    return (
      <div 
        className="min-h-screen flex flex-col justify-center items-center p-6"
        style={{
          backgroundColor: bg,
          color: ink,
          backgroundImage: `
            linear-gradient(rgba(29, 24, 24, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(29, 24, 24, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      >
        <div className="w-full max-w-[550px] animate-in fade-in duration-300">
          <div className="text-center mb-8">
            <span 
              className="inline-block font-mono text-[10px] font-bold px-3 py-1.5 rounded-sm transform rotate-[-1deg] uppercase tracking-wider border-2"
              style={{ background: ink, color: bg, borderColor: ink }}
            >
              INITIAL SETUP
            </span>
            <h1 className="font-['Gaegu'] text-6xl md:text-7xl font-bold leading-none mt-2 select-none" style={{ color: ink }}>
              Configure<br/>Warehouse
            </h1>
            <p className="text-sm font-medium mt-3 max-w-[360px] mx-auto opacity-90">
              Set up your space, tags, and contact details to get everything fully synchronized.
            </p>
          </div>

          <div 
            className="bg-white border-[3px] p-6 md:p-8 rounded-none relative"
            style={{
              borderColor: ink,
              boxShadow: `12px 12px 0 ${ink}`
            }}
          >
            {/* Playful top right badge circle */}
            <div 
              className="absolute -top-3.5 -right-3.5 w-7 h-7 rounded-full border-[3px] animate-bounce"
              style={{ backgroundColor: accent, borderColor: ink }}
            />

            <div className="space-y-6">
              
              {/* Warehouse Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold font-mono uppercase tracking-wider block">Warehouse / Store Name</label>
                <input
                  type="text"
                  placeholder="E.g. Noor Enterprise"
                  value={shopName}
                  onChange={e => setShopName(e.target.value)}
                  className="w-full border-2 px-4 py-3 font-mono text-sm outline-none transition-all"
                  style={{
                    backgroundColor: bg,
                    borderColor: ink,
                  }}
                  onFocus={e => {
                    e.target.style.backgroundColor = '#ffffff';
                    e.target.style.boxShadow = `4px 4px 0 ${accent}`;
                  }}
                  onBlur={e => {
                    e.target.style.backgroundColor = bg;
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Warehouse Type / Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold font-mono uppercase tracking-wider block">Warehouse Category</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'general', label: 'General Goods' },
                    { id: 'pharma', label: 'Pharmaceuticals' },
                    { id: 'grocery', label: 'Grocery / Food' },
                    { id: 'electronics', label: 'Electronics & IT' },
                    { id: 'clothing', label: 'Clothing & Apparel' }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setShopCategory(cat.id)}
                      className="py-3 px-3.5 text-left border-2 text-xs font-extrabold flex items-center justify-between transition-all cursor-pointer rounded-none"
                      style={{
                        backgroundColor: shopCategory === cat.id ? accent : bg,
                        color: shopCategory === cat.id ? '#ffffff' : ink,
                        borderColor: ink,
                        transform: shopCategory === cat.id ? 'translate(2px, 2px)' : 'none',
                        boxShadow: shopCategory === cat.id ? 'none' : `3px 3px 0 ${ink}`
                      }}
                    >
                      <span className="font-mono">{cat.label}</span>
                      {shopCategory === cat.id && <Check size={14} className="stroke-[3px]" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold font-mono uppercase tracking-wider block">Location / Address</label>
                <input
                  type="text"
                  placeholder="City, Country"
                  value={shopLocation}
                  onChange={e => setShopLocation(e.target.value)}
                  className="w-full border-2 px-4 py-3 font-mono text-sm outline-none transition-all"
                  style={{
                    backgroundColor: bg,
                    borderColor: ink,
                  }}
                  onFocus={e => {
                    e.target.style.backgroundColor = '#ffffff';
                    e.target.style.boxShadow = `4px 4px 0 ${accent}`;
                  }}
                  onBlur={e => {
                    e.target.style.backgroundColor = bg;
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Basic details: Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold font-mono uppercase tracking-wider block">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91 XXXXX XXXXX"
                    value={shopPhone}
                    onChange={e => setShopPhone(e.target.value)}
                    className="w-full border-2 px-4 py-3 font-mono text-xs outline-none transition-all"
                    style={{
                      backgroundColor: bg,
                      borderColor: ink,
                    }}
                    onFocus={e => {
                      e.target.style.backgroundColor = '#ffffff';
                      e.target.style.boxShadow = `4px 4px 0 ${accent}`;
                    }}
                    onBlur={e => {
                      e.target.style.backgroundColor = bg;
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold font-mono uppercase tracking-wider block">Store Email</label>
                  <input
                    type="email"
                    placeholder="store@email.com"
                    value={shopEmail}
                    onChange={e => setShopEmail(e.target.value)}
                    className="w-full border-2 px-4 py-3 font-mono text-xs outline-none transition-all"
                    style={{
                      backgroundColor: bg,
                      borderColor: ink,
                    }}
                    onFocus={e => {
                      e.target.style.backgroundColor = '#ffffff';
                      e.target.style.boxShadow = `4px 4px 0 ${accent}`;
                    }}
                    onBlur={e => {
                      e.target.style.backgroundColor = bg;
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              {error && (
                <div 
                  className="p-4 border-2 font-mono text-xs font-bold flex items-start gap-2.5"
                  style={{
                    backgroundColor: '#FFF2F2',
                    color: '#B91C1C',
                    borderColor: ink,
                    boxShadow: `4px 4px 0 #B91C1C`
                  }}
                >
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-4 pt-3">
                <button
                  type="button"
                  onClick={() => handleCompleteOnboarding(true)}
                  disabled={loading}
                  className="flex-1 py-4 font-mono font-black text-sm border-2 tracking-wider uppercase cursor-pointer transition-all active:translate-y-1 active:shadow-none"
                  style={{
                    backgroundColor: bg,
                    color: ink,
                    borderColor: ink,
                    boxShadow: `4px 4px 0 ${ink}`
                  }}
                >
                  Skip Setup
                </button>

                <button
                  type="button"
                  onClick={() => handleCompleteOnboarding(false)}
                  disabled={loading}
                  className="flex-1 font-mono font-black text-sm border-2 tracking-wider uppercase cursor-pointer transition-all active:translate-y-1 active:shadow-none flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: accent,
                    color: '#ffffff',
                    borderColor: ink,
                    boxShadow: `4px 4px 0 ${ink}`
                  }}
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin text-white" />
                  ) : (
                    <>
                      <span>Complete</span>
                      <Check size={16} className="stroke-[3px]" />
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
    <div 
      className="min-h-screen flex flex-col justify-center items-center p-4 md:p-8"
      style={{
        backgroundColor: bg,
        color: ink,
        backgroundImage: `
          linear-gradient(rgba(29, 24, 24, 0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(29, 24, 24, 0.08) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px'
      }}
    >
      <div className="main-wrapper w-full max-w-[950px] grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-14 items-center py-6">
        
        {/* Playful Left Side Hero Banner */}
        <div className="hero-section text-center lg:text-left relative py-4 lg:py-10 select-none">
          <h1 
            className="font-['Gaegu'] text-7xl sm:text-8xl md:text-9.5rem font-black leading-[0.8] tracking-tight mt-1"
            style={{ color: ink }}
          >
            Noor<br />
            <span className="text-stroke" style={{ color: accent }}>Warehouse</span>
          </h1>

          <p className="subhead text-sm sm:text-base md:text-lg font-medium mt-6 max-w-[440px] mx-auto lg:mx-0 leading-relaxed opacity-95">
            The professional inventory management system that keeps things moving as fast as you do. Track stock levels, oversee categories, and sync staff profiles in real time.
          </p>
          
          {/* Hand-drawn annotation helper */}
          <div className="hidden lg:block relative mt-8 h-12">
            <div className="annotation font-['Gaegu'] text-2xl font-bold italic" style={{ color: accent }}>
              Let's get to work!
            </div>
            <svg 
              className="svg-arrow absolute left-44 top-2 w-[55px] h-[30px] transform rotate-[-5deg]" 
              viewBox="0 0 50 30" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="3.5" 
              style={{ color: accent }}
            >
              <path d="M5 5C15 25 35 25 45 10M45 10L35 12M45 10L42 20" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Playful Login Form Card */}
        <div className="w-full max-w-[440px] mx-auto lg:max-w-none">
          <div 
            className="login-card bg-white border-[3px] p-6 md:p-8 rounded-none relative"
            style={{
              borderColor: ink,
              boxShadow: `12px 12px 0 ${ink}`
            }}
          >
            {/* Round pin/sticker badge */}
            <div 
              className="absolute -top-3.5 -right-3.5 w-7 h-7 rounded-full border-[3px] animate-pulse"
              style={{ backgroundColor: accent, borderColor: ink }}
            />

            {/* Playful portal switcher tabs */}
            <div className="grid grid-cols-2 gap-2 border-b-2 pb-5 border-dashed mb-6" style={{ borderColor: ink }}>
              <button
                type="button"
                onClick={() => { setSelectedRole('admin'); setError(''); }}
                className="py-2 px-1 text-center font-mono text-xs font-black tracking-wide cursor-pointer border-2 uppercase transition-all"
                style={{
                  backgroundColor: (selectedRole === 'admin' || selectedRole === null) ? accent : bg,
                  color: (selectedRole === 'admin' || selectedRole === null) ? '#ffffff' : ink,
                  borderColor: ink,
                  boxShadow: (selectedRole === 'admin' || selectedRole === null) ? 'none' : `3px 3px 0 ${ink}`,
                  transform: (selectedRole === 'admin' || selectedRole === null) ? 'translate(2px, 2px)' : 'none'
                }}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => { setSelectedRole('staff'); setError(''); }}
                className="py-2 px-1 text-center font-mono text-xs font-black tracking-wide cursor-pointer border-2 uppercase transition-all"
                style={{
                  backgroundColor: selectedRole === 'staff' ? accent : bg,
                  color: selectedRole === 'staff' ? '#ffffff' : ink,
                  borderColor: ink,
                  boxShadow: selectedRole === 'staff' ? 'none' : `3px 3px 0 ${ink}`,
                  transform: selectedRole === 'staff' ? 'translate(2px, 2px)' : 'none'
                }}
              >
                Staff Portal
              </button>
            </div>

            {selectedRole === 'staff' ? (
              /* --- STAFF LOGIN VIEW --- */
              <div>
                <div className="mb-5">
                  <h2 className="font-sans text-2xl font-black uppercase tracking-tight" style={{ color: ink }}>
                    Staff Access
                  </h2>
                  <p className="text-xs font-mono opacity-85 mt-1">Sign in with your admin credentials & unique PIN</p>
                </div>

                <form onSubmit={handleStaffLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold font-mono uppercase tracking-wide block">Admin Email / User ID</label>
                    <input
                      type="text"
                      placeholder="e.g. admin@example.com"
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      className="w-full border-2 px-4 py-3 font-mono text-sm outline-none transition-all"
                      style={{
                        backgroundColor: bg,
                        borderColor: ink,
                      }}
                      onFocus={e => {
                        e.target.style.backgroundColor = '#ffffff';
                        e.target.style.boxShadow = `4px 4px 0 ${accent}`;
                      }}
                      onBlur={e => {
                        e.target.style.backgroundColor = bg;
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold font-mono uppercase tracking-wide block">Staff Unique ID</label>
                    <input
                      type="text"
                      placeholder="e.g. 1001"
                      value={staffId}
                      onChange={e => setStaffId(e.target.value)}
                      className="w-full border-2 px-4 py-3 font-mono text-sm outline-none transition-all"
                      style={{
                        backgroundColor: bg,
                        borderColor: ink,
                      }}
                      onFocus={e => {
                        e.target.style.backgroundColor = '#ffffff';
                        e.target.style.boxShadow = `4px 4px 0 ${accent}`;
                      }}
                      onBlur={e => {
                        e.target.style.backgroundColor = bg;
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold font-mono uppercase tracking-wide block">Enter PIN</label>
                    <div className="relative">
                      <input
                        type={showPin ? "text" : "password"}
                        placeholder="••••"
                        maxLength={6}
                        value={staffPin}
                        onChange={e => setStaffPin(e.target.value)}
                        className="w-full border-2 pl-4 pr-12 py-3 font-mono text-sm text-center tracking-widest font-black outline-none transition-all"
                        style={{
                          backgroundColor: bg,
                          borderColor: ink,
                        }}
                        onFocus={e => {
                          e.target.style.backgroundColor = '#ffffff';
                          e.target.style.boxShadow = `4px 4px 0 ${accent}`;
                        }}
                        onBlur={e => {
                          e.target.style.backgroundColor = bg;
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black p-1 focus:outline-none cursor-pointer"
                        style={{ background: 'transparent', border: 'none', boxShadow: 'none', width: 'auto', padding: '4px', margin: 0 }}
                      >
                        {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div 
                      className="p-3 border-2 font-mono text-xs font-bold flex items-start gap-2"
                      style={{
                        backgroundColor: '#FFF2F2',
                        color: '#B91C1C',
                        borderColor: ink,
                        boxShadow: `3px 3px 0 #B91C1C`
                      }}
                    >
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4.5 font-mono font-black text-sm border-2 uppercase tracking-wider cursor-pointer transition-all active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 mt-4"
                    style={{
                      backgroundColor: accent,
                      color: '#ffffff',
                      borderColor: ink,
                      boxShadow: `4px 4px 0 ${ink}`
                    }}
                  >
                    {loading ? (
                      <Loader2 size={18} className="animate-spin text-white" />
                    ) : (
                      <>
                        <span>Staff Sign In</span>
                        <ArrowRight size={16} className="stroke-[3px]" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              /* --- ADMIN LOGIN VIEW --- */
              <div>
                <div className="mb-5">
                  <h2 className="font-sans text-2xl font-black uppercase tracking-tight" style={{ color: ink }}>
                    {isSignUp ? 'Create Account' : 'Admin Sign In'}
                  </h2>
                  <p className="text-xs font-mono opacity-85 mt-1">
                    {isSignUp ? 'Register to manage warehouses and staff' : 'Access core inventory control and statistics'}
                  </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                  {isSignUp && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold font-mono uppercase tracking-wide block">Full Name</label>
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full border-2 px-4 py-3 font-mono text-sm outline-none transition-all"
                        style={{
                          backgroundColor: bg,
                          borderColor: ink,
                        }}
                        onFocus={e => {
                          e.target.style.backgroundColor = '#ffffff';
                          e.target.style.boxShadow = `4px 4px 0 ${accent}`;
                        }}
                        onBlur={e => {
                          e.target.style.backgroundColor = bg;
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold font-mono uppercase tracking-wide block">Email Address</label>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full border-2 px-4 py-3 font-mono text-sm outline-none transition-all"
                      style={{
                        backgroundColor: bg,
                        borderColor: ink,
                      }}
                      onFocus={e => {
                        e.target.style.backgroundColor = '#ffffff';
                        e.target.style.boxShadow = `4px 4px 0 ${accent}`;
                      }}
                      onBlur={e => {
                        e.target.style.backgroundColor = bg;
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold font-mono uppercase tracking-wide block">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full border-2 pl-4 pr-12 py-3 font-mono text-sm outline-none transition-all"
                        style={{
                          backgroundColor: bg,
                          borderColor: ink,
                        }}
                        onFocus={e => {
                          e.target.style.backgroundColor = '#ffffff';
                          e.target.style.boxShadow = `4px 4px 0 ${accent}`;
                        }}
                        onBlur={e => {
                          e.target.style.backgroundColor = bg;
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black p-1 focus:outline-none cursor-pointer"
                        style={{ background: 'transparent', border: 'none', boxShadow: 'none', width: 'auto', padding: '4px', margin: 0 }}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div 
                      className="p-3 border-2 font-mono text-xs font-bold flex items-start gap-2"
                      style={{
                        backgroundColor: '#FFF2F2',
                        color: '#B91C1C',
                        borderColor: ink,
                        boxShadow: `3px 3px 0 #B91C1C`
                      }}
                    >
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 font-mono font-black text-sm border-2 uppercase tracking-wider cursor-pointer transition-all active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 mt-4"
                    style={{
                      backgroundColor: accent,
                      color: '#ffffff',
                      borderColor: ink,
                      boxShadow: `4px 4px 0 ${ink}`
                    }}
                  >
                    {loading ? (
                      <Loader2 size={18} className="animate-spin text-white" />
                    ) : (
                      <>
                        <span>{isSignUp ? 'Register Account' : 'Sign In'}</span>
                        <ArrowRight size={16} className="stroke-[3px]" />
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
                    className="text-xs font-mono font-bold hover:underline cursor-pointer transition-colors"
                    style={{ color: accent }}
                  >
                    {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                  </button>
                </div>
              </div>
            )}

            {/* Sandbox divider line */}
            <div className="relative my-6 flex items-center justify-center select-none">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-dashed" style={{ borderColor: ink }} />
              </div>
              <span className="relative px-3 font-mono text-[10px] font-black tracking-widest uppercase" style={{ backgroundColor: '#ffffff', color: ink }}>
                Sandbox
              </span>
            </div>

            {/* Guest Sandbox Button */}
            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={loading}
              className="w-full py-3.5 font-mono font-black text-xs border-2 uppercase tracking-wider cursor-pointer transition-all active:translate-y-1 active:shadow-none flex items-center justify-center gap-2"
              style={{
                backgroundColor: bg,
                color: ink,
                borderColor: ink,
                boxShadow: `4px 4px 0 ${ink}`
              }}
            >
              <span>Run Sandbox Demo Mode</span>
            </button>
          </div>

          {/* Links & Footer inside scope */}
          <div className="flex justify-center gap-6 mt-8 font-mono text-[10px] uppercase tracking-wider select-none">
            <a 
              href="/privacy.html" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:underline font-black flex items-center gap-1"
              style={{ color: ink }}
            >
              <ShieldCheck size={14} /> Privacy Policy
            </a>
            <span style={{ color: ink }}>•</span>
            <a 
              href="https://terms-conditions-store.vercel.app" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:underline font-black"
              style={{ color: ink }}
            >
              Terms of Use
            </a>
          </div>

          <div className="text-center mt-5 text-[9px] font-mono font-bold tracking-widest uppercase opacity-60">
            Noor Warehouse v1.7
          </div>
        </div>

      </div>
    </div>
  );
};
