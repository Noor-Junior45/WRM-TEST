
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { User, StoreSettings, DeletedItem, Tab } from '../types';
import { Card, Button, Input, Modal, Badge } from '../components/UI';
import { LogOut, AlertTriangle, Cloud, Settings, Store, Phone, MapPin, Mail, Bell, CheckSquare, Save, Download, Upload, ChevronRight, ChevronDown, Sparkles, Server, HardDrive, Image as ImageIcon, FileText, Headphones, ExternalLink, Users, UserPlus, Loader2, Trash2, RotateCcw, Box, Receipt, Calendar, Clock, Printer, Scan, Smartphone, RefreshCw, ArchiveRestore, ShieldCheck, CloudOff, Search, Hash, CreditCard, Lock, Scale, Target } from 'lucide-react';
import { StoreService } from '../services/storeService';
import { auth } from '../services/firebase';

const ProductSettingRow: React.FC<{ 
    product: any; 
    onUpdate: (id: string, updates: Partial<any>) => void 
}> = ({ product, onUpdate }) => {
    return (
        <div className="flex justify-between items-center p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors bg-white">
            <div className="flex-1 min-w-0 pr-4">
                <div className="font-bold text-gray-800 text-sm truncate">{product.name}</div>
                <div className="text-xs text-gray-400">Current Stock: {product.stock} {product.unit}</div>
            </div>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-100 transition-all w-24">
                <input 
                    type="number"
                    className="w-full text-center font-bold text-gray-700 outline-none text-sm bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={product.lowStockThreshold}
                    onChange={(e) => onUpdate(product.id, { lowStockThreshold: parseInt(e.target.value) || 0 })}
                />
            </div>
        </div>
    );
};

