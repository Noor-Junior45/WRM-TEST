import React, { useState } from 'react';
import { User } from '../types';
import { auth, db } from '../services/firebase';
import { StoreService } from '../services/storeService';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
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
  ArrowLeft, 
  Check, 
  Sparkles,
  Users,
  ShieldAlert
} from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  // Navigation & Form Views
  const [selectedRole, setSelectedRole] = useState<'admin' | 'staff' | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
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

  // Check if settings already exist in Firestore for this uid
  const checkIfNewUser = async (uid: string): Promise<boolean> => {
    try {
      const q = query(collection(db, 'settings'), where('userId', '==', uid));
      const snap = await getDocs(q);
      return snap.empty;
    } catch (err) {
      console.error('Error checking new user settings:', err);
      return false; // Safe default
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const userCredential = await signInWithPopup(auth, provider);
      const firebaseUser = userCredential.user;
      
      const user: User = {
        id: firebaseUser.email || firebaseUser.uid,
        username: (firebaseUser.email || '').split('@')[0],
        name: firebaseUser.displayName || 'Authorized Member',
        role: 'admin',
        pin: '',
        photoURL: firebaseUser.photoURL || undefined
      };

      const isNew = await checkIfNewUser(firebaseUser.uid);
      if (isNew) {
        // Prefill onboarding fields
        setShopName(firebaseUser.displayName ? `${firebaseUser.displayName}'s Warehouse` : 'My Warehouse');
        setShopEmail(firebaseUser.email || '');
        setOnboardingUser(user);
      } else {
        onLogin(user);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Google Sign-In failed: ' + err.message);
      }
    } finally {
      setLoading(false);
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
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(userCredential.user, { displayName: name.trim() });
        const user: User = {
          id: userCredential.user.email || userCredential.user.uid,
          username: (userCredential.user.email || '').split('@')[0],
          name: name.trim(),
          role: 'admin',
          pin: ''
        };
        // Prefill onboarding fields
        setShopName(`${name.trim()}'s Warehouse`);
        setShopEmail(email.trim());
        setOnboardingUser(user);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
        const user: User = {
          id: userCredential.user.email || userCredential.user.uid,
          username: (userCredential.user.email || '').split('@')[0],
          name: userCredential.user.displayName || (userCredential.user.email || '').split('@')[0],
          role: 'admin',
          pin: '',
          photoURL: userCredential.user.photoURL || undefined
        };
        const isNew = await checkIfNewUser(userCredential.user.uid);
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
      if (err.code === 'auth/invalid-credential') {
        msg = 'Incorrect email or password. Please try again.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'This email is already registered. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password is too weak. Please use at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
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
      const uid = auth.currentUser?.uid || onboardingUser.id;
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
        userId: uid,
        id: settingsId
      };

      // Write to Firestore settings collection
      await setDoc(doc(db, 'settings', settingsId), customSettings);
      
      // Continue to application
      onLogin(onboardingUser);
    } catch (err: any) {
      console.error(err);
      setError('Failed to save store settings: ' + err.message);
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
      <div className="min-h-screen flex flex-col justify-center bg-[#f8fafc] p-6">
        <div className="w-full max-w-[500px] mx-auto animate-in fade-in zoom-in duration-300">
          <div className="text-center mb-8">
            <span className="inline-flex p-3 bg-indigo-50 rounded-2xl text-indigo-600 mb-3 shadow-inner">
              <Store size={32} className="animate-pulse" />
            </span>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Configure Your Warehouse</h1>
            <p className="text-gray-500 mt-2 text-sm font-medium">Configure store settings to suit your inventory</p>
          </div>

          <div className="bg-white rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] p-8 border border-gray-100">
            <div className="space-y-5">
              
              {/* Warehouse Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase block">Warehouse / Shop Name</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <Store size={18} />
                  </span>
                  <input
                    type="text"
                    placeholder="E.g. Noor Enterprise"
                    value={shopName}
                    onChange={e => setShopName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-gray-100 focus:border-indigo-500 rounded-xl font-medium outline-none text-sm transition-colors"
                  />
                </div>
              </div>

              {/* Warehouse Type / Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase block">Warehouse Category</label>
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
                      className={`py-2.5 px-3 rounded-xl text-left border-2 text-xs font-semibold flex items-center justify-between transition-all ${
                        shopCategory === cat.id 
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                          : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200'
                      }`}
                    >
                      <span>{cat.label}</span>
                      {shopCategory === cat.id && <Check size={14} className="text-indigo-600" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase block">Location / Address</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <MapPin size={18} />
                  </span>
                  <input
                    type="text"
                    placeholder="City, Country"
                    value={shopLocation}
                    onChange={e => setShopLocation(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-gray-100 focus:border-indigo-500 rounded-xl font-medium outline-none text-sm transition-colors"
                  />
                </div>
              </div>

              {/* Basic details: Phone & Email */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase block">Phone Number</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Phone size={16} />
                    </span>
                    <input
                      type="text"
                      placeholder="+91 XXXXX XXXXX"
                      value={shopPhone}
                      onChange={e => setShopPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border-2 border-gray-100 focus:border-indigo-500 rounded-xl font-medium outline-none text-xs transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase block">Store Contact Email</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Mail size={16} />
                    </span>
                    <input
                      type="email"
                      placeholder="store@email.com"
                      value={shopEmail}
                      onChange={e => setShopEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border-2 border-gray-100 focus:border-indigo-500 rounded-xl font-medium outline-none text-xs transition-colors"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-xs font-medium border border-red-100 flex items-start gap-2 leading-relaxed">
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
                  className="flex-1 py-3.5 bg-gray-50 hover:bg-gray-100 text-gray-500 font-bold rounded-xl transition-all border border-gray-200 text-sm flex items-center justify-center gap-1.5"
                >
                  <span>Skip Setup</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCompleteOnboarding(false)}
                  disabled={loading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95 flex items-center justify-center gap-2 border-0"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
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
    <div className="min-h-screen flex flex-col justify-center bg-[#f8fafc] p-6">
      <div className="w-full max-w-[420px] mx-auto animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-8">
          <img 
            src="https://lh3.googleusercontent.com/p/AF1QipPlp0QUwcp2FOnTGiGNf5fqWnskinCj4QxRKa3o=s1360-w1360-h1020-rw" 
            alt="Noor POS Logo" 
            className="w-24 h-24 rounded-full shadow-2xl shadow-indigo-200 mx-auto mb-5 border-4 border-white object-cover"
          />
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Noor Warehouse</h1>
          <p className="text-gray-500 mt-2 text-sm font-medium">Cloud-based Enterprise Warehouse System</p>
        </div>

        <div className="bg-white rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] p-8 border border-gray-100">
          
          {selectedRole === null ? (
            /* --- ROLE SELECTION ON START --- */
            <div className="space-y-6">
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Who are you?</h2>
                <p className="text-xs text-gray-400 mt-1">Select your access role to proceed</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedRole('admin')}
                  className="w-full flex items-center justify-between p-4 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-900 font-bold rounded-2xl border-2 border-indigo-100 hover:border-indigo-300 transition-all shadow-sm active:scale-95 cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-600 rounded-xl text-white">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-indigo-900">I am the Admin</div>
                      <div className="text-[10px] text-indigo-600 font-normal">Full control, warehouse settings, and staff roles</div>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-indigo-400 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRole('staff')}
                  className="w-full flex items-center justify-between p-4 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-900 font-bold rounded-2xl border-2 border-emerald-100 hover:border-emerald-300 transition-all shadow-sm active:scale-95 cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-600 rounded-xl text-white">
                      <Users size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-emerald-900">I am the Staff</div>
                      <div className="text-[10px] text-emerald-600 font-normal">Secure PIN login to active assigned role services</div>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-emerald-400 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          ) : selectedRole === 'staff' ? (
            /* --- STAFF LOGIN VIEW --- */
            <div>
              <div className="flex items-center justify-between mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole(null);
                    setError('');
                  }}
                  className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-500 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={18} />
                </button>
                <h2 className="text-lg font-bold text-gray-800">Staff Portal</h2>
                <div className="w-8"></div>
              </div>

              <form onSubmit={handleStaffLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase block">Admin's Email / User ID</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                      <Mail size={18} />
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. admin@example.com"
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-gray-100 focus:border-indigo-500 rounded-xl font-medium outline-none text-sm transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase block">Staff Unique ID No.</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                      <UserIcon size={18} />
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. 1001"
                      value={staffId}
                      onChange={e => setStaffId(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-gray-100 focus:border-indigo-500 rounded-xl font-medium outline-none text-sm transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase block">Enter PIN</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                      <Lock size={18} />
                    </span>
                    <input
                      type="password"
                      placeholder="••••"
                      maxLength={6}
                      value={staffPin}
                      onChange={e => setStaffPin(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-gray-100 focus:border-indigo-500 rounded-xl font-medium outline-none text-sm transition-colors text-center tracking-widest font-black"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 text-red-600 text-xs font-medium border border-red-100 flex items-start gap-2 leading-relaxed rounded-xl">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-100 active:scale-95 flex items-center justify-center gap-2 border-0 mt-2 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      <span>Staff Sign In</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : !showEmailForm ? (
            /* --- LANDING STATE WITH GOOGLE AUTH FIRST --- */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole(null);
                    setError('');
                  }}
                  className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-500 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={18} />
                </button>
                <h2 className="text-lg font-bold text-gray-800">Admin Sign In</h2>
                <div className="w-8"></div>
              </div>

              {/* Google Sign-In Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-bold py-3.5 px-4 rounded-xl border border-gray-200 transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer animate-in fade-in"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin text-gray-400" />
                ) : (
                  <>
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                      <g transform="matrix(1, 0, 0, 1, 0, 0)">
                        <path d="M21.35,11.1H12v2.7h5.38C16.88,16.22,14.73,18,12,18c-3.31,0-6-2.69-6-6s2.69-6,6-6c1.47,0,2.81,0.54,3.86,1.44l2.03-2.03C16.21,3.77,14.22,3,12,3c-4.97,0-9,4.03-9,9s4.03,9,9,9c4.8,0,8.44-3.38,8.44-8.4C20.44,12.01,20.4,11.54,21.35,11.1z" fill="#4285F4" />
                        <path d="M12,21c2.44,0,4.72-0.89,6.4-2.4l-3.04-2.36C14.39,16.85,13.25,17.1,12,17.1c-2.48,0-4.6-1.68-5.35-3.94l-3.12,2.41C5.02,18.9,8.23,21,12,21z" fill="#34A853" />
                        <path d="M6.65,13.16C6.46,12.79,6.35,12.4,6.35,12s0.11-0.79,0.3-1.16L3.53,8.43C2.9,9.64,2.5,11.02,2.5,12.5s0.4,2.86,1.03,4.07L6.65,13.16z" fill="#FBBC05" />
                        <path d="M12,6.9c1.33,0,2.53,0.46,3.47,1.36l2.6-2.6C16.48,4.1,14.39,3.5,12,3.5C8.23,3.5,5.02,5.6,3.53,8.93l3.12,2.41C7.4,9.08,9.52,6.9,12,6.9z" fill="#EA4335" />
                      </g>
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-100"></div>
                <span className="flex-shrink mx-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">or</span>
                <div className="flex-grow border-t border-gray-100"></div>
              </div>

              {/* Email & Password Trigger Button */}
              <button
                type="button"
                onClick={() => {
                  setShowEmailForm(true);
                  setIsSignUp(false);
                }}
                className="w-full flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 font-bold py-3.5 px-4 rounded-xl transition-all text-sm border-0 cursor-pointer"
              >
                <Mail size={18} />
                <span>Continue with Email & Password</span>
              </button>
            </div>
          ) : (
            /* --- EMAIL & PASSWORD INPUT STATE --- */
            <div>
              <div className="flex items-center justify-between mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEmailForm(false);
                    setError('');
                  }}
                  className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-500 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={18} />
                </button>
                <h2 className="text-lg font-bold text-gray-800">
                  {isSignUp ? 'Create Account' : 'Welcome Back'}
                </h2>
                <div className="w-8"></div>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {isSignUp && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase block">Full Name</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                        <UserIcon size={18} />
                      </span>
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-gray-100 focus:border-indigo-500 rounded-xl font-medium outline-none text-sm transition-colors"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase block">Email Address</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                      <Mail size={18} />
                    </span>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-gray-100 focus:border-indigo-500 rounded-xl font-medium outline-none text-sm transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase block">Password</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                      <Lock size={18} />
                    </span>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-gray-100 focus:border-indigo-500 rounded-xl font-medium outline-none text-sm transition-colors"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 text-red-600 text-xs font-medium border border-red-100 flex items-start gap-2 leading-relaxed rounded-xl">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95 flex items-center justify-center gap-2 border-0 mt-2 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 size={20} className="animate-spin" />
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
                  className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                >
                  {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </button>
              </div>
            </div>
          )}

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
              <span className="px-2 bg-white text-gray-400">Sandbox</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold py-3 rounded-xl transition-all text-xs border border-gray-200 cursor-pointer"
          >
            <span>Run Sandbox Demo Mode</span>
          </button>
        </div>

        <div className="text-center mt-8">
          <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 flex items-center gap-1 transition-colors">
              <ShieldCheck size={14} /> Privacy Policy
            </a>
            <span className="text-gray-300">•</span>
            <a href="https://terms-conditions-store.vercel.app" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition-colors">
              Terms
            </a>
          </div>
        </div>
        <div className="text-center mt-4 text-[10px] font-medium text-gray-400">Noor Warehouse POS v1.7</div>
      </div>
    </div>
  );
};
