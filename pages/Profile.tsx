import React, { useEffect, useState, useRef, useMemo } from 'react';
import { User, StoreSettings, DeletedItem, Tab } from '../types';
import { Card, Button, Input, Badge } from '../components/UI';
import { LogOut, AlertTriangle, Cloud, Settings, Store, Bell, Save, Download, Upload, ChevronRight, ChevronDown, HardDrive, Image as ImageIcon, FileText, Users, UserPlus, Trash2, RotateCcw, Box, Receipt, Clock, Printer, Scan, Smartphone, RefreshCw, Search, Lock, Scale, Target, Edit3 } from 'lucide-react';
import { StoreService } from '../services/storeService';
import { ProfileModals } from '../components/profile/ProfileModals';

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

interface SettingRowProps {
    icon: React.ComponentType<{ size: number; className?: string }>;
    iconBg: string;
    iconColor: string;
    title: string;
    description: string;
    rightElement?: React.ReactNode;
    isExpanded?: boolean;
    onClick?: () => void;
    children?: React.ReactNode;
}

const SettingRow: React.FC<SettingRowProps> = ({
    icon: Icon,
    iconBg,
    iconColor,
    title,
    description,
    rightElement,
    isExpanded,
    onClick,
    children
}) => {
    return (
        <div className="border-b border-slate-50 last:border-0">
            <div 
                onClick={onClick}
                className="flex items-center justify-between p-4 hover:bg-slate-50/80 transition-all cursor-pointer select-none"
            >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className={`p-2.5 rounded-2xl shrink-0 ${iconBg} ${iconColor}`}>
                        <Icon size={18} />
                    </div>
                    <div className="min-w-0 text-left">
                        <h4 className="font-bold text-gray-900 text-sm tracking-tight">{title}</h4>
                        <p className="text-[11px] text-gray-500 mt-0.5 font-medium truncate sm:whitespace-normal">{description}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 pl-2">
                    {rightElement}
                    {onClick && (
                        isExpanded ? (
                            <ChevronDown size={16} className="text-gray-400 transition-transform duration-200" />
                        ) : (
                            <ChevronRight size={16} className="text-gray-400 transition-transform duration-200" />
                        )
                    )}
                </div>
            </div>
            {isExpanded && children && (
                <div className="px-5 pb-5 pt-1 bg-slate-50/40 border-t border-slate-50/50 animate-in fade-in slide-in-from-top-1 duration-200">
                    {children}
                </div>
            )}
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
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
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
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const requestConfirmation = (title: string, message: string, onConfirm: () => void | Promise<void>) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: async () => {
        await onConfirm();
        setConfirmDialog(null);
      }
    });
  };

  // Gesture State
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [touchEnd, setTouchEnd] = useState<{x: number, y: number} | null>(null);
  const minSwipeDistance = 50;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

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

  const handleDeleteStaff = (staffId: string) => {
      requestConfirmation(
          "Delete Staff Member",
          "Are you sure you want to delete this staff member? They will lose access immediately.",
          async () => {
              await StoreService.deleteStaffMember(staffId);
              loadData();
          }
      );
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
      requestConfirmation(
          "Clear Shift Records",
          "Are you sure you want to delete all shift records? This is permanent.",
          () => {
              setShiftHistory([]);
              localStorage.removeItem('noor_shift_history');
          }
      );
  };

  const handleRestoreItem = async (id: string) => {
      await StoreService.restoreItem(id);
      loadData();
  };

  const handlePermanentDelete = (id: string) => {
      requestConfirmation(
          "Permanently Delete Item",
          "Delete this item permanently? This cannot be undone.",
          async () => {
              await StoreService.permanentlyDelete(id);
              loadData();
          }
      );
  };

  const handleEmptyBin = () => {
      requestConfirmation(
          "Empty Recycle Bin",
          "Are you sure? This will permanently remove all items in the recycle bin.",
          async () => {
              await StoreService.emptyRecycleBin();
              loadData();
          }
      );
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
  
  const handleLogout = () => {
      requestConfirmation(
          "Sign Out",
          "Are you sure you want to sign out? Any local unsaved cache changes might be cleared.",
          async () => {
              await StoreService.logout();
              onLogout();
          }
      );
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
      reader.onload = (readerEvent) => {
          try {
              const json = JSON.parse(readerEvent.target?.result as string);
              requestConfirmation(
                  "Overwrite Store Data",
                  "Are you sure you want to overwrite your current store database with this backup file? This action is permanent and cannot be undone.",
                  async () => {
                      await StoreService.importData(json);
                  }
              );
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

  const toggleRow = (rowName: string | null) => {
      setExpandedRow(prev => prev === rowName ? null : rowName);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-32 animate-in fade-in">
        
        {/* --- PREMIUM DYNAMIC HEADER CARD --- */}
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800/80 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
                <div className="flex items-center gap-4">
                    {user.photoURL ? (
                        <img 
                            src={user.photoURL} 
                            alt={user.name} 
                            className="w-16 h-16 rounded-full shadow-lg shrink-0 object-cover border-2 border-indigo-400/80"
                            referrerPolicy="no-referrer"
                        />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-2xl font-black shadow-lg shrink-0 border border-indigo-400/30">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="min-w-0 text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl font-bold tracking-tight">{user.name}</h1>
                            <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/15 text-emerald-400 rounded-full text-[9px] font-extrabold border border-emerald-500/20 uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                Firebase Synced
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <span className="text-xs text-indigo-300 font-medium truncate max-w-[150px] sm:max-w-[200px]" title={user.id}>ID: {user.id.slice(0, 10)}...</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 uppercase tracking-wider ${
                                user.role === 'admin' 
                                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' 
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            }`}>
                                {user.role === 'admin' ? 'Administrator' : `Staff: ${user.staffRole === 'pos' ? 'POS' : 'Warehouse'}`}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 shrink-0">
                    {user.role === 'staff' && (
                        <button 
                            onClick={() => { setSessionLocked(true); setShowPinModal(true); }}
                            className="inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 rounded-full border-0 transition-all active:scale-95 cursor-pointer shadow-md shadow-amber-950/20"
                        >
                            <Lock size={13} />
                            <span>Lock</span>
                        </button>
                    )}
                    <button 
                        onClick={handleLogout}
                        className="inline-flex items-center justify-center gap-2 bg-red-600/95 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-full border-0 transition-all active:scale-95 cursor-pointer shadow-md shadow-red-950/20"
                    >
                        <LogOut size={13} />
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
                            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-full text-xs transition-colors cursor-pointer shadow-lg shadow-indigo-150 border-0"
                        >
                            Unlock
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ==========================================
            GROUP 1: ACCOUNT & BUSINESS SETUP
            ========================================== */}
        <div className="space-y-2">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5 px-1">Store & Business Setup</div>
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
                
                {/* 1.1 Store Details */}
                <SettingRow
                    icon={Store}
                    iconBg="bg-indigo-50"
                    iconColor="text-indigo-600"
                    title="Store Details & Profile"
                    description="Edit store logo, name, address, phone, and upi details"
                    isExpanded={expandedRow === 'store_details'}
                    onClick={() => {
                        toggleRow('store_details');
                        if (!isEditingProfile) handleStartEdit();
                    }}
                    rightElement={
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50/50 px-2.5 py-1 rounded-lg">
                            {isEditingProfile ? 'Editing' : 'View'}
                        </span>
                    }
                >
                    {isEditingProfile ? (
                        <div className="space-y-4 pt-3">
                            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                 <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                                     {tempProfile.logo ? <img src={tempProfile.logo} alt="Logo" className="w-full h-full object-contain" /> : <ImageIcon className="text-slate-300" size={24} />}
                                 </div>
                                 <div className="text-left">
                                     <input type="file" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
                                     <Button size="sm" variant="neutral" onClick={() => logoInputRef.current?.click()} className="flex items-center gap-2"><Upload size={13}/> Upload Logo</Button>
                                     <p className="text-[9px] text-slate-400 mt-1.5 font-medium">Recommended: 200x200px</p>
                                 </div>
                            </div>
                            <div className="space-y-3">
                                <Input value={tempProfile.storeName} onChange={e => setTempProfile({...tempProfile, storeName: e.target.value})} className="!py-2.5 !px-3.5" placeholder="Store Name"/>
                                <Input value={tempProfile.storeAddress} onChange={e => setTempProfile({...tempProfile, storeAddress: e.target.value})} className="!py-2.5 !px-3.5" placeholder="Address"/>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Input value={tempProfile.storePhone} onChange={e => setTempProfile({...tempProfile, storePhone: e.target.value})} className="!py-2.5 !px-3.5" placeholder="Phone"/>
                                    <Input value={tempProfile.storeEmail} onChange={e => setTempProfile({...tempProfile, storeEmail: e.target.value})} className="!py-2.5 !px-3.5" placeholder="Email"/>
                                </div>
                                <div className="space-y-1 bg-violet-50/40 p-3.5 rounded-2xl border border-violet-100 text-left">
                                    <label className="text-[10px] font-extrabold text-violet-800 uppercase block mb-1">Merchant UPI ID</label>
                                    <Input value={tempProfile.upiId || ''} onChange={e => setTempProfile({...tempProfile, upiId: e.target.value})} className="!py-2.5 !px-3.5 bg-white border-violet-200" placeholder="e.g. storename@upi"/>
                                    <p className="text-[9px] text-violet-600 mt-1 font-medium leading-relaxed">UPI ID is used on the customer portal to generate QR code checkout options dynamically.</p>
                                </div>
                                <div className="space-y-1 text-left">
                                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Warehouse / Store Type</label>
                                    <select
                                        value={tempProfile.warehouseType || 'general'}
                                        onChange={e => setTempProfile({...tempProfile, warehouseType: e.target.value})}
                                        className="w-full py-2.5 px-3.5 bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 rounded-xl font-semibold outline-none text-xs text-slate-800 transition-colors"
                                    >
                                        <option value="general">General / Hardware Warehouse</option>
                                        <option value="pharma">Pharmaceuticals & Clinical Products</option>
                                        <option value="grocery">Grocery & Fresh Foods</option>
                                        <option value="electronics">Consumer Electronics & Tech</option>
                                        <option value="clothing">Clothing, Fashion & Apparel</option>
                                    </select>
                                </div>
                                
                                <div className="pt-2.5 space-y-3 border-t border-slate-100 text-left">
                                    <h5 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Warehouse Custom Fields</h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-0.5">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase">Warehouse Code</label>
                                            <Input value={tempProfile.warehouseCode || ''} onChange={e => setTempProfile({...tempProfile, warehouseCode: e.target.value})} className="!py-2 !px-3 !text-xs" placeholder="WH-MAIN-01"/>
                                        </div>
                                        <div className="space-y-0.5">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase">Warehouse Manager</label>
                                            <Input value={tempProfile.warehouseManager || ''} onChange={e => setTempProfile({...tempProfile, warehouseManager: e.target.value})} className="!py-2 !px-3 !text-xs" placeholder="John Doe"/>
                                        </div>
                                        <div className="space-y-0.5">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase">Capacity (Units)</label>
                                            <Input type="number" value={tempProfile.warehouseCapacity || 5000} onChange={e => setTempProfile({...tempProfile, warehouseCapacity: parseInt(e.target.value) || 0})} className="!py-2 !px-3 !text-xs" placeholder="Capacity Limit"/>
                                        </div>
                                        <div className="space-y-0.5">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase">Default Storage Zone</label>
                                            <Input value={tempProfile.warehouseZone || ''} onChange={e => setTempProfile({...tempProfile, warehouseZone: e.target.value})} className="!py-2 !px-3 !text-xs" placeholder="Zone A"/>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2 border-t border-slate-50">
                                <button 
                                    onClick={() => { setIsEditingProfile(false); toggleRow(null); }} 
                                    className="flex-1 py-2.5 border border-slate-200 text-slate-500 font-bold rounded-xl text-xs bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={async () => {
                                        await handleSaveProfile();
                                        toggleRow(null);
                                    }} 
                                    className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 border-0 cursor-pointer shadow-sm"
                                >
                                    <Save size={14} />
                                    <span>Save Details</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 pt-3">
                            {storeSettings?.logo && (
                                <div className="flex justify-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                    <img src={storeSettings.logo} alt="Store Logo" className="h-12 object-contain" />
                                </div>
                            )}
                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100/80 space-y-3 text-xs font-medium text-slate-700 text-left">
                                <div className="flex justify-between border-b border-slate-100 pb-2">
                                    <span className="text-slate-400 font-bold uppercase text-[9px]">Store Name:</span>
                                    <span className="font-bold text-slate-900 text-right">{storeSettings?.storeName || 'Not Set'}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-2">
                                    <span className="text-slate-400 font-bold uppercase text-[9px]">Address:</span>
                                    <span className="font-semibold text-slate-800 text-right max-w-[200px] truncate">{storeSettings?.storeAddress || 'Not Set'}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-2">
                                    <span className="text-slate-400 font-bold uppercase text-[9px]">Phone / Email:</span>
                                    <span className="text-right">{storeSettings?.storePhone || 'Not Set'} | {storeSettings?.storeEmail || 'Not Set'}</span>
                                </div>
                                {storeSettings?.upiId && (
                                    <div className="flex justify-between border-b border-slate-100 pb-2 text-violet-700">
                                        <span className="text-violet-400 font-bold uppercase text-[9px]">UPI ID:</span>
                                        <span className="font-bold select-all">{storeSettings.upiId}</span>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    {storeSettings?.warehouseCode && (
                                        <div className="bg-white p-2 rounded-xl border border-slate-100">
                                            <div className="text-[8px] text-slate-400 font-bold uppercase">Code</div>
                                            <div className="font-bold text-slate-900 text-xs">{storeSettings.warehouseCode}</div>
                                        </div>
                                    )}
                                    {storeSettings?.warehouseManager && (
                                        <div className="bg-white p-2 rounded-xl border border-slate-100">
                                            <div className="text-[8px] text-slate-400 font-bold uppercase">Manager</div>
                                            <div className="font-bold text-slate-900 text-xs">{storeSettings.warehouseManager}</div>
                                        </div>
                                    )}
                                    {storeSettings?.warehouseCapacity && (
                                        <div className="bg-white p-2 rounded-xl border border-slate-100">
                                            <div className="text-[8px] text-slate-400 font-bold uppercase">Capacity</div>
                                            <div className="font-bold text-slate-900 text-xs">{storeSettings.warehouseCapacity.toLocaleString()} Units</div>
                                        </div>
                                    )}
                                    {storeSettings?.warehouseZone && (
                                        <div className="bg-white p-2 rounded-xl border border-slate-100">
                                            <div className="text-[8px] text-slate-400 font-bold uppercase">Zone</div>
                                            <div className="font-bold text-slate-900 text-xs">{storeSettings.warehouseZone}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <Button 
                                size="sm" 
                                variant="neutral" 
                                className="w-full flex items-center justify-center gap-1 border-slate-200 text-slate-700 hover:bg-slate-50 py-2.5 font-bold cursor-pointer"
                                onClick={() => setIsEditingProfile(true)}
                            >
                                <Edit3 size={14} />
                                <span>Modify Details</span>
                            </Button>
                        </div>
                    )}
                </SettingRow>

                {/* 1.2 KPI Revenue Target Planner */}
                {user.role === 'admin' && storeSettings && (
                    <SettingRow
                        icon={Target}
                        iconBg="bg-emerald-50"
                        iconColor="text-emerald-600"
                        title="Business KPI Target Planner"
                        description="Track and scale store revenue goals"
                        isExpanded={expandedRow === 'kpi_planner'}
                        onClick={() => toggleRow('kpi_planner')}
                        rightElement={
                            <Badge variant={salesTargetPercent >= 100 ? 'success' : 'neutral'} className="font-extrabold uppercase shrink-0 text-[10px]">
                                {salesTargetPercent}% MET
                            </Badge>
                        }
                    >
                        <div className="space-y-4 pt-3.5">
                            <div className="space-y-2.5">
                                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-wide">
                                    <span>Current: ₹{totalRevenue.toLocaleString()}</span>
                                    <span>Target: ₹{(storeSettings.salesTarget || 100000).toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-150/40">
                                    <div 
                                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                                        style={{ width: `${salesTargetPercent}%` }}
                                    />
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed font-medium text-left">
                                    {salesTargetPercent >= 100 
                                        ? "🎉 Incredible achievement! Your store exceeded its monthly targets. Scale up for extra growth!" 
                                        : `You are ₹${Math.max(0, (storeSettings.salesTarget || 100000) - totalRevenue).toLocaleString()} away from meeting the current target goals.`}
                                </p>
                            </div>

                            <div className="pt-2.5 border-t border-slate-100 flex items-center gap-3">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
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
                                        className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl outline-none text-xs font-bold text-slate-900"
                                    />
                                </div>
                                <span className="text-[8px] text-indigo-500 font-black uppercase tracking-wider shrink-0 bg-indigo-50 px-2 py-1.5 rounded-lg border border-indigo-100/40">
                                    Auto-Saves
                                </span>
                            </div>
                        </div>
                    </SettingRow>
                )}

                {/* 1.3 Share Database ID */}
                {user.role === 'admin' && (
                    <SettingRow
                        icon={Cloud}
                        iconBg="bg-blue-50"
                        iconColor="text-blue-600"
                        title="Share Database with Staff"
                        description="Allow staff members to connect with your warehouse database"
                        isExpanded={expandedRow === 'share_database'}
                        onClick={() => toggleRow('share_database')}
                        rightElement={
                            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                                {user.id.slice(0, 6).toUpperCase()}...
                            </span>
                        }
                    >
                        <div className="space-y-3 pt-3.5">
                            <p className="text-xs text-slate-600 font-medium leading-relaxed text-left">
                                Provide your staff with the following **Database ID**. They will input this ID on their login console to authenticate and fetch the corresponding store catalog safely.
                            </p>
                            
                            <div className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-100 gap-3">
                                <div className="min-w-0 flex-1 pr-1 text-left">
                                    <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Database ID</div>
                                    <div className="text-xs font-black text-indigo-900 truncate select-all">{user.id}</div>
                                </div>
                                <button 
                                    onClick={() => {
                                        navigator.clipboard.writeText(user.id);
                                        alert("Database ID copied to clipboard!");
                                    }}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-full border-0 cursor-pointer shadow-sm active:scale-95 transition-all shrink-0"
                                >
                                    Copy ID
                                </button>
                            </div>
                        </div>
                    </SettingRow>
                )}
            </div>
        </div>

        {/* ==========================================
            GROUP 2: TEAM & OPERATIONS AUDITING
            ========================================== */}
        <div className="space-y-2">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5 px-1">Team & Operations</div>
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
                
                {/* 2.1 Staff Access Control */}
                {user.role === 'admin' && (
                    <SettingRow
                        icon={Users}
                        iconBg="bg-emerald-50"
                        iconColor="text-emerald-600"
                        title="Staff Members & Logins"
                        description="Configure staff logins, privilege roles, and secure PIN codes"
                        isExpanded={expandedRow === 'staff_members'}
                        onClick={() => toggleRow('staff_members')}
                        rightElement={
                            <Badge variant="neutral" className="font-bold shrink-0 text-[10px]">
                                {staffMembers.length} ACTIVE
                            </Badge>
                        }
                    >
                        <div className="space-y-3.5 pt-3.5">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registered Team Members</span>
                                <button 
                                    onClick={() => {
                                        setEditingStaffId(null);
                                        setStaffForm({ id: '', name: '', pin: '', role: 'pos' });
                                        setShowStaffModal(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-full border-0 cursor-pointer shadow-sm active:scale-95 transition-all font-sans"
                                >
                                    <UserPlus size={12} />
                                    <span>Add Staff</span>
                                </button>
                            </div>

                            {staffMembers.length === 0 ? (
                                <div className="text-center py-6 bg-slate-50/50 rounded-2xl border border-slate-100/60 p-4 text-slate-400">
                                    <Users size={24} className="mx-auto mb-1.5 opacity-30" />
                                    <p className="text-[11px] font-semibold">No registered staff members found. Add staff to share load.</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                    {staffMembers.map(member => (
                                        <div key={member.id} className="bg-slate-50/40 p-3 rounded-2xl border border-slate-100/60 flex justify-between items-center text-left">
                                            <div>
                                                <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                                    <span>{member.name}</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider shrink-0 ${
                                                        member.role === 'pos' 
                                                        ? 'bg-amber-50 text-amber-700 border border-amber-100/50' 
                                                        : 'bg-purple-50 text-purple-700 border border-purple-100/50'
                                                    }`}>
                                                        {member.role === 'pos' ? 'POS Only' : 'Inventory Only'}
                                                    </span>
                                                </div>
                                                <div className="text-[9px] text-slate-400 mt-1 flex items-center gap-2.5">
                                                    <span>ID: <strong className="font-semibold text-slate-600">{member.id}</strong></span>
                                                    <span>PIN: <strong className="font-semibold text-slate-600">{member.pin}</strong></span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button 
                                                    onClick={() => handleEditStaffClick(member)}
                                                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] rounded-lg border-0 cursor-pointer"
                                                >
                                                    Edit
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteStaff(member.id)}
                                                    className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[10px] rounded-lg border-0 cursor-pointer"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </SettingRow>
                )}

                {/* 2.2 Product Update History */}
                {user.role === 'admin' && (
                    <SettingRow
                        icon={Clock}
                        iconBg="bg-amber-50"
                        iconColor="text-amber-600"
                        title="Inventory Audit Logs"
                        description="Review actions, stock updates, additions, and deletions"
                        isExpanded={expandedRow === 'product_history'}
                        onClick={() => toggleRow('product_history')}
                        rightElement={
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100/50">
                                {productHistory.length} EVENTS
                            </span>
                        }
                    >
                        <div className="space-y-2.5 pt-3.5">
                            {productHistory.length === 0 ? (
                                <div className="text-center py-6 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 text-slate-400">
                                    <Clock size={24} className="mx-auto mb-1.5 opacity-30" />
                                    <p className="text-[11px] font-semibold">No transactions or changes recorded yet.</p>
                                </div>
                            ) : (
                                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                                    {productHistory.map(log => (
                                        <div key={log.id} className="bg-slate-50/40 p-3 rounded-2xl border border-slate-100/60 shadow-none text-left">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-bold text-slate-800 text-xs truncate">{log.productName}</div>
                                                    <div className="text-[10px] text-slate-500 mt-1 leading-normal font-medium">{log.details}</div>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-widest shrink-0 border ${
                                                    log.action === 'create' 
                                                    ? 'bg-green-50 text-green-700 border-green-100' 
                                                    : log.action === 'delete'
                                                    ? 'bg-red-50 text-red-700 border-red-100'
                                                    : 'bg-blue-50 text-blue-700 border-blue-100'
                                                }`}>
                                                    {log.action}
                                                </span>
                                            </div>
                                            <div className="border-t border-slate-100/50 pt-1.5 mt-2 flex justify-between items-center text-[9px] text-slate-400">
                                                <span className="font-semibold text-slate-500">ByUser: {log.performedBy}</span>
                                                <span>{new Date(log.timestamp).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </SettingRow>
                )}

                {/* 2.3 Shift Cash Reconciliation */}
                <SettingRow
                    icon={Scale}
                    iconBg="bg-indigo-50"
                    iconColor="text-indigo-600"
                    title="Shift Cash Reconciliation"
                    description="Audit registers and cash drawer balances between shifts"
                    isExpanded={expandedRow === 'shift_recon'}
                    onClick={() => toggleRow('shift_recon')}
                    rightElement={
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowShiftLogModal(true);
                            }}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-full border-0 shadow-sm active:scale-95 transition-all cursor-pointer"
                        >
                            Log Cash
                        </button>
                    }
                >
                    <div className="space-y-3 pt-3.5">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <span>Recent Cash Reconciliation History</span>
                            {shiftHistory.length > 0 && (
                                <button onClick={handleClearShiftHistory} className="text-red-500 hover:underline border-0 bg-transparent cursor-pointer font-bold uppercase text-[9px]">
                                    Clear Logs
                                </button>
                            )}
                        </div>
                        {shiftHistory.length === 0 ? (
                            <div className="text-center py-6 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 text-slate-400">
                                <Scale size={24} className="mx-auto mb-1.5 opacity-30" />
                                <p className="text-[11px] font-semibold">No shift audits logged yet. Keep audits to track cash variance.</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                {shiftHistory.slice(0, 5).map(log => {
                                    const isDiscrepancy = Math.abs(log.difference) > 0.1;
                                    return (
                                        <div key={log.id} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm space-y-2 text-left">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">{new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                    <span className="text-[11px] font-black text-slate-800 block">Audited by: {log.performedBy}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-extrabold tracking-wide uppercase border ${
                                                        isDiscrepancy 
                                                        ? log.difference > 0 
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                            : 'bg-rose-50 text-rose-700 border-rose-100'
                                                        : 'bg-green-50 text-green-700 border-green-100'
                                                    }`}>
                                                        {isDiscrepancy 
                                                            ? `DIFF: ₹${log.difference.toLocaleString()}` 
                                                            : 'Balanced'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-50 text-center text-[9px] font-bold text-slate-400 uppercase">
                                                <div>
                                                    <span className="block text-xs font-black text-slate-800">₹{log.openingCash}</span>
                                                    Open
                                                </div>
                                                <div>
                                                    <span className="block text-xs font-black text-slate-800">₹{log.expectedSales.toLocaleString()}</span>
                                                    Sales
                                                </div>
                                                <div>
                                                    <span className="block text-xs font-black text-slate-800">₹{log.closingCash}</span>
                                                    Close
                                                </div>
                                            </div>
                                            {log.notes && (
                                                <p className="text-[10px] text-slate-500 font-semibold bg-slate-50 p-2 rounded-xl border border-slate-100/50">
                                                    <strong>Note:</strong> {log.notes}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </SettingRow>
            </div>
        </div>

        {/* ==========================================
            GROUP 3: SYSTEM PREFERENCES & CONFIGURATIONS
            ========================================== */}
        <div className="space-y-2">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5 px-1">System Preferences & Settings</div>
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
                
                {/* 3.1 General App Preferences */}
                <SettingRow
                    icon={Settings}
                    iconBg="bg-indigo-50"
                    iconColor="text-indigo-600"
                    title="General Settings"
                    description="Currency, sound feedback, notifications, and retention rules"
                    isExpanded={expandedRow === 'general_prefs'}
                    onClick={() => toggleRow('general_prefs')}
                >
                    <div className="space-y-3.5 pt-3.5 divide-y divide-slate-50/50 text-left">
                        
                        <div className="flex items-center justify-between pb-3">
                            <div>
                                <label className="font-bold text-slate-800 text-xs block">Currency Symbol</label>
                                <p className="text-[10px] text-slate-400 font-medium">Character shown in prices and invoices.</p>
                            </div>
                            <input 
                                value={storeSettings?.currencySymbol || '₹'} 
                                onChange={(e) => handleUpdateSettings({ currencySymbol: e.target.value })} 
                                className="w-14 text-center font-black text-xs bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg p-2 outline-none transition-all" 
                            />
                        </div>

                        <div className="flex items-center justify-between py-3">
                            <div>
                                <label className="font-bold text-slate-800 text-xs block">Sound Effects</label>
                                <p className="text-[10px] text-slate-400 font-medium">Audio feedback on checkout, barcodes, and actions.</p>
                            </div>
                            <button 
                                onClick={() => handleUpdateSettings({ soundEnabled: !storeSettings?.soundEnabled })} 
                                className={`w-10 h-5 rounded-full transition-all duration-300 relative shrink-0 border-0 cursor-pointer ${storeSettings?.soundEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                            >
                                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow ${storeSettings?.soundEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </button>
                        </div>

                        <div className="flex items-center justify-between py-3">
                            <div>
                                <label className="font-bold text-slate-800 text-xs block">Push Notifications</label>
                                <p className="text-[10px] text-slate-400 font-medium">Receive native stock warnings and item reminders.</p>
                            </div>
                            <button 
                                onClick={handleToggleNotifications} 
                                className={`w-10 h-5 rounded-full transition-all duration-300 relative shrink-0 border-0 cursor-pointer ${storeSettings?.notificationsEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                            >
                                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow ${storeSettings?.notificationsEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </button>
                        </div>

                        <div className="flex items-center justify-between pt-3">
                            <div>
                                <label className="font-bold text-slate-800 text-xs block">Recycle Bin Retention</label>
                                <p className="text-[10px] text-slate-400 font-medium">Automatic purge timeline for deleted database entries.</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <input 
                                    type="number"
                                    value={recycleRetention} 
                                    onChange={(e) => handleSaveRetention(parseInt(e.target.value) || 30)} 
                                    className="w-14 text-center font-black text-xs bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg p-2 outline-none" 
                                />
                                <span className="text-[10px] text-slate-400 font-bold uppercase">Days</span>
                            </div>
                        </div>

                    </div>
                </SettingRow>

                {/* 3.2 Stock & Expiry Notice Rules */}
                <SettingRow
                    icon={Bell}
                    iconBg="bg-violet-50"
                    iconColor="text-violet-600"
                    title="Stock & Expiry Notice Rules"
                    description="Configure alerts for low-stock warnings and expiring batches"
                    isExpanded={expandedRow === 'alert_rules'}
                    onClick={() => toggleRow('alert_rules')}
                >
                    <div className="space-y-3.5 pt-3.5 divide-y divide-slate-50/50 text-left">
                        <div className="flex items-center justify-between pb-3">
                            <div>
                                <label className="font-bold text-slate-800 text-xs block">Low Stock Default Limit (Global)</label>
                                <p className="text-[10px] text-slate-400 font-medium">Generic threshold fallback across all inventory units.</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <input 
                                    type="number"
                                    value={storeSettings?.lowStockDefault ?? 10} 
                                    onChange={(e) => handleUpdateSettings({ lowStockDefault: parseInt(e.target.value) || 0 })} 
                                    className="w-14 text-center font-black text-xs bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg p-2 outline-none" 
                                />
                                <span className="text-[10px] text-slate-400 font-bold uppercase">Units</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-3">
                            <div>
                                <label className="font-bold text-slate-800 text-xs block">Expiry Notice Lead Period</label>
                                <p className="text-[10px] text-slate-400 font-medium">Days ahead to trigger notifications for batch expiry.</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <input 
                                    type="number"
                                    value={storeSettings?.expiryAlertDays ?? 7} 
                                    onChange={(e) => handleUpdateSettings({ expiryAlertDays: parseInt(e.target.value) || 0 })} 
                                    className="w-14 text-center font-black text-xs bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg p-2 outline-none" 
                                />
                                <span className="text-[10px] text-slate-400 font-bold uppercase">Days</span>
                            </div>
                        </div>
                    </div>
                </SettingRow>

                {/* 3.3 Hardware Configurations */}
                <SettingRow
                    icon={Printer}
                    iconBg="bg-slate-100"
                    iconColor="text-slate-600"
                    title="Hardware & Printing Accessories"
                    description="Setup barcode scanners and thermal receipt print actions"
                    isExpanded={expandedRow === 'hardware_printer'}
                    onClick={() => toggleRow('hardware_printer')}
                >
                    <div className="space-y-4 pt-3.5 text-left">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                            <div>
                                <label className="font-bold text-slate-800 text-xs block">Direct thermal printing</label>
                                <p className="text-[10px] text-slate-400 font-medium">Skip browser popup dialogues and prints instantly.</p>
                            </div>
                            <button 
                                onClick={handleToggleDirectPrint} 
                                className={`w-10 h-5 rounded-full transition-all duration-300 relative shrink-0 border-0 cursor-pointer ${storeSettings?.directPrintEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                            >
                                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow ${storeSettings?.directPrintEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </button>
                        </div>

                        <div className="space-y-2.5">
                            <div>
                                <label className="font-bold text-slate-800 text-xs block">Barcode Scanner Preferences</label>
                                <p className="text-[10px] text-slate-400 font-medium">Prioritize specific hardware methods during invoice scanning.</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    { value: 'phone', label: 'Cam Scan', icon: Smartphone },
                                    { value: 'machine', label: 'Laser Gun', icon: Scan },
                                    { value: 'both', label: 'Hybrid/All', icon: RefreshCw }
                                ] as const).map(pref => (
                                    <button
                                        key={pref.value}
                                        onClick={() => handleScannerPreferenceChange(pref.value)}
                                        className={`flex flex-col items-center justify-center p-2 rounded-xl border text-[10px] font-bold gap-1 transition-all border-0 cursor-pointer ${storeSettings?.scannerPreference === pref.value ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/50' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        <pref.icon size={14} />
                                        <span>{pref.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </SettingRow>

                {/* 3.4 Custom Receipt Builder */}
                <SettingRow
                    icon={FileText}
                    iconBg="bg-purple-50"
                    iconColor="text-purple-600"
                    title="Invoice & Receipt Customizer"
                    description="Configure tagline slogans, footer guidelines, and tax rate presets"
                    isExpanded={expandedRow === 'receipt_builder'}
                    onClick={() => toggleRow('receipt_builder')}
                >
                    <div className="space-y-3.5 pt-3.5 text-left">
                        <div>
                            <label className="font-bold text-slate-800 text-xs block mb-1">Receipt Header (Tagline Slogan)</label>
                            <input 
                                type="text"
                                placeholder="e.g. Thanks for shopping with us!"
                                defaultValue={storeSettings?.receiptHeader || ''}
                                onBlur={(e) => handleUpdateSettings({ receiptHeader: e.target.value })}
                                className="w-full font-semibold text-xs bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl p-2.5 outline-none transition-all" 
                            />
                        </div>
                        
                        <div>
                            <label className="font-bold text-slate-800 text-xs block mb-1">Receipt Footer (Terms & Policies)</label>
                            <input 
                                type="text"
                                placeholder="e.g. Items returnable within 7 days with original cash memo"
                                defaultValue={storeSettings?.receiptFooter || ''}
                                onBlur={(e) => handleUpdateSettings({ receiptFooter: e.target.value })}
                                className="w-full font-semibold text-xs bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl p-2.5 outline-none transition-all" 
                            />
                        </div>

                        <div className="flex items-center justify-between py-1 border-t border-slate-50 pt-2.5">
                            <div>
                                <label className="font-bold text-slate-800 text-xs block">Invoice Default Tax Rate</label>
                                <p className="text-[10px] text-slate-400 font-medium">GST percentage applied automatically on billing checkouts.</p>
                            </div>
                            <select 
                                value={storeSettings?.taxRateDefault ?? 0}
                                onChange={(e) => handleUpdateSettings({ taxRateDefault: parseFloat(e.target.value) || 0 })}
                                className="font-extrabold text-xs bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl p-2 outline-none cursor-pointer text-slate-700"
                            >
                                <option value={0}>0% GST Tax Free</option>
                                <option value={5}>5% Standard GST</option>
                                <option value={12}>12% Apparel & Goods</option>
                                <option value={18}>18% Luxury & Services</option>
                            </select>
                        </div>

                        <div className="flex items-center justify-between py-1 border-t border-slate-50 pt-2.5">
                            <div>
                                <label className="font-bold text-slate-800 text-xs block">Embed Store Logo on Receipts</label>
                                <p className="text-[10px] text-slate-400 font-medium">Add store logo header to exported PDF files.</p>
                            </div>
                            <button 
                                onClick={() => handleUpdateSettings({ showLogoOnReceipt: !storeSettings?.showLogoOnReceipt })} 
                                className={`w-10 h-5 rounded-full transition-all duration-300 relative shrink-0 border-0 cursor-pointer ${storeSettings?.showLogoOnReceipt ? 'bg-indigo-600' : 'bg-slate-200'}`}
                            >
                                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow ${storeSettings?.showLogoOnReceipt ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </button>
                        </div>
                    </div>
                </SettingRow>

                {/* 3.5 Individual Product stock limits */}
                <SettingRow
                    icon={Box}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    title="Custom Product stock warning limits"
                    description="Configure alerts for specific products"
                    isExpanded={expandedRow === 'product_stock_limits'}
                    onClick={() => toggleRow('product_stock_limits')}
                >
                    <div className="space-y-3 pt-3.5">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                            <input 
                                placeholder="Search products..." 
                                className="pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all w-full font-semibold" 
                                value={settingsSearch} 
                                onChange={(e) => setSettingsSearch(e.target.value)} 
                            />
                        </div>
                        <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden text-left">
                            <div className="px-4 py-2 bg-slate-100/50 border-b border-slate-150/40 flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                <span>Product</span>
                                <span>Threshold</span>
                            </div>
                            <div className="max-h-48 overflow-y-auto bg-white divide-y divide-slate-50">
                                 {products.filter(p => p.name.toLowerCase().includes(settingsSearch.toLowerCase())).map(p => (
                                     <ProductSettingRow key={p.id} product={p} onUpdate={handleInlineProductUpdate} />
                                 ))}
                                 {products.filter(p => p.name.toLowerCase().includes(settingsSearch.toLowerCase())).length === 0 && (
                                     <div className="p-4 text-center text-slate-400 text-xs font-semibold">No matches</div>
                                 )}
                            </div>
                        </div>
                    </div>
                </SettingRow>

            </div>
        </div>

        {/* ==========================================
            GROUP 4: CLOUD STATUS & UTILITIES (DANGER ZONE)
            ========================================== */}
        <div className="space-y-2">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5 px-1">Utilities & Maintenance</div>
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
                
                {/* 4.1 Database backup and recovery */}
                <SettingRow
                    icon={HardDrive}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    title="Database Backup & Sync"
                    description="Export backup files, upload states, and synchronize local cache with cloud"
                    isExpanded={expandedRow === 'backup_recovery'}
                    onClick={() => toggleRow('backup_recovery')}
                    rightElement={
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100/50">
                            ONLINE
                        </span>
                    }
                >
                    <div className="space-y-3 pt-3.5 text-left">
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">
                            Backup files represent your complete offline database snapshot. You can safely export them to save your current inventory, customer balances, and shift records.
                        </p>
                        {lastBackup && (
                            <p className="text-[10px] text-slate-400 font-bold uppercase">
                                Last Sync: {lastBackup}
                            </p>
                        )}
                        <div className="grid grid-cols-2 gap-3 pt-1">
                            <button 
                                onClick={handleExport} 
                                className="flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-colors cursor-pointer text-xs"
                            >
                                <Download size={14} className="text-blue-500"/>
                                <span>Export Backup</span>
                            </button>
                            <button 
                                onClick={handleImportClick} 
                                className="flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-colors cursor-pointer text-xs"
                            >
                                <Upload size={14} className="text-purple-500"/>
                                <span>Import Backup</span>
                            </button>
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
                    </div>
                </SettingRow>

                {/* 4.2 System Recycle Bin */}
                <SettingRow
                    icon={Trash2}
                    iconBg="bg-rose-50"
                    iconColor="text-rose-600"
                    title="System Recycle Bin"
                    description="Access, restore, or permanently purge deleted logs and items"
                    onClick={() => {
                        setShowRecycleBin(true);
                        window.history.pushState({ tab: Tab.PROFILE, depth: 1 }, '');
                    }}
                    rightElement={
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100/50">
                            {deletedItems.length} ITEMS
                        </span>
                    }
                />

                {/* 4.3 Factory Reset */}
                <SettingRow
                    icon={AlertTriangle}
                    iconBg="bg-rose-50"
                    iconColor="text-rose-600"
                    title="Factory Reset System"
                    description="Permanently erase database cache and disconnect from cloud sync"
                    isExpanded={expandedRow === 'danger_zone'}
                    onClick={() => toggleRow('danger_zone')}
                >
                    <div className="space-y-3 pt-3.5 text-left">
                        <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-100 text-rose-950 text-xs font-semibold leading-relaxed">
                            ⚠️ **WARNING**: Factory resetting clears all local cache, sales histories, register configurations, and log records completely. This cannot be undone. Ensure backup exports are completed beforehand.
                        </div>
                        <button 
                            onClick={() => { setShowResetConfirm(true); window.history.pushState({ tab: Tab.PROFILE, depth: 1 }, ''); }}
                            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all cursor-pointer text-xs shadow-md shadow-red-950/10 border-0 flex items-center justify-center gap-2"
                        >
                            <AlertTriangle size={15} />
                            <span>Purge Cache & Disconnect</span>
                        </button>
                    </div>
                </SettingRow>

            </div>
        </div>

        {/* --- MODAL PLUGINS --- */}
        <ProfileModals
            showRecycleBin={showRecycleBin}
            setShowRecycleBin={setShowRecycleBin}
            recycleRetention={recycleRetention}
            deletedItems={deletedItems}
            groupedDeletedItems={groupedDeletedItems}
            handleEmptyBin={handleEmptyBin}
            handleRestoreItem={handleRestoreItem}
            handlePermanentDelete={handlePermanentDelete}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}

            showResetConfirm={showResetConfirm}
            setShowResetConfirm={setShowResetConfirm}
            handleReset={handleReset}

            showShiftLogModal={showShiftLogModal}
            setShowShiftLogModal={setShowShiftLogModal}
            openingCash={openingCash}
            setOpeningCash={setOpeningCash}
            closingCash={closingCash}
            setClosingCash={setClosingCash}
            shiftNotes={shiftNotes}
            setShiftNotes={setShiftNotes}
            totalRevenue={totalRevenue}
            handleSaveShiftLog={handleSaveShiftLog}

            showStaffModal={showStaffModal}
            setShowStaffModal={setShowStaffModal}
            editingStaffId={editingStaffId}
            staffForm={staffForm}
            setStaffForm={setStaffForm}
            handleSaveStaff={handleSaveStaff}

            confirmDialog={confirmDialog}
            setConfirmDialog={setConfirmDialog}
        />

        <div className="text-center text-[10px] text-slate-400 font-extrabold uppercase tracking-widest pt-8 pb-4">Noor POS v1.6.3</div>
    </div>
  );
};