interface ProfileProps {
  user: User | null;
  onLogin: (user: User) => void;
  onLogout: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ user, onLogin, onLogout }) => {
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingNas, setIsEditingNas] = useState(false);
  const [tempProfile, setTempProfile] = useState<Partial<StoreSettings>>({});
  const [tempNas, setTempNas] = useState<{ nasUrl: string, syncToNas: boolean }>({ nasUrl: '', syncToNas: false });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [showTermsDropdown, setShowTermsDropdown] = useState(false);
  const [showPrivacyDropdown, setShowPrivacyDropdown] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  
  // Settings & Product thresholds
  const [products, setProducts] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [settingsSearch, setSettingsSearch] = useState('');

  // Recycle Bin State
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([]);
  const [recycleRetention, setRecycleRetention] = useState(30);

  // Shift Logs States
  const [showShiftLogModal, setShowShiftLogModal] = useState(false);
  const [openingCash, setOpeningCash] = useState<string>('');
  const [closingCash, setClosingCash] = useState<string>('');
  const [shiftNotes, setShiftNotes] = useState<string>('');
  const [shiftHistory, setShiftHistory] = useState<any[]>(() => {
      const saved = localStorage.getItem('noor_shift_history');
      return saved ? JSON.parse(saved) : [];
  });

  // Staff & History States
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [productHistory, setProductHistory] = useState<any[]>([]);
  const [showStaffSection, setShowStaffSection] = useState(false);
  const [showHistorySection, setShowHistorySection] = useState(false);
  const [showShareCredentials, setShowShareCredentials] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState({ id: '', name: '', pin: '', role: 'pos' as 'pos' | 'inventory' });
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [sessionLocked, setSessionLocked] = useState(false);

  // Gesture State
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [touchEnd, setTouchEnd] = useState<{x: number, y: number} | null>(null);
  const minSwipeDistance = 50;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  // Refs
  const storeNameRef = useRef<HTMLInputElement>(null);
  const storeAddrRef = useRef<HTMLInputElement>(null);
  const storePhoneRef = useRef<HTMLInputElement>(null);
  const storeEmailRef = useRef<HTMLInputElement>(null);

  // --- Browser/Gesture Back Navigation Handling ---
  useEffect(() => {
    const handleNavigationPop = (e: any) => {
        if (showRecycleBin) {
            setShowRecycleBin(false);
            return;
        }
        if (showResetConfirm) {
            setShowResetConfirm(false);
            return;
        }
        if (isEditingNas) {
            setIsEditingNas(false);
            return;
        }
        if (isEditingProfile) {
            setIsEditingProfile(false);
            return;
        }
    };

    window.addEventListener('app-navigation-pop' as any, handleNavigationPop);
    return () => window.removeEventListener('app-navigation-pop' as any, handleNavigationPop);
  }, [isEditingProfile, isEditingNas, showRecycleBin, showResetConfirm]);

  const totalRevenue = useMemo(() => {
      return sales.reduce((acc, s) => acc + s.total, 0);
  }, [sales]);

  const salesTargetPercent = useMemo(() => {
      if (!storeSettings || !storeSettings.salesTarget) return 0;
      return Math.min(100, Math.round((totalRevenue / storeSettings.salesTarget) * 100));
  }, [totalRevenue, storeSettings]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
      const s = await StoreService.getSettings();
      setStoreSettings(s);
      setRecycleRetention(s.recycleBinRetentionDays || 30);
      
      const lastTime = StoreService.getLastBackupTime();
      if (lastTime) setLastBackup(new Date(lastTime).toLocaleString());

      const delItems = await StoreService.getDeletedItems();
      setDeletedItems(delItems);

      const inventory = await StoreService.getInventory();
      setProducts(inventory);

      const salesData = await StoreService.getSales();
      setSales(salesData);

      if (user?.role === 'admin') {
          const staff = await StoreService.getStaffMembers();
          setStaffMembers(staff);
          const history = await StoreService.getProductHistory();
          setProductHistory(history);
      }
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!staffForm.id || !staffForm.name || !staffForm.pin) {
          alert("All fields are required.");
          return;
      }
      if (staffForm.pin.length < 4) {
          alert("PIN must be at least 4 digits.");
          return;
      }
      try {
          if (editingStaffId) {
              await StoreService.updateStaffMember(editingStaffId, {
                  name: staffForm.name,
                  pin: staffForm.pin,
                  role: staffForm.role
              });
          } else {
              if (staffMembers.some(s => s.id === staffForm.id)) {
                  alert("This Staff ID is already registered. Please choose a unique ID.");
                  return;
              }
              await StoreService.addStaffMember(staffForm);
          }
          setShowStaffModal(false);
          setEditingStaffId(null);
          setStaffForm({ id: '', name: '', pin: '', role: 'pos' });
          loadData();
      } catch (err: any) {
          alert("Error saving staff: " + err.message);
      }
  };

  const handleEditStaffClick = (staff: any) => {
      setEditingStaffId(staff.id);
      setStaffForm({
          id: staff.id,
          name: staff.name,
          pin: staff.pin,
          role: staff.role
      });
      setShowStaffModal(true);
  };

  const handleDeleteStaff = async (staffId: string) => {
      if (confirm("Are you sure you want to delete this staff member? They will lose access immediately.")) {
          await StoreService.deleteStaffMember(staffId);
          loadData();
      }
  };

  const handleVerifyStaffPin = () => {
      if (!user || user.role !== 'staff') return;
      if (pinInput === user.pin) {
          setSessionLocked(false);
          setShowPinModal(false);
          setPinInput('');
      } else {
          alert("Incorrect PIN. Please try again.");
      }
  };

  const handleUpdateSettings = async (updates: Partial<StoreSettings>) => {
      if (!storeSettings) return;
      const newSettings = { ...storeSettings, ...updates };
      await StoreService.saveSettings(newSettings);
      setStoreSettings(newSettings);
  };

  const handleInlineProductUpdate = async (id: string, updates: Partial<any>) => {
      setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
      await StoreService.updateProduct(id, updates);
  };

  const handleStartEdit = () => {
      if (storeSettings) {
          setTempProfile({
              storeName: storeSettings.storeName,
              storeAddress: storeSettings.storeAddress,
              storePhone: storeSettings.storePhone,
              storeEmail: storeSettings.storeEmail,
              logo: storeSettings.logo,
              warehouseType: storeSettings.warehouseType || 'general',
              warehouseCode: storeSettings.warehouseCode || '',
              warehouseManager: storeSettings.warehouseManager || '',
              warehouseCapacity: storeSettings.warehouseCapacity || 5000,
              warehouseZone: storeSettings.warehouseZone || '',
              upiId: storeSettings.upiId || ''
          });
          window.history.pushState({ tab: Tab.PROFILE, depth: 1 }, '');
          setIsEditingProfile(true);
      }
  };

  const handleSaveProfile = async () => {
      if (!storeSettings) return;
      const newSettings = { ...storeSettings, ...tempProfile };
      await StoreService.saveSettings(newSettings);
      setStoreSettings(newSettings);
      setIsEditingProfile(false);
      window.history.back();
  };
  
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setTempProfile(prev => ({ ...prev, logo: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSaveRetention = async (days: number) => {
      if (!storeSettings) return;
      setRecycleRetention(days);
      const newSettings = { ...storeSettings, recycleBinRetentionDays: days };
      await StoreService.saveSettings(newSettings);
      setStoreSettings(newSettings);
  };

  const handleSaveShiftLog = () => {
      if (!openingCash || !closingCash) {
          alert("Please fill in both opening and closing cash balances.");
          return;
      }
      const open = parseFloat(openingCash) || 0;
      const close = parseFloat(closingCash) || 0;
      const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
      const difference = close - (open + totalRevenue);
      
      const newLog = {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toISOString(),
          performedBy: user?.name || 'Admin',
          openingCash: open,
          closingCash: close,
          expectedSales: totalRevenue,
          difference,
          notes: shiftNotes
      };

      const updatedHistory = [newLog, ...shiftHistory];
      setShiftHistory(updatedHistory);
      localStorage.setItem('noor_shift_history', JSON.stringify(updatedHistory));
      
      setOpeningCash('');
      setClosingCash('');
      setShiftNotes('');
      setShowShiftLogModal(false);
      alert("Shift log submitted and reconciled successfully!");
  };

  const handleClearShiftHistory = () => {
      if (confirm("Are you sure you want to delete all shift records? This is permanent.")) {
          setShiftHistory([]);
          localStorage.removeItem('noor_shift_history');
      }
  };

  const handleRestoreItem = async (id: string) => {
      await StoreService.restoreItem(id);
      loadData();
  };

  const handlePermanentDelete = async (id: string) => {
      if(confirm("Delete this item permanently? This cannot be undone.")) {
          await StoreService.permanentlyDelete(id);
          loadData();
      }
  };

  const handleEmptyBin = async () => {
      if(confirm("Are you sure? This will permanently remove all items in the recycle bin.")) {
          await StoreService.emptyRecycleBin();
          loadData();
      }
  };

  const groupedDeletedItems = useMemo(() => {
      const groups: Record<string, DeletedItem[]> = {};
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();

      deletedItems.forEach(item => {
          const d = new Date(item.deletedAt);
          let key = d.toDateString();
          if (key === today) key = 'Today';
          else if (key === yesterday) key = 'Yesterday';
          
          if (!groups[key]) groups[key] = [];
          groups[key].push(item);
      });
      return groups;
  }, [deletedItems]);

  const handleStartEditNas = () => {
      if (storeSettings) {
          setTempNas({
              nasUrl: storeSettings.nasUrl || 'http://localhost:3000/api/storage',
              syncToNas: storeSettings.syncToNas || false
          });
          window.history.pushState({ tab: Tab.PROFILE, depth: 1 }, '');
          setIsEditingNas(true);
      }
  };

  const handleSaveNas = async () => {
      if (!storeSettings) return;
      const newSettings = { 
          ...storeSettings, 
          nasUrl: tempNas.nasUrl,
          syncToNas: tempNas.syncToNas
      };
      await StoreService.saveSettings(newSettings);
      setStoreSettings(newSettings);
      setIsEditingNas(false);
      window.history.back();
  };

  const handleToggleNotifications = async () => {
      if (!storeSettings) return;
      
      const newState = !storeSettings.notificationsEnabled;
      
      if (newState) {
          if (!("Notification" in window)) {
              alert("Browser does not support notifications");
              return;
          }
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
              alert("Permission denied.");
              return;
          }
      }

      const newSettings = { ...storeSettings, notificationsEnabled: newState };
      await StoreService.saveSettings(newSettings);
      setStoreSettings(newSettings);
  };

  const handleToggleDirectPrint = async () => {
       if (!storeSettings) return;
       const newSettings = { ...storeSettings, directPrintEnabled: !storeSettings.directPrintEnabled };
       await StoreService.saveSettings(newSettings);
       setStoreSettings(newSettings);
  };

  const handleScannerPreferenceChange = async (pref: 'phone' | 'machine' | 'both') => {
      if (!storeSettings) return;
      const newSettings = { ...storeSettings, scannerPreference: pref };
      await StoreService.saveSettings(newSettings);
      setStoreSettings(newSettings);
  };
  
  const handleLogout = async () => {
      if (confirm("Sign out?")) {
          await StoreService.logout();
          onLogout();
      }
  };
  
  const handleExport = async () => {
      const data = await StoreService.getRawData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `noor_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
          try {
              const json = JSON.parse(e.target?.result as string);
              if (confirm("Overwrite data?")) {
                   await StoreService.importData(json);
              }
          } catch (err) { alert("Invalid file."); }
      };
      reader.readAsText(file);
  };

  const handleReset = async () => {
      await StoreService.factoryReset();
  };

  const onTouchStart = (e: React.TouchEvent) => {
      setTouchEnd(null);
      setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const onTouchMove = (e: React.TouchEvent) => {
      setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const onTouchEnd = () => {
      if (!touchStart || !touchEnd) return;
      const distanceX = touchStart.x - touchEnd.x;
      const isRightSwipe = distanceX < -minSwipeDistance; 
      if (isRightSwipe && showRecycleBin) {
          setShowRecycleBin(false);
          window.history.back();
      }
  };

  if (!user) return null;
  const isGuest = user.id === 'guest_user';

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-32 animate-in fade-in">
        
        {/* --- DYNAMIC HEADER WITH MATERIAL PILL DESIGN --- */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    {user.photoURL ? (
                        <img 
                            src={user.photoURL} 
                            alt={user.name} 
                            className="w-16 h-16 rounded-full shadow-lg shrink-0 object-cover border-2 border-indigo-400"
                            referrerPolicy="no-referrer"
                        />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shrink-0">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold tracking-tight">{user.name}</h1>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-xs text-indigo-200 truncate max-w-[150px] sm:max-w-[200px]" title={user.id}>{user.id}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 uppercase tracking-wider ${
                                user.role === 'admin' 
                                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' 
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            }`}>
                                {user.role === 'admin' ? 'Administrator' : `Staff: ${user.staffRole === 'pos' ? 'POS' : 'Warehouse'}`}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                    {user.role === 'staff' && (
                        <button 
                            onClick={() => { setSessionLocked(true); setShowPinModal(true); }}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-5 py-2.5 rounded-full border-0 transition-all active:scale-95 cursor-pointer shadow-md shadow-amber-900/10"
                        >
                            <Lock size={14} />
                            <span>Lock Session</span>
                        </button>
                    )}
                    <button 
                        onClick={handleLogout}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-5 py-2.5 rounded-full border-0 transition-all active:scale-95 cursor-pointer shadow-md shadow-red-900/10"
                    >
                        <LogOut size={14} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>
        </div>

        {/* --- STAFF LOCK SCREEN OVERLAY --- */}
        {sessionLocked && user.role === 'staff' && (
            <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center border border-slate-100 shadow-2xl animate-in zoom-in duration-200">
                    <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Session Locked</h3>
                    <p className="text-xs text-gray-400 mt-1 mb-6">Enter your Secure PIN to unlock the console</p>
                    
                    <input 
                        type="password"
                        placeholder="••••"
                        maxLength={6}
                        value={pinInput}
                        onChange={e => setPinInput(e.target.value)}
                        className="w-full text-center py-3.5 bg-gray-50 border-2 border-gray-100 focus:border-indigo-500 rounded-2xl font-black text-xl outline-none tracking-widest mb-5"
                        onKeyDown={e => e.key === 'Enter' && handleVerifyStaffPin()}
                    />
                    
                    <div className="flex gap-2">
                        <button 
                            onClick={handleLogout}
                            className="flex-1 py-3 border border-gray-200 text-gray-600 font-bold rounded-full text-xs transition-colors hover:bg-gray-50 cursor-pointer bg-white"
                        >
                            Change Account
                        </button>
                        <button 
                            onClick={handleVerifyStaffPin}
                            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-full text-xs transition-colors cursor-pointer shadow-lg shadow-indigo-100 border-0"
                        >
                            Unlock
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- ADMIN ONLY: BUSINESS KPI TARGET PLANNER --- */}
        {user.role === 'admin' && storeSettings && (
            <Card className="p-6 border-0 shadow-sm ring-1 ring-black/5 bg-white rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-50 rounded-2xl text-emerald-600">
                            <Target size={20} />
                        </div>
                        <div>
                            <h3 className="font-black text-gray-950 text-sm uppercase tracking-wider">Business KPI Target Planner</h3>
                            <p className="text-[10px] text-gray-400 font-bold">Track and update store revenue achievements</p>
                        </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700">
                        {salesTargetPercent}% MET
                    </span>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-xs font-black text-gray-400 uppercase tracking-wide">
                        <span>Current Sales: ₹{totalRevenue.toLocaleString()}</span>
                        <span>Target: ₹{(storeSettings.salesTarget || 100000).toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-100 h-3.5 rounded-full overflow-hidden p-0.5 border border-gray-100">
                        <div 
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                            style={{ width: `${salesTargetPercent}%` }}
                        />
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed font-medium">
                        {salesTargetPercent >= 100 
                            ? "🎉 Incredible! You've achieved your store sales target. Scale your business further!" 
                            : `Keep pushing! You are ₹${Math.max(0, (storeSettings.salesTarget || 100000) - totalRevenue).toLocaleString()} away from your monthly target goal.`}
                    </p>
                </div>

                <div className="pt-3 border-t border-gray-50 flex flex-col sm:flex-row items-center gap-3">
                    <div className="w-full sm:flex-1 relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">₹</span>
                        <input 
                            type="number"
                            placeholder="Set New Revenue Target"
                            defaultValue={storeSettings.salesTarget || ''}
                            onBlur={async (e) => {
                                const val = parseInt(e.target.value) || 0;
                                if (val > 0) {
                                    await handleUpdateSettings({ salesTarget: val });
                                }
                            }}
                            className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border border-gray-100 focus:border-indigo-500 rounded-xl outline-none text-xs font-bold text-gray-900"
                        />
                    </div>
                    <span className="text-[9px] text-indigo-500 font-black uppercase tracking-wider shrink-0 bg-indigo-50 px-2.5 py-1.5 rounded-lg">
                        Auto-Saves on Blur
                    </span>
                </div>
            </Card>
        )}

        {/* --- ADMIN ONLY: SHARE DATABASE WITH STAFF --- */}
        {user.role === 'admin' && (
            <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-black/5 bg-white rounded-3xl">
                <button 
                    onClick={() => setShowShareCredentials(!showShareCredentials)}
                    className="w-full bg-white p-5 flex items-center justify-between font-bold text-gray-800 border-0 outline-none cursor-pointer"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                            <Cloud size={18} />
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-sm text-gray-900">Share Database with Staff</div>
                            <div className="text-[10px] text-gray-400 font-normal">Allow team members to connect to your warehouse cloud database</div>
                        </div>
                    </div>
                    {showShareCredentials ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                </button>
                
                {showShareCredentials && (
                    <div className="px-5 pb-5 pt-2 border-t border-gray-50 bg-gray-50/50 space-y-4">
                        <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100">
                            <p className="text-xs text-indigo-950 font-medium leading-relaxed">
                                Provide your staff with the following **Database ID**. They will use this ID along with their designated Staff ID and secure PIN to login and open their assigned permissions.
                            </p>
                        </div>
                        
                        <div className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-gray-100 gap-4">
                            <div className="min-w-0 pr-2">
                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Admin Database ID / User ID</div>
                                <div className="text-sm font-black text-indigo-900 truncate select-all">{user.id}</div>
                            </div>
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(user.id);
                                    alert("Database ID copied to clipboard!");
                                }}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-full border-0 cursor-pointer shadow-sm active:scale-95 transition-all shrink-0"
                            >
                                Copy ID
                            </button>
                        </div>
                    </div>
                )}
            </Card>
        )}

        {/* --- ADMIN ONLY: MANAGE STAFF & ROLES --- */}
        {user.role === 'admin' && (
            <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-black/5 bg-white rounded-3xl">
                <button 
                    onClick={() => setShowStaffSection(!showStaffSection)}
                    className="w-full bg-white p-5 flex items-center justify-between font-bold text-gray-800 border-0 outline-none cursor-pointer"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                            <Users size={18} />
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-sm text-gray-900">Staff Members & Permissions</div>
                            <div className="text-[10px] text-gray-400 font-normal">Edit or delete staff and assign POS-only or Inventory management privileges</div>
                        </div>
                    </div>
                    {showStaffSection ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                </button>
                
                {showStaffSection && (
                    <div className="px-5 pb-5 pt-3 border-t border-gray-50 bg-gray-50/50 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{staffMembers.length} Active Staff</span>
                            <button 
                                onClick={() => {
                                    setEditingStaffId(null);
                                    setStaffForm({ id: '', name: '', pin: '', role: 'pos' });
                                    setShowStaffModal(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-full border-0 cursor-pointer shadow active:scale-95 transition-all font-sans"
                            >
                                <UserPlus size={14} />
                                <span>Add Staff</span>
                            </button>
                        </div>

                        {staffMembers.length === 0 ? (
                            <div className="text-center py-8 bg-white rounded-2xl border border-gray-100 p-6 text-gray-400">
                                <Users size={32} className="mx-auto mb-2 opacity-30 text-gray-400" />
                                <p className="text-xs">No staff members registered. Add your first staff member to share access.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {staffMembers.map(member => (
                                    <div key={member.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center shadow-sm">
                                        <div>
                                            <div className="font-bold text-gray-800 text-sm flex flex-wrap items-center gap-2">
                                                <span>{member.name}</span>
                                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold shrink-0 uppercase tracking-wider ${
                                                    member.role === 'pos' 
                                                    ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                                                    : 'bg-purple-50 text-purple-700 border border-purple-100'
                                                }`}>
                                                    {member.role === 'pos' ? 'POS Only' : 'Inventory Only'}
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-3">
                                                <span>ID No: <strong className="font-bold text-gray-600">{member.id}</strong></span>
                                                <span>Session PIN: <strong className="font-bold text-gray-600">{member.pin}</strong></span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button 
                                                onClick={() => handleEditStaffClick(member)}
                                                className="px-4 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-full border-0 cursor-pointer transition-colors"
                                            >
                                                Edit
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteStaff(member.id)}
                                                className="px-4 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-full border-0 cursor-pointer transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </Card>
        )}

        {/* --- ADMIN ONLY: TRANSACTION LOG HISTORY --- */}
        {user.role === 'admin' && (
            <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-black/5 bg-white rounded-3xl">
                <button 
                    onClick={() => setShowHistorySection(!showHistorySection)}
                    className="w-full bg-white p-5 flex items-center justify-between font-bold text-gray-800 border-0 outline-none cursor-pointer"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                            <Clock size={18} />
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-sm text-gray-900">History of Product Updates & Deletes</div>
                            <div className="text-[10px] text-gray-400 font-normal">View audit trails of all warehouse additions, stock adjustments, and deletions</div>
                        </div>
                    </div>
                    {showHistorySection ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                </button>
                
                {showHistorySection && (
                    <div className="px-5 pb-5 pt-3 border-t border-gray-50 bg-gray-50/50 space-y-3">
                        <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                            <span>Audit Trail Records</span>
                            <span className="text-amber-700">{productHistory.length} events logged</span>
                        </div>
                        
                        {productHistory.length === 0 ? (
                            <div className="text-center py-8 bg-white rounded-2xl border border-gray-100 p-6 text-gray-400">
                                <Clock size={32} className="mx-auto mb-2 opacity-30 text-gray-400" />
                                <p className="text-xs">No updates or deletions recorded yet.</p>
                            </div>
                        ) : (
                            <div className="max-h-[350px] overflow-y-auto space-y-2.5 pr-1">
                                {productHistory.map(log => (
                                    <div key={log.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0 flex-1">
                                                <div className="font-bold text-gray-800 text-sm truncate">
                                                    {log.productName}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                                                    {log.details}
                                                </div>
                                            </div>
                                            <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-widest shrink-0 border ${
                                                log.action === 'create' 
                                                ? 'bg-green-50 text-green-700 border-green-100' 
                                                : log.action === 'delete'
                                                ? 'bg-red-50 text-red-700 border-red-100'
                                                : 'bg-blue-50 text-blue-700 border-blue-100'
                                            }`}>
                                                {log.action}
                                            </span>
                                        </div>
                                        <div className="border-t border-gray-50 pt-2 mt-3 flex justify-between items-center text-[10px] text-gray-400">
                                            <span className="font-semibold text-gray-500">Performer: {log.performedBy}</span>
                                            <span>{new Date(log.timestamp).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </Card>
        )}

        {/* --- DAILY SHIFT RECONCILIATION & CASH LOGS --- */}
        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-black/5 bg-white rounded-3xl">
            <div className="p-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-indigo-50 rounded-2xl text-indigo-600 shrink-0 mt-0.5">
                        <Scale size={18} />
                    </div>
                    <div>
                        <h3 className="font-black text-gray-950 text-sm uppercase tracking-wider">Shift Cash Reconciliation</h3>
                        <p className="text-[10px] text-gray-400 font-bold mt-0.5">Audit drawer cash balances at opening & closing shifts</p>
                    </div>
                </div>
                <button 
                    onClick={() => setShowShiftLogModal(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-full border-0 cursor-pointer shadow active:scale-95 transition-all"
                >
                    Log Balance
                </button>
            </div>

            {shiftHistory.length > 0 && (
                <div className="border-t border-gray-50 bg-gray-50/30 px-5 py-4 space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-black text-gray-400 uppercase tracking-wider">
                        <span>Recent Reconciled Shifts</span>
                        <button onClick={handleClearShiftHistory} className="text-red-500 hover:underline border-0 bg-transparent cursor-pointer font-bold uppercase text-[9px]">Clear History</button>
                    </div>
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
                        {shiftHistory.slice(0, 5).map(log => {
                            const isDiscrepancy = Math.abs(log.difference) > 0.1;
                            return (
                                <div key={log.id} className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">{new Date(log.timestamp).toLocaleString()}</span>
                                            <span className="text-xs font-black text-gray-800 block">Logged by {log.performedBy}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide uppercase ${
                                                isDiscrepancy 
                                                ? log.difference > 0 
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                                    : 'bg-rose-50 text-rose-700 border border-rose-100'
                                                : 'bg-green-50 text-green-700 border border-green-100'
                                            }`}>
                                                {isDiscrepancy 
                                                    ? `DIFF: ₹${log.difference.toLocaleString()}` 
                                                    : 'Perfect Balance'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-50 text-center text-[10px] font-bold text-gray-400 uppercase">
                                        <div>
                                            <span className="block text-xs font-black text-gray-800">₹{log.openingCash}</span>
                                            Opening
                                        </div>
                                        <div>
                                            <span className="block text-xs font-black text-gray-800">₹{log.expectedSales.toLocaleString()}</span>
                                            Expected
                                        </div>
                                        <div>
                                            <span className="block text-xs font-black text-gray-800">₹{log.closingCash}</span>
                                            Closing
                                        </div>
                                    </div>
                                    {log.notes && (
                                        <p className="text-[11px] text-gray-500 font-medium bg-gray-50 p-2 rounded-xl border border-gray-100/50">
                                            <strong>Notes:</strong> {log.notes}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </Card>

        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-black/5 rounded-3xl">
            <div className="bg-white p-4 border-b border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Store size={20} className="text-indigo-600"/>
                    <h2 className="font-bold text-gray-800">Store Profile</h2>
                </div>
                {!isEditingProfile ? (
                    <button onClick={handleStartEdit} className="text-blue-600 text-xs font-bold hover:underline">EDIT</button>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={() => { setIsEditingProfile(false); window.history.back(); }} className="text-gray-400 text-xs font-bold hover:text-gray-600">CANCEL</button>
                        <button onClick={handleSaveProfile} className="text-green-600 text-xs font-bold hover:text-green-700 flex items-center gap-1"><Save size={12}/> SAVE</button>
                    </div>
                )}
            </div>
            
            <div className="p-5">
                {isEditingProfile ? (
                    <div className="space-y-5 animate-in fade-in">
                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                             <div className="w-20 h-20 rounded-lg bg-white border border-gray-200 flex items-center justify-center overflow-hidden">
                                 {tempProfile.logo ? <img src={tempProfile.logo} alt="Logo" className="w-full h-full object-contain" /> : <ImageIcon className="text-gray-300" size={32} />}
                             </div>
                             <div>
                                 <input type="file" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
                                 <Button size="sm" variant="neutral" onClick={() => logoInputRef.current?.click()} className="flex items-center gap-2"><Upload size={14}/> Upload Logo</Button>
                                 <p className="text-[10px] text-gray-400 mt-2">Recommended: 200x200px</p>
                             </div>
                        </div>
                        <Input value={tempProfile.storeName} onChange={e => setTempProfile({...tempProfile, storeName: e.target.value})} className="!py-3 !px-4" placeholder="Store Name"/>
                        <Input value={tempProfile.storeAddress} onChange={e => setTempProfile({...tempProfile, storeAddress: e.target.value})} className="!py-3 !px-4" placeholder="Address"/>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <Input value={tempProfile.storePhone} onChange={e => setTempProfile({...tempProfile, storePhone: e.target.value})} className="!py-3 !px-4" placeholder="Phone"/>
                            <Input value={tempProfile.storeEmail} onChange={e => setTempProfile({...tempProfile, storeEmail: e.target.value})} className="!py-3 !px-4" placeholder="Email"/>
                        </div>
                        <div className="space-y-1 bg-violet-50/50 p-4 rounded-xl border border-violet-100">
                            <label className="text-xs font-bold text-violet-800 uppercase block mb-1">Merchant UPI ID (for Customer Portal payments)</label>
                            <Input value={tempProfile.upiId || ''} onChange={e => setTempProfile({...tempProfile, upiId: e.target.value})} className="!py-3 !px-4 bg-white" placeholder="e.g. storename@upi or phone@upi"/>
                            <p className="text-[10px] text-violet-600 mt-1">This UPI ID is used on the customer portal to generate dynamic UPI checkout buttons so customers can pay outstanding balances instantly from their mobile apps.</p>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Warehouse / Store Type</label>
                            <select
                                value={tempProfile.warehouseType || 'general'}
                                onChange={e => setTempProfile({...tempProfile, warehouseType: e.target.value})}
                                className="w-full py-3 px-4 bg-gray-50 border-2 border-gray-100 focus:border-indigo-500 rounded-xl font-medium outline-none text-sm text-gray-800 transition-colors"
                            >
                                <option value="general">General / Hardware Warehouse</option>
                                <option value="pharma">Pharmaceuticals & Clinical Products</option>
                                <option value="grocery">Grocery & Fresh Foods</option>
                                <option value="electronics">Consumer Electronics & Tech</option>
                                <option value="clothing">Clothing, Fashion & Apparel</option>
                            </select>
                        </div>
                        
                        <div className="border-t border-gray-100 pt-4 space-y-4">
                            <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest">Warehouse Details</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase">Warehouse Code / ID</label>
                                    <Input value={tempProfile.warehouseCode || ''} onChange={e => setTempProfile({...tempProfile, warehouseCode: e.target.value})} className="!py-3 !px-4" placeholder="e.g. WH-MAIN-01"/>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase">Warehouse Manager</label>
                                    <Input value={tempProfile.warehouseManager || ''} onChange={e => setTempProfile({...tempProfile, warehouseManager: e.target.value})} className="!py-3 !px-4" placeholder="Manager Name"/>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase">Storage Capacity (Units)</label>
                                    <Input type="number" value={tempProfile.warehouseCapacity || 5000} onChange={e => setTempProfile({...tempProfile, warehouseCapacity: parseInt(e.target.value) || 0})} className="!py-3 !px-4" placeholder="Capacity Limit"/>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase">Default Storage Zone</label>
                                    <Input value={tempProfile.warehouseZone || ''} onChange={e => setTempProfile({...tempProfile, warehouseZone: e.target.value})} className="!py-3 !px-4" placeholder="e.g. Zone A, Floor 2"/>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                         {storeSettings?.logo && <div className="mb-4 flex justify-center"><img src={storeSettings.logo} alt="Store Logo" className="h-16 object-contain" /></div>}
                        <div className="text-lg font-bold text-gray-900">{storeSettings?.storeName || 'Store Name Not Set'}</div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1"><MapPin size={14}/> {storeSettings?.storeAddress || 'Address Not Set'}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-50">
                            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg"><Phone size={14}/> {storeSettings?.storePhone || 'Phone Not Set'}</div>
                            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg"><Mail size={14}/> {storeSettings?.storeEmail || 'Email Not Set'}</div>
                        </div>
                        {storeSettings?.upiId && (
                            <div className="flex items-center gap-2 text-sm text-violet-700 bg-violet-50/50 border border-violet-100 p-2.5 rounded-lg mt-1 font-semibold">
                                <CreditCard size={14}/> <span>Merchant UPI ID: <strong className="font-bold select-all">{storeSettings.upiId}</strong></span>
                            </div>
                        )}
                        
                        <div className="border-t border-gray-100 pt-3 mt-2 grid grid-cols-2 gap-4">
                            {storeSettings?.warehouseCode && (
                                <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/50">
                                    <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Warehouse Code</div>
                                    <div className="text-sm font-black text-gray-800">{storeSettings.warehouseCode}</div>
                                </div>
                            )}
                            {storeSettings?.warehouseManager && (
                                <div className="bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100/50">
                                    <div className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Manager</div>
                                    <div className="text-sm font-black text-gray-800">{storeSettings.warehouseManager}</div>
                                </div>
                            )}
                            {storeSettings?.warehouseCapacity && (
                                <div className="bg-purple-50/50 p-2.5 rounded-xl border border-purple-100/50">
                                    <div className="text-[10px] text-purple-600 font-bold uppercase tracking-wider">Total Capacity</div>
                                    <div className="text-sm font-black text-gray-800">{storeSettings.warehouseCapacity.toLocaleString()} Units</div>
                                </div>
                            )}
                            {storeSettings?.warehouseZone && (
                                <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100/50">
                                    <div className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Default Zone</div>
                                    <div className="text-sm font-black text-gray-800">{storeSettings.warehouseZone}</div>
                                </div>
                            )}
                        </div>

                        <div className="pt-2 border-t border-gray-50 flex items-center gap-2">
                             <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 capitalize">
                                 Mode: {storeSettings?.warehouseType || 'general'} Warehouse
                             </span>
                        </div>
                    </div>
                )}
            </div>
        </Card>

        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-black/5">
            <div className="bg-white p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Settings size={20} className="text-indigo-600"/>
                    <h2 className="font-bold text-gray-800">System Preferences & Alerts</h2>
                </div>
            </div>
            <div className="p-5 space-y-6 divide-y divide-gray-100 bg-white">
                {/* Section 1: General Preferences */}
                <div className="space-y-4 pt-0">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><Hash size={14} className="text-gray-400"/> General Settings</h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="font-semibold text-gray-700 text-sm block">Currency Symbol</label>
                            <p className="text-xs text-gray-400">Currency displayed for pricing and reports.</p>
                        </div>
                        <input 
                            value={storeSettings?.currencySymbol || '₹'} 
                            onChange={(e) => handleUpdateSettings({ currencySymbol: e.target.value })} 
                            className="w-16 text-center font-bold text-sm bg-gray-50 border-2 border-gray-100 focus:border-indigo-500 rounded-lg p-2 transition-all outline-none" 
                        />
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="font-semibold text-gray-700 text-sm block">Sound Effects</label>
                            <p className="text-xs text-gray-400">Play audio feedback during POS or barcode scanning.</p>
                        </div>
                        <button 
                            onClick={() => handleUpdateSettings({ soundEnabled: !storeSettings?.soundEnabled })} 
                            className={`w-12 h-6 rounded-full transition-all duration-300 relative shrink-0 ${storeSettings?.soundEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 shadow ${storeSettings?.soundEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="font-semibold text-gray-700 text-sm block">Push Notifications</label>
                            <p className="text-xs text-gray-400">Show native reminders and inventory notifications.</p>
                        </div>
                        <button 
                            onClick={handleToggleNotifications} 
                            className={`w-12 h-6 rounded-full transition-all duration-300 relative shrink-0 ${storeSettings?.notificationsEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 shadow ${storeSettings?.notificationsEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="font-semibold text-gray-700 text-sm block">Recycle Bin Retention</label>
                            <p className="text-xs text-gray-400">Days to keep deleted items before automatic purge.</p>
                        </div>
                        <div className="flex items-center gap-1">
                            <input 
                                type="number"
                                value={recycleRetention} 
                                onChange={(e) => handleSaveRetention(parseInt(e.target.value) || 30)} 
                                className="w-16 text-center font-bold text-sm bg-gray-50 border-2 border-gray-100 focus:border-indigo-500 rounded-lg p-2 transition-all outline-none" 
                            />
                            <span className="text-xs text-gray-400 font-medium">days</span>
                        </div>
                    </div>
                </div>

                {/* Section 2: Stock & Expiry Alert Rules */}
                <div className="space-y-4 pt-6">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><Bell size={14} className="text-gray-400"/> Stock & Expiry Rules</h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="font-semibold text-gray-700 text-sm block">Low Stock Alert Limit (Global)</label>
                            <p className="text-xs text-gray-400">Default stock warning threshold for products.</p>
                        </div>
                        <div className="flex items-center gap-1">
                            <input 
                                type="number"
                                value={storeSettings?.lowStockDefault ?? 10} 
                                onChange={(e) => handleUpdateSettings({ lowStockDefault: parseInt(e.target.value) || 0 })} 
                                className="w-16 text-center font-bold text-sm bg-gray-50 border-2 border-gray-100 focus:border-indigo-500 rounded-lg p-2 transition-all outline-none" 
                            />
                            <span className="text-xs text-gray-400 font-medium">units</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="font-semibold text-gray-700 text-sm block">Expiry Notice Period</label>
                            <p className="text-xs text-gray-400">Days in advance to warn before batches expire.</p>
                        </div>
                        <div className="flex items-center gap-1">
                            <input 
                                type="number"
                                value={storeSettings?.expiryAlertDays ?? 7} 
                                onChange={(e) => handleUpdateSettings({ expiryAlertDays: parseInt(e.target.value) || 0 })} 
                                className="w-16 text-center font-bold text-sm bg-gray-50 border-2 border-gray-100 focus:border-indigo-500 rounded-lg p-2 transition-all outline-none" 
                            />
                            <span className="text-xs text-gray-400 font-medium">days</span>
                        </div>
                    </div>
                </div>

                {/* Section 3: Hardware & Print Configurations */}
                <div className="space-y-4 pt-6">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><Printer size={14} className="text-gray-400"/> Hardware & Accessories</h3>
                    
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="font-semibold text-gray-700 text-sm block">Direct thermal printing</label>
                            <p className="text-xs text-gray-400">Skip print dialogs and print receipts instantly on save.</p>
                        </div>
                        <button 
                            onClick={handleToggleDirectPrint} 
                            className={`w-12 h-6 rounded-full transition-all duration-300 relative shrink-0 ${storeSettings?.directPrintEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 shadow ${storeSettings?.directPrintEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </button>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <div>
                                <label className="font-semibold text-gray-700 text-sm block">Barcode Scanner Preference</label>
                                <p className="text-xs text-gray-400">Preferred hardware choice for scanning.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {([
                                { value: 'phone', label: 'Device Cam', icon: Smartphone },
                                { value: 'machine', label: 'External Gun', icon: Scan },
                                { value: 'both', label: 'Hybrid/Both', icon: RefreshCw }
                            ] as const).map(pref => (
                                <button
                                    key={pref.value}
                                    onClick={() => handleScannerPreferenceChange(pref.value)}
                                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold gap-1.5 transition-all ${storeSettings?.scannerPreference === pref.value ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                >
                                    <pref.icon size={16} />
                                    {pref.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Section 3.5: Custom Receipt Builder & Tax Configurator */}
                <div className="space-y-4 pt-6">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><FileText size={14} className="text-gray-400"/> Custom Receipt & Tax Configs</h3>
                    
                    <div className="space-y-3">
                        <div>
                            <label className="font-semibold text-gray-700 text-sm block">Receipt Header (Tagline)</label>
                            <input 
                                type="text"
                                placeholder="e.g. Thanks for shopping with us!"
                                defaultValue={storeSettings?.receiptHeader || ''}
                                onBlur={(e) => handleUpdateSettings({ receiptHeader: e.target.value })}
                                className="w-full mt-1 font-medium text-xs bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl p-3 outline-none transition-all" 
                            />
                        </div>
                        
                        <div>
                            <label className="font-semibold text-gray-700 text-sm block">Receipt Footer (Terms)</label>
                            <input 
                                type="text"
                                placeholder="e.g. No refund without original cash memo."
                                defaultValue={storeSettings?.receiptFooter || ''}
                                onBlur={(e) => handleUpdateSettings({ receiptFooter: e.target.value })}
                                className="w-full mt-1 font-medium text-xs bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl p-3 outline-none transition-all" 
                            />
                        </div>

                        <div className="flex items-center justify-between py-1">
                            <div>
                                <label className="font-semibold text-gray-700 text-sm block">Default Invoice Tax Rate</label>
                                <p className="text-xs text-gray-400">GST/Tax automatically applied to checkout carts.</p>
                            </div>
                            <select 
                                value={storeSettings?.taxRateDefault ?? 0}
                                onChange={(e) => handleUpdateSettings({ taxRateDefault: parseFloat(e.target.value) || 0 })}
                                className="font-black text-xs bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl p-2.5 outline-none cursor-pointer"
                            >
                                <option value={0}>0% Tax Free</option>
                                <option value={5}>5% standard GST</option>
                                <option value={12}>12% apparel/goods</option>
                                <option value={18}>18% luxury/services</option>
                            </select>
                        </div>

                        <div className="flex items-center justify-between py-1">
                            <div>
                                <label className="font-semibold text-gray-700 text-sm block">Show Store Logo on Invoices</label>
                                <p className="text-xs text-gray-400">Embed your uploaded logo at the top of printed receipts.</p>
                            </div>
                            <button 
                                onClick={() => handleUpdateSettings({ showLogoOnReceipt: !storeSettings?.showLogoOnReceipt })} 
                                className={`w-12 h-6 rounded-full transition-all duration-300 relative shrink-0 ${storeSettings?.showLogoOnReceipt ? 'bg-indigo-600' : 'bg-gray-200'}`}
                            >
                                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 shadow ${storeSettings?.showLogoOnReceipt ? 'translate-x-6' : 'translate-x-0'}`}></div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Section 4: Individual Product Low Stock Limits */}
                <div className="space-y-4 pt-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><Box size={14} className="text-gray-400"/> Individual Product stock limits</h3>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                        <input 
                            placeholder="Search product thresholds..." 
                            className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all w-full" 
                            value={settingsSearch} 
                            onChange={(e) => setSettingsSearch(e.target.value)} 
                        />
                    </div>
                    <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                        <div className="px-4 py-2 bg-gray-100/50 border-b border-gray-100 flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-wide">
                            <span>Individual Thresholds</span>
                            <span>Limit</span>
                        </div>
                        <div className="max-h-48 overflow-y-auto bg-white divide-y divide-gray-100">
                             {products.filter(p => p.name.toLowerCase().includes(settingsSearch.toLowerCase())).map(p => (
                                 <ProductSettingRow key={p.id} product={p} onUpdate={handleInlineProductUpdate} />
                             ))}
                             {products.filter(p => p.name.toLowerCase().includes(settingsSearch.toLowerCase())).length === 0 && (
                                 <div className="p-6 text-center text-gray-400 text-xs">No products found</div>
                             )}
                        </div>
                    </div>
                </div>
            </div>
        </Card>

        <Card className="p-0 overflow-hidden shadow-md ring-1 ring-black/5">
            <div className="bg-white p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm border bg-indigo-50 border-indigo-100 text-indigo-600">
                         <ShieldCheck size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-base">Real-time Firebase Sync</h3>
                        <p className="text-xs text-gray-400">All inventory documents are securely saved on Firebase.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-bold border border-green-200 rounded-full animate-pulse">ACTIVE</span>
                </div>
            </div>
        </Card>

        <div className="pt-4 flex flex-col gap-3">
            <button onClick={handleExport} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between group hover:border-blue-300 transition-all">
                <div className="flex items-center gap-3"><Download size={20} className="text-gray-400 group-hover:text-blue-500"/><span className="font-medium text-gray-700">Export Backup</span></div>
                <ChevronRight size={18} className="text-gray-300"/>
            </button>
            <button onClick={handleImportClick} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between group hover:border-purple-300 transition-all">
                <div className="flex items-center gap-3"><Upload size={20} className="text-gray-400 group-hover:text-purple-500"/><span className="font-medium text-gray-700">Import Backup</span></div>
                <ChevronRight size={18} className="text-gray-300"/>
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
            <button onClick={() => { setShowResetConfirm(true); window.history.pushState({ tab: Tab.PROFILE, depth: 1 }, ''); }} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between hover:bg-red-50"><div className="flex items-center gap-3"><AlertTriangle size={20} className="text-red-400"/><span className="font-medium text-red-600">Factory Reset</span></div></button>
        </div>

        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-black/5 hover:ring-blue-200 transition-all cursor-pointer mt-4" onClick={() => { setShowRecycleBin(true); window.history.pushState({ tab: Tab.PROFILE, depth: 1 }, ''); }}>
             <div className="bg-white p-4 border-b border-gray-100 flex items-center justify-between">
                 <div className="flex items-center gap-2"><Trash2 size={20} className="text-red-500"/><h2 className="font-bold text-gray-800">Recycle Bin</h2></div>
                 <div className="bg-red-50 text-red-600 px-2 py-1 rounded-full text-xs font-bold">{deletedItems.length} items</div>
             </div>
        </Card>

        <Modal isOpen={showRecycleBin} onClose={() => { setShowRecycleBin(false); window.history.back(); }} title="Recycle Bin" className="!max-w-4xl h-[80vh] flex flex-col p-0">
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
                <div className="px-6 py-4 bg-white border-b border-gray-200 flex justify-between items-center shrink-0">
                    <span className="text-sm text-gray-500 font-bold">Auto-delete after {recycleRetention} days</span>
                    {deletedItems.length > 0 && <Button size="sm" variant="danger" onClick={handleEmptyBin} className="bg-red-100 text-red-600">Empty Bin</Button>}
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {deletedItems.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-gray-400"><Trash2 size={48} className="mb-4 opacity-20"/><p>Empty.</p></div> : (
                        Object.entries(groupedDeletedItems).map(([dateLabel, items]) => (
                            <div key={dateLabel}>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">{dateLabel}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {(items as DeletedItem[]).map(item => {
                                        let Icon = Box; let name = "Unknown"; let detail = "";
                                        if (item.type === 'product') { Icon = Box; name = item.data.name; detail = `Stock: ${item.data.stock}`; }
                                        else if (item.type === 'customer') { Icon = Users; name = item.data.name; detail = item.data.phone; }
                                        else if (item.type === 'sale') { Icon = Receipt; name = `Invoice #${item.data.id.slice(0,6).toUpperCase()}`; detail = `₹${item.data.total}`; }
                                        return (
                                            <div key={item.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center group">
                                                <div className="flex items-center gap-3 overflow-hidden"><div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-gray-100 text-gray-600"><Icon size={20}/></div><div className="min-w-0"><div className="font-bold text-gray-800 text-sm truncate">{name}</div><div className="text-xs text-gray-400 truncate">{detail}</div></div></div>
                                                <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleRestoreItem(item.id)} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><RotateCcw size={16}/></button>
                                                    <button onClick={() => handlePermanentDelete(item.id)} className="p-2 bg-red-50 text-red-500 rounded-lg"><Trash2 size={16}/></button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Modal>

        <Modal isOpen={showResetConfirm} onClose={() => { setShowResetConfirm(false); window.history.back(); }} title="Factory Reset">
            <div className="text-center">
                <AlertTriangle className="mx-auto text-red-500 mb-4" size={32}/>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Are you sure?</h3>
                <p className="text-sm text-gray-600 mb-6">This will delete ALL data on this device.</p>
                <div className="flex gap-3"><Button variant="neutral" className="flex-1" onClick={() => { setShowResetConfirm(false); window.history.back(); }}>Cancel</Button><Button variant="danger" className="flex-1" onClick={handleReset}>Reset</Button></div>
            </div>
        </Modal>

        <Modal isOpen={showShiftLogModal} onClose={() => setShowShiftLogModal(false)} title="Shift Cash Reconciliation Log">
            <div className="space-y-4">
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-start gap-3">
                    <Scale size={20} className="text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-black text-indigo-900 text-xs uppercase tracking-widest">Active Cash Audit</h4>
                        <p className="text-indigo-800/80 text-[11px] leading-relaxed">
                            Audit drawer cash balances to find shortages or overages against the overall POS transactions.
                        </p>
                    </div>
                </div>

                <div className="space-y-3.5">
                    <div>
                        <label className="text-xs font-black text-gray-400 uppercase tracking-wider block mb-1">Opening Cash Balance (₹)</label>
                        <input 
                            type="number"
                            placeholder="0.00"
                            value={openingCash}
                            onChange={(e) => setOpeningCash(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 focus:border-indigo-500 rounded-2xl font-bold outline-none text-sm text-gray-900"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-black text-gray-400 uppercase tracking-wider block mb-1">Closing Cash Balance (₹)</label>
                        <input 
                            type="number"
                            placeholder="0.00"
                            value={closingCash}
                            onChange={(e) => setClosingCash(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 focus:border-indigo-500 rounded-2xl font-bold outline-none text-sm text-gray-900"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-black text-gray-400 uppercase tracking-wider block mb-1">Reconciliation Notes</label>
                        <textarea 
                            placeholder="e.g. Discrepancy due to custom discount or physical change mismatch"
                            value={shiftNotes}
                            onChange={(e) => setShiftNotes(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 focus:border-indigo-500 rounded-2xl font-semibold outline-none text-xs text-gray-900 h-20 resize-none"
                        />
                    </div>
                </div>

                {openingCash && closingCash && (
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-150 space-y-2.5">
                        <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-200 pb-1.5">Live Reconciliation Matrix</h5>
                        
                        <div className="flex justify-between text-xs font-bold text-gray-600">
                            <span>Register cash transactions:</span>
                            <span>+ ₹{totalRevenue.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold text-gray-600">
                            <span>Expected closing cash:</span>
                            <span>₹{((parseFloat(openingCash) || 0) + totalRevenue).toLocaleString()}</span>
                        </div>
                        
                        {(() => {
                            const open = parseFloat(openingCash) || 0;
                            const close = parseFloat(closingCash) || 0;
                            const expected = open + totalRevenue;
                            const diff = close - expected;
                            const isBalanced = Math.abs(diff) < 0.1;

                            return (
                                <div className="pt-2 border-t border-dashed border-gray-200 flex justify-between items-center">
                                    <span className="text-xs font-black text-gray-800 uppercase">Audit Difference:</span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide border ${
                                        isBalanced 
                                        ? 'bg-green-50 text-green-700 border-green-200' 
                                        : diff > 0 
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                            : 'bg-rose-50 text-rose-700 border-rose-200'
                                    }`}>
                                        {isBalanced 
                                            ? 'Perfect Balance' 
                                            : diff > 0 
                                                ? `Overage (+ ₹${diff.toLocaleString()})` 
                                                : `Shortage (- ₹${Math.abs(diff).toLocaleString()})`}
                                    </span>
                                </div>
                            );
                        })()}
                    </div>
                )}

                <div className="flex gap-3 pt-2">
                    <Button variant="neutral" className="flex-1 py-3.5 font-bold uppercase text-xs" onClick={() => setShowShiftLogModal(false)}>
                        Cancel
                    </Button>
                    <Button className="flex-1 py-3.5 font-bold uppercase text-xs shadow-lg shadow-indigo-100" onClick={handleSaveShiftLog}>
                        Submit Audit
                    </Button>
                </div>
            </div>
        </Modal>

        <Modal isOpen={showStaffModal} onClose={() => setShowStaffModal(false)} title={editingStaffId ? "Edit Staff Credentials" : "Register New Staff Member"}>
            <form onSubmit={handleSaveStaff} className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3">
                    <Users size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-black text-emerald-900 text-xs uppercase tracking-widest">Staff Access Control</h4>
                        <p className="text-emerald-800/80 text-[11px] leading-relaxed">
                            Assign roles and secure PIN codes to allow staff members to login and manage POS or warehouse modules.
                        </p>
                    </div>
                </div>

                <div className="space-y-3.5">
                    <div>
                        <label className="text-xs font-black text-gray-400 uppercase tracking-wider block mb-1">Staff ID (Username)</label>
                        <input 
                            type="text"
                            placeholder="e.g. johndoe"
                            disabled={!!editingStaffId}
                            value={staffForm.id}
                            onChange={(e) => setStaffForm({ ...staffForm, id: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 focus:border-indigo-500 rounded-2xl font-bold outline-none text-sm text-gray-900 disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-black text-gray-400 uppercase tracking-wider block mb-1">Staff Name</label>
                        <input 
                            type="text"
                            placeholder="e.g. John Doe"
                            value={staffForm.name}
                            onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 focus:border-indigo-500 rounded-2xl font-bold outline-none text-sm text-gray-900"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-black text-gray-400 uppercase tracking-wider block mb-1">Secure Sign-In PIN</label>
                        <input 
                            type="password"
                            placeholder="Min 4 digits"
                            maxLength={6}
                            value={staffForm.pin}
                            onChange={(e) => setStaffForm({ ...staffForm, pin: e.target.value.replace(/\D/g, '') })}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 focus:border-indigo-500 rounded-2xl font-bold outline-none text-sm text-gray-900 tracking-widest"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-black text-gray-400 uppercase tracking-wider block mb-1">Assigned Role & Privilege</label>
                        <select
                            value={staffForm.role}
                            onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as 'pos' | 'inventory' })}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 focus:border-indigo-500 rounded-2xl font-bold outline-none text-sm text-gray-900 cursor-pointer"
                        >
                            <option value="pos">POS Terminal (Sales & Invoicing)</option>
                            <option value="inventory">Warehouse Manager (Stock & Deliveries)</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <Button type="button" variant="neutral" className="flex-1 py-3.5 font-bold uppercase text-xs" onClick={() => setShowStaffModal(false)}>
                        Cancel
                    </Button>
                    <Button type="submit" className="flex-1 py-3.5 font-bold uppercase text-xs shadow-lg shadow-emerald-100 bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                        {editingStaffId ? "Save Changes" : "Register Staff"}
                    </Button>
                </div>
            </form>
        </Modal>

        <div className="text-center text-xs text-gray-400 pt-8 pb-4">Noor POS v1.6.3</div>
    </div>
  );
};
