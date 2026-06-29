import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product, Tag, StoreSettings, Sale, Tab } from '../types';
import { StoreService } from '../services/storeService';
import { GeminiService } from '../services/geminiService';
import { Card, Button, Input, Modal, Badge } from '../components/UI';
import { Plus, Search, AlertTriangle, Scan, Tag as TagIcon, Box, Trash2, Pencil, X, ArrowLeft, Settings, Bell, Hash, MapPin, Factory, Clock, ChevronDown, Sparkles, Layers, DollarSign, Percent, FileText, Scale, ChevronUp, Loader2, Save, Eye, Camera, Check, Smartphone, FileType, ListPlus, Edit2, Info, Terminal, Filter, Building, HeartPulse, Thermometer, Scissors, Shirt, Truck, Weight, Hammer, Cpu, ShieldCheck, Crown } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

enum SubTab {
  PRODUCTS = 'PRODUCTS',
  TAGS = 'TAGS'
}

enum ProductFilter {
  ALL = 'ALL',
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  EXPIRING_SOON = 'EXPIRING_SOON'
}

const UNITS = [
  'pcs', 'kg', 'g', 'l', 'ml', 'pack', 'box', 'dozen', 'm', 'cm', 
  'mg', 'tablet', 'strip', 'capsule', 'syrup', 'vial', 'ampoule', 'kit'
];

const TAG_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', 
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', 
  '#f43f5e', '#64748b', '#000000', '#9a3412', '#1e40af', 
  '#3730a3', '#5b21b6', '#86198f', '#9f1239', '#115e59', 
  '#166534', '#3f6212'
];


interface WarehouseProps {
  initialAction?: string;
  onClearAction?: () => void;
}

export const Warehouse: React.FC<WarehouseProps> = ({ initialAction, onClearAction }) => {
  const [activeTab, setActiveTab] = useState<SubTab>(SubTab.PRODUCTS);
  const [viewMode, setViewMode] = useState<'WAREHOUSE' | 'REVIEW'>('WAREHOUSE');
  const [products, setProducts] = useState<Product[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({
      storeName: '',
      storeAddress: '',
      storePhone: '',
      notificationsEnabled: true,
      expiryAlertDays: 7, 
      lowStockDefault: 10, 
      soundEnabled: true, 
      currencySymbol: '₹',
      recycleBinRetentionDays: 30,
      directPrintEnabled: false,
      scannerPreference: 'both'
  });
  const [loading, setLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [pendingBulkItems, setPendingBulkItems] = useState<Partial<Product>[]>([]);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ 
    name: '', sku: '', stock: 0, unit: 'pcs', capacity: '', 
    buyPrice: 0, sellPrice: 0, wholesalePrice: 0, 
    lowStockThreshold: 10, location: '', taxRate: 0,
    expiryDate: '', manufacturingDate: '',
    size: '', color: '', brand: '', warranty: '', weight: '', supplier: ''
  });
  const [batchConfig, setBatchConfig] = useState({ packs: '', perPack: '' });
  const [showTagModal, setShowTagModal] = useState(false);
  const [isEditingTag, setIsEditingTag] = useState(false);
  const [newTag, setNewTag] = useState<Partial<Tag>>({ name: '', color: '#3b82f6' });
  const [isSavingTag, setIsSavingTag] = useState(false);
  const [showTagWarning, setShowTagWarning] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'product' | 'tag' | 'bulk_products', name: string } | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [isScanningToAdd, setIsScanningToAdd] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [shakeTrigger, setShakeTrigger] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ProductFilter>(ProductFilter.ALL);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [aiFilters, setAiFilters] = useState<{
      size?: string;
      color?: string;
      maxPrice?: number;
      minPrice?: number;
      expiryBefore?: string;
      category?: string;
      maxStock?: number;
      minStock?: number;
  }>({});
  const [showMoreFields, setShowMoreFields] = useState(false);
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [touchEnd, setTouchEnd] = useState<{x: number, y: number} | null>(null);
  const minSwipeDistance = 50;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isParsingInvoice, setIsParsingInvoice] = useState(false);
  const [parsedProducts, setParsedProducts] = useState<Partial<Product>[]>([]);
  const [invoiceImage, setInvoiceImage] = useState<string | null>(null);
  const [showSourceOptions, setShowSourceOptions] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  // Editor Refs
  const editNameRef = useRef<HTMLInputElement>(null);
  const editSkuRef = useRef<HTMLInputElement>(null);
  const editCategoryRef = useRef<HTMLSelectElement>(null);
  const editSellRef = useRef<HTMLInputElement>(null);
  const editStockRef = useRef<HTMLInputElement>(null);
  const editSizeRef = useRef<HTMLInputElement>(null);
  const editColorRef = useRef<HTMLInputElement>(null);
  const editExpiryRef = useRef<HTMLInputElement>(null);
  const editBuyRef = useRef<HTMLInputElement>(null);
  const editWholesaleRef = useRef<HTMLInputElement>(null);
  const editTaxRef = useRef<HTMLInputElement>(null);
  const editLocationRef = useRef<HTMLInputElement>(null);
  const editUnitSizeRef = useRef<HTMLInputElement>(null);
  const editLowStockRef = useRef<HTMLInputElement>(null);
  const editMfgRef = useRef<HTMLInputElement>(null);

  // --- Browser/Gesture Back Navigation Handling ---
  useEffect(() => {
      const handleNavigationPop = (e: any) => {
          // Priority-based closing of Warehouse sub-views
          if (showCamera) {
              setShowCamera(false);
              return;
          }
          if (showScanner) {
              setShowScanner(false);
              return;
          }
          if (showTagModal) {
              setShowTagModal(false);
              setIsSavingTag(false);
              setIsEditingTag(false);
              setNewTag({ name: '', color: '#3b82f6' });
              return;
          }
          if (showSourceOptions) {
              setShowSourceOptions(false);
              return;
          }
          if (itemToDelete) {
              setItemToDelete(null);
              return;
          }
          if (isEditorOpen) {
              setIsEditorOpen(false);
              return;
          }
          if (viewMode === 'REVIEW') {
              setViewMode('WAREHOUSE');
              return;
          }
      };

      window.addEventListener('app-navigation-pop' as any, handleNavigationPop);
      return () => window.removeEventListener('app-navigation-pop' as any, handleNavigationPop);
  }, [isEditorOpen, showTagModal, showScanner, viewMode, itemToDelete, showSourceOptions, showCamera]);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (initialAction === 'add' || initialAction === 'scan_add') {
        handleOpenAdd();
        if (onClearAction) onClearAction();
    }
  }, [initialAction]);

  const runAiSearch = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsAiParsing(true);
    setAiNotice("Gemini is reading query...");
    try {
      const today = new Date().toISOString().split('T')[0];
      const parsed = await GeminiService.parseQuery(queryText, today);
      
      if (parsed) {
        setAiFilters({
          size: parsed.size || undefined,
          color: parsed.color || undefined,
          maxPrice: parsed.maxPrice || undefined,
          minPrice: parsed.minPrice || undefined,
          expiryBefore: parsed.expiryBefore || undefined,
          category: parsed.category || undefined,
          maxStock: parsed.maxStock || undefined,
          minStock: parsed.minStock || undefined,
        });

        if (parsed.activeFilter) {
          setActiveFilter(parsed.activeFilter as ProductFilter);
        }

        const applied = [];
        if (parsed.color) applied.push(`Color: ${parsed.color}`);
        if (parsed.size) applied.push(`Size: ${parsed.size}`);
        if (parsed.maxPrice) applied.push(`Price < ₹${parsed.maxPrice}`);
        if (parsed.expiryBefore) applied.push(`Expiry < ${parsed.expiryBefore}`);
        if (parsed.category) applied.push(`Category: ${parsed.category}`);
        if (parsed.maxStock) applied.push(`Stock < ${parsed.maxStock}`);
        
        if (applied.length > 0) {
          setAiNotice(`AI applied filters: ${applied.join(', ')}`);
        } else {
          setAiNotice("AI interpreted search term");
        }
      }
    } catch (e) {
      console.error(e);
      setAiNotice("AI interpretation failed, using basic search");
    } finally {
      setIsAiParsing(false);
    }
  };

  useEffect(() => {
    if (!searchTerm.trim()) {
      setAiFilters({});
      setAiNotice(null);
      return;
    }

    const isNaturalQuery = searchTerm.includes(' ') || 
                           searchTerm.includes('<') || 
                           searchTerm.includes('>') || 
                           searchTerm.includes('under') || 
                           searchTerm.includes('over') || 
                           searchTerm.includes('low') || 
                           searchTerm.includes('out') || 
                           searchTerm.includes('expiring') || 
                           searchTerm.includes('expire');
    
    if (!isNaturalQuery) {
      setAiFilters({});
      setAiNotice(null);
      return;
    }

    const handler = setTimeout(async () => {
      await runAiSearch(searchTerm);
    }, 1200);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  const loadData = async () => {
    setLoading(true);
    const [invData, tagData, settingsData] = await Promise.all([ 
        StoreService.getInventory(), 
        StoreService.getTags(), 
        StoreService.getSettings()
    ]);
    setProducts(invData);
    setTags(tagData);
    setSettings(settingsData);
    setLoading(false);
  };
  
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    if (showScanner) {
        const timeoutId = setTimeout(() => {
            if (!document.getElementById("reader")) return;
            html5QrCode = new Html5Qrcode("reader");
            const config = { fps: 15, qrbox: { width: 300, height: 200 } };
            html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => {
                    if (settings.soundEnabled) { new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => {}); }
                    if (isScanningToAdd || isEditorOpen) {
                        setNewProduct(prev => ({ ...prev, sku: decodedText }));
                        setShowScanner(false);
                        // No need for window.history.back here as it was a modal scan
                        if(isScanningToAdd) {
                           window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, '');
                           setIsEditorOpen(true);
                        }
                        setIsScanningToAdd(false);
                    } else { 
                        setSearchTerm(decodedText); 
                        setActiveTab(SubTab.PRODUCTS); 
                        setShowScanner(false);
                        // Manual back is needed here to clear the pushed state for the scanner modal
                        window.history.back();
                    }
                }, () => {}).catch(() => setShowScanner(false));
        }, 300);
        return () => { clearTimeout(timeoutId); if (html5QrCode && html5QrCode.isScanning) { html5QrCode.stop().catch(console.error); } };
    }
  }, [showScanner, isEditorOpen, settings.soundEnabled, isScanningToAdd]);
  
  useEffect(() => {
      let stream: MediaStream | null = null;
      if (showCamera) {
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(s => { stream = s; if (videoRef.current) videoRef.current.srcObject = stream; })
            .catch(() => setShowCamera(false));
      }
      return () => { if (stream) stream.getTracks().forEach(track => track.stop()); };
  }, [showCamera]);

  const processImageFile = async (file: File) => { 
    setIsParsingInvoice(true); 
    try { 
      const products = await GeminiService.parseInvoice(file); 
      setParsedProducts(products); 
      window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, '');
      setViewMode('REVIEW'); 
    } catch (err) { 
      alert("Failed to process image."); 
    } finally { 
      setIsParsingInvoice(false); 
    } 
  };

  const capturePhoto = () => {
      if (videoRef.current) {
          const video = videoRef.current;
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              setInvoiceImage(dataUrl); 
              setShowCamera(false);
              // Pop the camera state
              window.history.back();
              fetch(dataUrl).then(res => res.blob()).then(blob => { processImageFile(new File([blob], "capture.jpg", { type: "image/jpeg" })); });
          }
      }
  };


  const handleBatchChange = (field: 'packs' | 'perPack', value: string) => { const newConfig = { ...batchConfig, [field]: value }; setBatchConfig(newConfig); const packs = parseFloat(newConfig.packs); const perPack = parseFloat(newConfig.perPack); if (!isNaN(packs) && !isNaN(perPack) && packs >= 0 && perPack >= 0) { setNewProduct(prev => ({ ...prev, stock: Math.floor(packs * perPack) })); } };
  const getTag = (id?: string) => tags.find(t => t.id === id);
  const getDaysUntilExpiry = (dateStr?: string) => { if (!dateStr) return Infinity; const today = new Date(); today.setHours(0,0,0,0); const exp = new Date(dateStr); return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)); };
  const isAboutToExpire = (dateStr?: string) => { if (!dateStr) return false; const diffDays = getDaysUntilExpiry(dateStr); return diffDays >= 0 && diffDays <= (settings.expiryAlertDays || 7); };
  const formatDate = (dateStr?: string) => dateStr ? new Date(dateStr).toLocaleDateString('en-GB') : '-';
  
  const validateProduct = () => {
    const newErrors = new Set<string>();
    if (!newProduct.name?.trim()) newErrors.add('name');
    if (!newProduct.sellPrice || newProduct.sellPrice <= 0) newErrors.add('sellPrice');
    setValidationErrors(newErrors);
    if (newErrors.size > 0) {
        setShakeTrigger(true);
        setTimeout(() => setShakeTrigger(false), 500);
        return false;
    }
    return true;
  };

  const handleAddToBatch = () => {
      if (!validateProduct()) return;
      setPendingBulkItems(prev => [...prev, newProduct]);
      resetForm();
      editNameRef.current?.focus();
  };

  const handleEditFromQueue = (index: number) => {
      const itemToEdit = pendingBulkItems[index];
      setPendingBulkItems(prev => prev.filter((_, i) => i !== index));
      setNewProduct(itemToEdit);
      setShowMoreFields(true);
      setTimeout(() => editNameRef.current?.focus(), 100);
  };

  const handleSaveProduct = async () => { 
      if (pendingBulkItems.length > 0) {
          const itemsToSave = [...pendingBulkItems];
          if (newProduct.name?.trim() || (newProduct.sellPrice && newProduct.sellPrice > 0)) {
              if (!validateProduct()) return;
              itemsToSave.push(newProduct);
          }
          await StoreService.batchAddProducts(itemsToSave);
      } else {
          if (!validateProduct()) return;
          if (isEditing && newProduct.id) await StoreService.updateProduct(newProduct.id, newProduct);
          else await StoreService.addProduct(newProduct as Product);
      }
      loadData(); 
      setIsEditorOpen(false); 
      setIsEditing(false); 
      resetForm();
      // Sync browser history
      window.history.back();
  };

  const handleSaveTag = async () => { 
      if (!newTag.name || isSavingTag) return; 

      const trimmedName = newTag.name.trim();
      const lowerName = trimmedName.toLowerCase();
      const isDuplicate = tags.some(t => t.name.toLowerCase() === lowerName && t.id !== newTag.id);

      if (isDuplicate) {
          setShowTagWarning(trimmedName);
          return;
      }

      setIsSavingTag(true);
      try {
          if (isEditingTag && newTag.id) {
             await StoreService.updateTag(newTag.id, { ...newTag, name: trimmedName });
          } else {
             const createdTag = await StoreService.addTag({ ...newTag, name: trimmedName } as Tag); 
             if (isEditorOpen) setNewProduct(prev => ({ ...prev, tagId: createdTag.id })); 
          }
          loadData(); 
          window.history.back();
      } finally { setIsSavingTag(false); }
  };
  
  const resetForm = () => { 
      setNewProduct({ name: '', sku: '', stock: 0, unit: 'pcs', capacity: '', buyPrice: 0, sellPrice: 0, wholesalePrice: 0, lowStockThreshold: settings.lowStockDefault, location: '', taxRate: 0, expiryDate: '', manufacturingDate: '', size: '', color: '', brand: '', warranty: '', weight: '', supplier: '' }); 
      setBatchConfig({ packs: '', perPack: '' }); setShowMoreFields(false); setValidationErrors(new Set());
  };

  const toggleGroup = (groupId: string) => { const newExpanded = new Set(expandedGroups); if (newExpanded.has(groupId)) newExpanded.delete(groupId); else newExpanded.add(groupId); setExpandedGroups(newExpanded); };
  
  const handleNameBlur = () => { if (!newProduct.name || isEditing) return; const existing = products.find(p => p.name.toLowerCase() === newProduct.name?.toLowerCase()); if (existing) { setNewProduct(prev => ({ ...prev, tagId: prev.tagId || existing.tagId, location: prev.location || existing.location, unit: existing.unit, capacity: existing.capacity, lowStockThreshold: existing.lowStockThreshold, buyPrice: prev.buyPrice || existing.buyPrice, wholesalePrice: prev.wholesalePrice || existing.wholesalePrice, sellPrice: prev.sellPrice || existing.sellPrice, taxRate: existing.taxRate, })); } };

  const handleEditProduct = (p: Product) => { 
      setNewProduct({ ...p }); 
      setBatchConfig({ packs: '', perPack: '' }); 
      setIsEditing(true); 
      window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, '');
      setIsEditorOpen(true); 
      setShowMoreFields(false); 
  };
  
  const handleCloneProduct = (p: Product) => { 
      setNewProduct({ ...p, id: undefined, stock: 0, expiryDate: '', manufacturingDate: '', sku: p.sku }); 
      setBatchConfig({ packs: '', perPack: '' }); 
      setIsEditing(false); 
      window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, '');
      setIsEditorOpen(true); 
      setShowMoreFields(false); 
  };

  const handleOpenAdd = () => { 
      resetForm(); 
      setPendingBulkItems([]); 
      setIsScanningToAdd(true); 
      window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, '');
      setShowScanner(true); 
  };
  
  const handleManualEntry = () => { 
      // Manual entry from scanner. We already pushed a state for scanner, so we keep it for the editor
      setShowScanner(false); 
      setIsScanningToAdd(false); 
      setIsEditorOpen(true); 
  };

  const confirmDelete = async () => { 
      if (!itemToDelete) return; 
      if (itemToDelete.type === 'product') await StoreService.deleteProduct(itemToDelete.id);
      else if (itemToDelete.type === 'tag') await StoreService.deleteTag(itemToDelete.id);
      else if (itemToDelete.type === 'bulk_products') setPendingBulkItems(prev => prev.filter((_, idx) => idx !== parseInt(itemToDelete.id)));
      loadData();
      window.history.back();
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent, nextRef: React.RefObject<HTMLElement> | null, action?: () => void) => { 
      if (e.key === 'Enter') { e.preventDefault(); if (nextRef?.current) nextRef.current.focus(); else if (action) action(); } 
  };

  const handleExpiryEnter = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          if (!showMoreFields) {
              setShowMoreFields(true);
              setTimeout(() => editBuyRef.current?.focus(), 150);
          } else {
              editBuyRef.current?.focus();
          }
      }
  };

  const handleAnalyzeClick = () => { 
      window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, '');
      setShowSourceOptions(true); 
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => { 
      const file = e.target.files?.[0]; 
      if (!file) return; 
      setInvoiceImage(URL.createObjectURL(file)); 
      // Analysis Modal closes, but Review starts. App state depth remains 1.
      setShowSourceOptions(false);
      await processImageFile(file); 
  };
  
  const handleCloseReview = () => { 
      setViewMode('WAREHOUSE'); 
      if (invoiceImage) { URL.revokeObjectURL(invoiceImage); setInvoiceImage(null); } 
      setParsedProducts([]); 
      window.history.back();
  };

  const handleImportParsedProducts = async () => { 
      await StoreService.batchAddProducts(parsedProducts); 
      setViewMode('WAREHOUSE'); 
      loadData(); 
      window.history.back();
  };
  
  const updateParsedProduct = (index: number, field: keyof Product, value: any) => { const updated = [...parsedProducts]; updated[index] = { ...updated[index], [field]: value }; setParsedProducts(updated); };

  const removeParsedProduct = (index: number) => { const updated = parsedProducts.filter((_, i) => i !== index); setParsedProducts(updated); };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        if (activeFilter === ProductFilter.LOW_STOCK) {
            if (!(p.stock > 0 && p.stock < p.lowStockThreshold)) return false;
        }
        if (activeFilter === ProductFilter.OUT_OF_STOCK) {
            if (p.stock !== 0) return false;
        }
        if (activeFilter === ProductFilter.EXPIRING_SOON) {
            if (!isAboutToExpire(p.expiryDate)) return false;
        }

        // Apply AI filters
        if (aiFilters.size && p.size && p.size.toLowerCase() !== aiFilters.size.toLowerCase()) return false;
        if (aiFilters.color && p.color && p.color.toLowerCase() !== aiFilters.color.toLowerCase()) return false;
        if (aiFilters.category && p.category && !p.category.toLowerCase().includes(aiFilters.category.toLowerCase())) return false;
        if (aiFilters.maxPrice && p.sellPrice > aiFilters.maxPrice) return false;
        if (aiFilters.minPrice && p.sellPrice < aiFilters.minPrice) return false;
        if (aiFilters.maxStock && p.stock > aiFilters.maxStock) return false;
        if (aiFilters.minStock && p.stock < aiFilters.minStock) return false;
        if (aiFilters.expiryBefore && p.expiryDate) {
            if (p.expiryDate > aiFilters.expiryBefore) return false;
        }

        return true;
    });
  }, [products, activeFilter, searchTerm, aiFilters]);

  const groupProductList = (list: Product[]) => {
      const groups: { [key: string]: Product[] } = {}; const order: string[] = [];
      list.forEach(p => { const key = `${p.name}|${p.capacity || ''}|${p.unit}`; if (!groups[key]) { groups[key] = []; order.push(key); } groups[key].push(p); });
      return order.map(key => ({ key, items: groups[key] }));
  };

  const groupedProducts = useMemo(() => groupProductList(filteredProducts), [filteredProducts]);

  const renderProductGroup = (groupKey: string, items: Product[]) => {
      const p = items[0]; const tag = getTag(p.tagId); const totalStock = items.reduce((acc, item) => acc + item.stock, 0); const borderColor = tag?.color || '#cbd5e1'; const isExpanded = expandedGroups.has(groupKey); const isLow = totalStock < p.lowStockThreshold; const anyExpiring = items.some(i => isAboutToExpire(i.expiryDate));
      const validExpiries = items.map(i => i.expiryDate).filter((d): d is string => !!d);
      let earliestExpiry: string | null = validExpiries.length > 0 ? validExpiries.sort()[0] : null;

      return (
        <Card key={groupKey} className="flex flex-col !p-0 overflow-hidden hover:shadow-xl transition-all border-2 bg-white" style={{ borderColor }}>
            <div className="p-3 flex flex-col gap-1">
                <div className="flex justify-between items-start gap-2">
                    <h4 className="font-bold text-gray-900 text-2xl leading-tight line-clamp-2">{p.name}</h4>
                    <div className="flex gap-1 shrink-0">
                         <button onClick={() => handleEditProduct(p)} className="p-2 text-gray-500 hover:text-blue-600 bg-gray-50 rounded-lg"><Pencil size={18} /></button>
                         <button onClick={() => { setItemToDelete({ id: p.id, type: 'product', name: p.name }); window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, ''); }} className="p-2 text-gray-500 hover:text-red-600 bg-gray-50 rounded-lg"><Trash2 size={18} /></button>
                    </div>
                </div>
                <div className="text-xs font-mono font-bold text-gray-400">SKU: {p.sku || 'N/A'}</div>
                <div className="grid grid-cols-3 gap-2 border-b border-dashed border-gray-200 pb-2 mb-1 mt-2">
                    <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-gray-500">Buy</span><span className="font-bold text-gray-700">₹{p.buyPrice}</span></div>
                    <div className="flex flex-col border-l border-gray-200 pl-2"><span className="text-[10px] uppercase font-bold text-gray-500">Wholesale</span><span className="font-bold text-blue-600">₹{p.wholesalePrice || '-'}</span></div>
                    <div className="flex flex-col border-l border-gray-200 pl-2"><span className="text-[10px] uppercase font-bold text-gray-500">Sell</span><span className="font-extrabold text-2xl text-green-700">₹{p.sellPrice}</span></div>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs font-bold">
                    <span className={`flex items-center gap-1 ${isLow ? 'text-red-600' : 'text-gray-500'}`}><Box size={14}/> Qty: {totalStock}</span>
                    <span className={`flex items-center gap-1 ${earliestExpiry && isAboutToExpire(earliestExpiry) ? 'text-amber-600' : 'text-gray-500'}`}><Clock size={14}/> {earliestExpiry ? formatDate(earliestExpiry) : 'No Exp'}</span>
                </div>
                <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100">
                    <div className="flex gap-1">
                        {isLow && <div className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded">LOW</div>}
                        {anyExpiring && <div className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded">EXP</div>}
                    </div>
                    <div className="flex items-center gap-1 ml-auto">
                         <Button size="sm" variant="neutral" onClick={() => handleCloneProduct(p)} className="!px-2 !py-1 h-8" title="Add Batch"><Plus size={16}/></Button>
                         <button onClick={() => toggleGroup(groupKey)} className="text-gray-400 p-1 bg-gray-50 rounded-md">{isExpanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}</button>
                    </div>
                </div>
            </div>
            {isExpanded && (
                <div className="bg-gray-50 border-t border-gray-200 p-3 space-y-1.5">
                    {/* Table Header */}
                    <div className="grid grid-cols-7 gap-2 px-2 pb-1 text-[10px] font-black text-gray-400 uppercase tracking-wider text-center">
                        <div className="text-left">Added Date</div>
                        <div>Size</div>
                        <div>Color</div>
                        <div>Expiry Date</div>
                        <div>Price (Buy/Sell)</div>
                        <div>Stock</div>
                        <div className="text-right">Actions</div>
                    </div>
                    {items.map(item => (
                        <div key={item.id} className="grid grid-cols-7 gap-2 items-center bg-white border border-gray-200 p-2.5 rounded-lg text-xs font-bold shadow-sm hover:border-indigo-200 transition-all text-center">
                            <div className="text-left truncate text-gray-500 font-medium text-[10px]">{formatDate(item.createdAt)}</div>
                            <div className="truncate text-gray-800">{item.size || '-'}</div>
                            <div className="truncate text-gray-800">
                                {item.color ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-black text-[10px] border border-indigo-100">
                                        {item.color}
                                    </span>
                                ) : (
                                    '-'
                                )}
                            </div>
                            <div className="truncate text-gray-600 font-medium text-[11px]">{item.expiryDate ? formatDate(item.expiryDate) : '-'}</div>
                            <div className="text-center font-bold text-gray-900">
                                <span className="text-[10px] text-gray-400">₹{item.buyPrice}</span>
                                <span className="text-gray-300 mx-1">/</span>
                                <span className="text-green-700">₹{item.sellPrice}</span>
                            </div>
                            <div className="text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-md font-bold text-[11px] ${item.stock === 0 ? 'bg-red-50 text-red-600 border border-red-100' : item.stock < (item.lowStockThreshold || 10) ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-gray-50 text-gray-700'}`}>
                                    {item.stock} {item.unit}
                                </span>
                            </div>
                            <div className="flex justify-end gap-1.5">
                                <button onClick={() => handleEditProduct(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit Batch"><Pencil size={14}/></button>
                                <button onClick={() => { setItemToDelete({ id: item.id, type: 'product', name: `${item.name} (Batch)` }); window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, ''); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete Batch"><Trash2 size={14}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
      );
  };

  const renderEditor = () => {
    // Pill-shaped filling classes
    const inputBaseClass = "w-full rounded-full px-6 py-3.5 text-base bg-white border-2 border-blue-200 text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 h-[54px] transition-all placeholder-gray-400";
    const selectBaseClass = "w-full rounded-full px-6 py-3.5 text-base bg-white border-2 border-blue-200 text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 h-[54px] transition-all cursor-pointer appearance-none";
    const errorClass = "border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-red-500/10";
    const amberBorderClass = "border-amber-200 focus:border-amber-500 focus:ring-amber-500/10";
    const purpleBorderClass = "border-purple-200 focus:border-purple-500 focus:ring-purple-500/10";
    const greenBorderClass = "border-green-200 focus:border-green-500 focus:ring-green-500/10";

    const wType = settings.warehouseType || 'general';

    return (
        <div className={`animate-in slide-in-from-bottom-4 duration-300 pb-24 px-4 md:px-8 max-w-4xl mx-auto pt-6 ${shakeTrigger ? 'shake-element' : ''}`}>
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => { setIsEditorOpen(false); window.history.back(); }} 
                        className="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-all shadow-sm active:scale-95"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="text-xs font-bold text-indigo-500 uppercase tracking-widest">{wType} Warehouse Mode</div>
                        <h2 className="text-3xl font-black text-gray-900 tracking-tight">{isEditing ? 'Edit Product' : 'Add New Product'}</h2>
                    </div>
                </div>
                
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 capitalize">
                    {wType} Requirements
                </span>
            </div>

            {pendingBulkItems.length > 0 && (
                <div className="max-w-4xl mx-auto mb-8">
                    <div className="bg-indigo-50 border border-indigo-200 rounded-3xl overflow-hidden shadow-sm">
                        <div className="px-6 py-3.5 bg-indigo-100/50 border-b border-indigo-200 flex justify-between items-center">
                            <h3 className="font-bold text-indigo-900 flex items-center gap-2"><ListPlus size={18}/> Bulk Queue ({pendingBulkItems.length})</h3>
                            <Button size="sm" variant="danger" onClick={() => setPendingBulkItems([])} className="text-xs h-8 px-3 rounded-full">Clear All</Button>
                        </div>
                        <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
                            {pendingBulkItems.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-2xl border border-indigo-100 shadow-sm">
                                    <div className="min-w-0 flex-1 px-2">
                                        <div className="font-bold text-gray-800 text-sm truncate">{item.name}</div>
                                        <div className="text-[10px] text-gray-500">Stock: {item.stock} • Price: {item.sellPrice}</div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => handleEditFromQueue(idx)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-all"><Edit2 size={16}/></button>
                                        <button onClick={() => setItemToDelete({ id: idx.toString(), type: 'bulk_products', name: item.name || 'Item' })} className="p-2 text-red-400 hover:bg-red-50 rounded-full transition-all"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-6">
                {/* 1. Essential Product Definition (Aesthetic Card) */}
                <Card className="!p-8 sm:!p-10 shadow-xl border border-gray-100/50 rounded-[2.5rem] bg-white/80 backdrop-blur-md">
                    <div className="border-b border-gray-100 pb-5 mb-8">
                        <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                            <FileText size={14}/> Part 1: Primary Product Info
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        {/* Product Name */}
                        <div className="md:col-span-2 space-y-1.5">
                            <label className={`text-[11px] font-bold uppercase tracking-wider px-2 flex items-center gap-1.5 ${validationErrors.has('name') ? 'text-red-600' : 'text-gray-500'}`}>
                                <FileText size={13} className="text-gray-400"/> Product Name <span className="text-red-500">*</span>
                            </label>
                            <input 
                                ref={editNameRef} 
                                onKeyDown={(e) => handleEditorKeyDown(e, editSkuRef)} 
                                placeholder="e.g. Acme Super Connector or Clinical Medicine" 
                                value={newProduct.name} 
                                onChange={e => setNewProduct({...newProduct, name: e.target.value})} 
                                onBlur={handleNameBlur} 
                                autoFocus={!isEditing} 
                                className={`${inputBaseClass} ${validationErrors.has('name') ? errorClass : ''}`} 
                            />
                        </div>

                        {/* SKU / Barcode */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 px-2 flex items-center gap-1.5">
                                <Scan size={13} className="text-gray-400"/> SKU / Barcode
                            </label>
                            <div className="relative">
                                <input 
                                    ref={editSkuRef} 
                                    onKeyDown={(e) => handleEditorKeyDown(e, editCategoryRef)} 
                                    placeholder="Scan or enter identifier" 
                                    value={newProduct.sku} 
                                    onChange={e => setNewProduct({...newProduct, sku: e.target.value})} 
                                    className={`${inputBaseClass} pr-14`} 
                                />
                                <button 
                                    onClick={() => { window.history.pushState({ tab: Tab.WAREHOUSE, depth: 2 }, ''); setShowScanner(true); }} 
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-full transition-all active:scale-90"
                                    title="Scan Barcode"
                                >
                                    <Scan size={20}/>
                                </button>
                            </div>
                        </div>

                        {/* Category */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 px-2 flex items-center gap-1.5">
                                <Layers size={13} className="text-gray-400"/> Product Category
                            </label>
                            <div className="relative">
                                <select 
                                    ref={editCategoryRef} 
                                    onKeyDown={(e) => handleEditorKeyDown(e, editSellRef)} 
                                    value={newProduct.tagId || ''} 
                                    onChange={(e) => { 
                                        if (e.target.value === 'NEW_TAG_TRIGGER') {
                                            window.history.pushState({ tab: Tab.WAREHOUSE, depth: 2 }, '');
                                            setShowTagModal(true);
                                        } else {
                                            setNewProduct({...newProduct, tagId: e.target.value});
                                        }
                                    }} 
                                    className={`${selectBaseClass}`}
                                >
                                    <option value="">Select Category</option>
                                    {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    <option value="NEW_TAG_TRIGGER" className="font-bold text-blue-600">+ Create New Category</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-5 flex items-center text-gray-500">
                                    <ChevronDown size={18}/>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* 2. Stock, Batch Calculation, Shelf Location (Aesthetic Card) */}
                <Card className="!p-8 sm:!p-10 shadow-xl border border-gray-100/50 rounded-[2.5rem] bg-white/80 backdrop-blur-md">
                    <div className="border-b border-gray-100 pb-5 mb-8">
                        <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                            <Box size={14}/> Part 2: Stock Tracking & Warehouse Storage
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        {/* Stock Quantity with custom Pill Calculator */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between px-2">
                                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                                    <Box size={13} className="text-gray-400"/> Stock Quantity
                                </label>
                                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">Multipliers</span>
                            </div>
                            <div className={`flex items-center bg-white border-2 ${purpleBorderClass} rounded-full overflow-hidden h-[54px] pr-2 shadow-inner transition-all hover:shadow`}>
                                <input 
                                    ref={editStockRef} 
                                    onKeyDown={(e) => handleEditorKeyDown(e, editSizeRef)} 
                                    type="number" 
                                    placeholder="0" 
                                    className="flex-1 px-6 py-3.5 outline-none font-bold text-gray-900 h-full w-full bg-transparent text-base" 
                                    value={newProduct.stock || ''} 
                                    onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value) || 0})} 
                                />
                                <div className="flex items-center gap-1.5 px-3.5 bg-purple-50/75 h-[40px] rounded-full border border-purple-200/50 shrink-0 select-none">
                                    <span className="text-[9px] font-bold text-purple-600 tracking-wider">CALC:</span>
                                    <input 
                                        type="number" 
                                        placeholder="Box" 
                                        className="w-12 h-7 px-1 text-center bg-white border border-purple-200 rounded-full text-xs outline-none font-bold text-purple-700" 
                                        value={batchConfig.packs} 
                                        onChange={(e) => handleBatchChange('packs', e.target.value)} 
                                     />
                                    <span className="text-purple-400 font-bold text-xs">×</span>
                                    <input 
                                        type="number" 
                                        placeholder="Qty" 
                                        className="w-12 h-7 px-1 text-center bg-white border border-purple-200 rounded-full text-xs outline-none font-bold text-purple-700" 
                                        value={batchConfig.perPack} 
                                        onChange={(e) => handleBatchChange('perPack', e.target.value)} 
                                     />
                                </div>
                            </div>
                        </div>

                        {/* Shelf Location */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 px-2 flex items-center gap-1.5">
                                <MapPin size={13} className="text-gray-400"/> Storage Location / Shelf
                            </label>
                            <input 
                                ref={editLocationRef} 
                                onKeyDown={(e) => handleEditorKeyDown(e, editUnitSizeRef)} 
                                placeholder="e.g. Aisle 3, Shelf B4" 
                                value={newProduct.location || ''} 
                                onChange={e => setNewProduct({...newProduct, location: e.target.value})} 
                                className={`${inputBaseClass} ${purpleBorderClass}`} 
                            />
                        </div>

                        {/* Unit & Unit Capacity inside Pill */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 px-2 flex items-center gap-1.5">
                                <Scale size={13} className="text-gray-400"/> Packaging Unit
                            </label>
                            <div className={`flex w-full rounded-full overflow-hidden border-2 ${purpleBorderClass} h-[54px] bg-white transition-all hover:shadow`}>
                                <input 
                                    ref={editUnitSizeRef} 
                                    onKeyDown={(e) => handleEditorKeyDown(e, editLowStockRef)} 
                                    type="text" 
                                    placeholder="Unit capacity (e.g. 1)" 
                                    className="w-1/2 bg-transparent px-6 py-3.5 text-left font-semibold text-gray-800 outline-none h-full border-r border-purple-100" 
                                    value={newProduct.capacity || ''} 
                                    onChange={(e) => setNewProduct({...newProduct, capacity: e.target.value})} 
                                />
                                <div className="w-1/2 relative h-full">
                                    <select 
                                        value={newProduct.unit || 'pcs'} 
                                        onChange={e => setNewProduct({...newProduct, unit: e.target.value})} 
                                        className="w-full h-full bg-transparent pl-6 pr-10 font-bold outline-none cursor-pointer appearance-none text-gray-800"
                                    >
                                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-500">
                                        <ChevronDown size={16}/>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Low Stock Alert */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 px-2 flex items-center gap-1.5">
                                <AlertTriangle size={13} className="text-gray-400"/> Low Stock Alert Threshold
                            </label>
                            <input 
                                ref={editLowStockRef} 
                                onKeyDown={(e) => handleEditorKeyDown(e, editBuyRef)} 
                                type="number" 
                                placeholder="Alert when stock goes below" 
                                value={newProduct.lowStockThreshold || ''} 
                                onChange={e => setNewProduct({...newProduct, lowStockThreshold: parseInt(e.target.value) || 0})} 
                                className={`${inputBaseClass} ${purpleBorderClass}`} 
                            />
                        </div>
                    </div>
                </Card>

                {/* 3. Pricing Matrix (Aesthetic Card) */}
                <Card className="!p-8 sm:!p-10 shadow-xl border border-gray-100/50 rounded-[2.5rem] bg-white/80 backdrop-blur-md">
                    <div className="border-b border-gray-100 pb-5 mb-8">
                        <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                            <TagIcon size={14}/> Part 3: Pricing & Valuation
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        {/* Sell Price */}
                        <div className="space-y-1.5">
                            <label className={`text-[11px] font-bold uppercase tracking-wider px-2 flex items-center gap-1.5 ${validationErrors.has('sellPrice') ? 'text-red-600' : 'text-gray-500'}`}>
                                <DollarSign size={13} className="text-gray-400"/> Sell Price ({settings.currencySymbol}) <span className="text-red-500">*</span>
                            </label>
                            <input 
                                ref={editSellRef} 
                                onKeyDown={(e) => handleEditorKeyDown(e, editBuyRef)} 
                                type="number" 
                                placeholder="0.00" 
                                value={newProduct.sellPrice || ''} 
                                onChange={e => setNewProduct({...newProduct, sellPrice: parseFloat(e.target.value) || 0})} 
                                className={`${inputBaseClass} ${validationErrors.has('sellPrice') ? errorClass : ''}`} 
                            />
                        </div>

                        {/* Buy Price */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 px-2 flex items-center gap-1.5">
                                <DollarSign size={13} className="text-gray-400"/> Buy Price ({settings.currencySymbol})
                            </label>
                            <input 
                                ref={editBuyRef} 
                                onKeyDown={(e) => handleEditorKeyDown(e, editWholesaleRef)} 
                                type="number" 
                                placeholder="Cost price to purchase" 
                                value={newProduct.buyPrice || ''} 
                                onChange={e => setNewProduct({...newProduct, buyPrice: parseFloat(e.target.value) || 0})} 
                                className={`${inputBaseClass} ${greenBorderClass}`} 
                            />
                        </div>

                        {/* Wholesale Price */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 px-2 flex items-center gap-1.5">
                                <DollarSign size={13} className="text-gray-400"/> Wholesale Price ({settings.currencySymbol})
                            </label>
                            <input 
                                ref={editWholesaleRef} 
                                onKeyDown={(e) => handleEditorKeyDown(e, editTaxRef)} 
                                type="number" 
                                placeholder="Bulk buy discount price" 
                                value={newProduct.wholesalePrice || ''} 
                                onChange={e => setNewProduct({...newProduct, wholesalePrice: parseFloat(e.target.value) || 0})} 
                                className={`${inputBaseClass} ${greenBorderClass}`} 
                            />
                        </div>

                        {/* Tax Rate */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 px-2 flex items-center gap-1.5">
                                <Percent size={13} className="text-gray-400"/> Tax Rate (%)
                            </label>
                            <input 
                                ref={editTaxRef} 
                                onKeyDown={(e) => handleEditorKeyDown(e, editSizeRef)} 
                                type="number" 
                                placeholder="e.g. 18%" 
                                value={newProduct.taxRate || ''} 
                                onChange={e => setNewProduct({...newProduct, taxRate: parseFloat(e.target.value) || 0})} 
                                className={`${inputBaseClass} ${greenBorderClass}`} 
                            />
                        </div>
                    </div>
                </Card>

                {/* 4. Warehouse Specific Dynamic Requirements (Aesthetic Card) */}
                <Card className="!p-8 sm:!p-10 shadow-xl border border-indigo-100/50 rounded-[2.5rem] bg-indigo-50/20 backdrop-blur-md">
                    <div className="border-b border-indigo-100/60 pb-5 mb-8 flex justify-between items-center">
                        <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                            <Sparkles size={14}/> Dynamic Warehouse Specifications
                        </h3>
                        <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full uppercase tracking-wider">
                            Type: {wType}
                        </span>
                    </div>

                    {/* Render different inputs depending on warehouseType */}
                    {wType === 'pharma' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 animate-in fade-in duration-300">
                            <div className="space-y-2">
                                <label className="font-bold text-gray-700 text-sm px-2 flex items-center gap-2">
                                    <Clock size={14} className="text-red-500"/> Drug Expiry Date (Critical)
                                </label>
                                <input 
                                    ref={editExpiryRef} 
                                    type="date" 
                                    value={newProduct.expiryDate || ''} 
                                    onChange={(e) => setNewProduct({...newProduct, expiryDate: e.target.value})} 
                                    className={`${inputBaseClass} ${amberBorderClass}`} 
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <label className="font-bold text-gray-700 text-sm px-2 flex items-center gap-2">
                                    <Factory size={14} className="text-amber-500"/> Batch Manufacturing Date
                                </label>
                                <input 
                                    ref={editMfgRef} 
                                    type="date" 
                                    value={newProduct.manufacturingDate || ''} 
                                    onChange={(e) => setNewProduct({...newProduct, manufacturingDate: e.target.value})} 
                                    className={`${inputBaseClass} ${amberBorderClass}`} 
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="font-bold text-gray-700 text-sm px-2 flex items-center gap-2">
                                    <Building size={14} className="text-gray-400"/> Pharmaceutical Manufacturer
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Pfizer, Novartis" 
                                    value={newProduct.brand || ''} 
                                    onChange={(e) => setNewProduct({...newProduct, brand: e.target.value})} 
                                    className={`${inputBaseClass} ${amberBorderClass}`} 
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="font-bold text-gray-700 text-sm px-2 flex items-center gap-2">
                                    <HeartPulse size={14} className="text-gray-400"/> Medical Supplier / Vendor
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Clinical Distributors Inc" 
                                    value={newProduct.supplier || ''} 
                                    onChange={(e) => setNewProduct({...newProduct, supplier: e.target.value})} 
                                    className={`${inputBaseClass} ${amberBorderClass}`} 
                                />
                            </div>
                        </div>
                    )}

                    {wType === 'grocery' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 animate-in fade-in duration-300">
                            <div className="space-y-2">
                                <label className="font-bold text-gray-700 text-sm px-2 flex items-center gap-2">
                                    <Clock size={14} className="text-amber-500"/> Expiration Date (Freshness)
                                </label>
                                <input 
                                    ref={editExpiryRef} 
                                    type="date" 
                                    value={newProduct.expiryDate || ''} 
                                    onChange={(e) => setNewProduct({...newProduct, expiryDate: e.target.value})} 
                                    className={`${inputBaseClass} ${amberBorderClass}`} 
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="font-bold text-gray-700 text-sm px-2 flex items-center gap-2">
                                    <Thermometer size={14} className="text-blue-500"/> Storage Temp / Section
                                </label>
                                <select 
                                    value={newProduct.color || 'ambient'} 
                                    onChange={(e) => setNewProduct({...newProduct, color: e.target.value})} 
                                    className={`${selectBaseClass} ${amberBorderClass}`}
                                >
                                    <option value="ambient">Ambient Temp (Shelf)</option>
                                    <option value="refrigerated">Refrigerated (Chilled)</option>
                                    <option value="frozen">Frozen (Deep Freeze)</option>
                                    <option value="cool_dry">Cool & Dry storage</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="font-bold text-gray-700 text-sm px-2 flex items-center gap-2">
                                    <Scale size={14} className="text-gray-400"/> Pack Net Weight / Volume
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. 500g, 2 Liters, 12-Pack" 
                                    value={newProduct.weight || ''} 
                                    onChange={(e) => setNewProduct({...newProduct, weight: e.target.value})} 
                                    className={`${inputBaseClass} ${amberBorderClass}`} 
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="font-bold text-gray-700 text-sm px-2 flex items-center gap-2">
                                    <Factory size={14} className="text-gray-400"/> Farm / Brand / Producer
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Dole, Organic Farms" 
                                    value={newProduct.brand || ''} 
                                    onChange={(e) => setNewProduct({...newProduct, brand: e.target.value})} 
                                    className={`${inputBaseClass} ${amberBorderClass}`} 
                                />
                            </div>
                        </div>
                    )}

                    {wType === 'electronics' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 animate-in fade-in duration-300">
                            <div className="space-y-2">
                                <label className="font-bold text-gray-700 text-sm px-2 flex items-center gap-2">
                                    <Cpu size={14} className="text-indigo-500"/> Device Brand / Manufacturer
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Apple, Samsung, Sony" 
                                    value={newProduct.brand || ''} 
                                    onChange={(e) => setNewProduct({...newProduct, brand: e.target.value})} 
                                    className={`${inputBaseClass} border-indigo-200`} 
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="font-bold text-gray-700 text-sm px-2 flex items-center gap-2">
                                    <ShieldCheck size={14} className="text-emerald-500"/> Warranty Period (Months)
                                </label>
                                <input 
                                    type="number" 
                                    placeholder="e.g. 12 or 24" 
                                    value={newProduct.warranty || ''} 
                                    onChange={(e) => setNewProduct({...newProduct, warranty: e.target.value})} 
                                    className={`${inputBaseClass} border-indigo-200`} 
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="font-bold text-gray-700 text-sm px-2 flex items-center gap-2">
                                    <Smartphone size={14} className="text-gray-400"/> Model / Version Number
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Pro Max 15, V2" 
                                    value={newProduct.size || ''} 
                                    onChange={(e) => setNewProduct({...newProduct, size: e.target.value})} 
                                    className={`${inputBaseClass} border-indigo-200`} 
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="font-bold text-gray-700 text-sm px-2 flex items-center gap-2">
                                    <Sparkles size={14} className="text-gray-400"/> Device Color / Finish
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Space Gray, Titanium" 
                                    value={newProduct.color || ''} 
                                    onChange={(e) => setNewProduct({...newProduct, color: e.target.value})} 
                                    className={`${inputBaseClass} border-indigo-200`} 
                                />
                            </div>
                        </div>
                    )}

                    {wType === 'clothing' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 animate-in fade-in duration-300">
                            <div className="space-y-2">
                                <label className="font-bold text-gray-700 text-sm px-2 flex items-center gap-2">
                                    <Scissors size={14} className="text-pink-500"/> Size Specification
                                </label>
                                <select 
                                    value={newProduct.size || 'M'} 
                                    onChange={(e) => setNewProduct({...newProduct, size: e.target.value})} 
                                    className={`${selectBaseClass} border-indigo-200`}
                                >
                                    <option value="XS">Extra Small (XS)</option>
                                    <option value="S">Small (S)</option>
                                    <option value="M">Medium (M)</option>
                                    <option value="L">Large (L)</option>
                                    <option value="XL">Extra Large (XL)</option>
                                    <option value="XXL">Double Extra Large (XXL)</option>
                                    <option value="free_size">Free Size</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="font-bold text-gray-700 text-sm px-2 flex items-center gap-2">
                                    <Sparkles size={14} className="text-purple-500"/> Color / Variant Style
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Indigo Blue, Midnight" 
                                    value={newProduct.color || ''} 
                                    onChange={(e) => setNewProduct({...newProduct, color: e.target.value})} 
                                    className={`${inputBaseClass} border-indigo-200`} 
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="font-bold text-gray-700 text-sm px-2 flex items-center gap-2">
                                    <Shirt size={14} className="text-gray-400"/> Fabric / Material Type
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. 100% Organic Cotton" 
                                    value={newProduct.weight || ''} 
                                    onChange={(e) => setNewProduct({...newProduct, weight: e.target.value})} 
                                    className={`${inputBaseClass} border-indigo-200`} 
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="font-bold text-gray-700 text-sm px-2 flex items-center gap-2">
                                    <Crown size={14} className="text-gray-400"/> Brand / Fashion Line
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Zara, Nike, Custom" 
                                    value={newProduct.brand || ''} 
                                    onChange={(e) => setNewProduct({...newProduct, brand: e.target.value})} 
                                    className={`${inputBaseClass} border-indigo-200`} 
                                />
                            </div>
                        </div>
                    )}

                    {wType === 'general' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 animate-in fade-in duration-300">
                            <div className="space-y-2">
                                <label className="font-bold text-gray-700 text-sm px-2 flex items-center gap-2">
                                    <Truck size={14} className="text-indigo-500"/> Main Supplier / Vendor
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Apex Industrial Supplies" 
                                    value={newProduct.supplier || ''} 
                                    onChange={(e) => setNewProduct({...newProduct, supplier: e.target.value})} 
                                    className={`${inputBaseClass} border-indigo-200`} 
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="font-bold text-gray-700 text-sm px-2 flex items-center gap-2">
                                    <Weight size={14} className="text-emerald-500"/> Item Weight / Gross Volume
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. 15 kg, 120 Liters" 
                                    value={newProduct.weight || ''} 
                                    onChange={(e) => setNewProduct({...newProduct, weight: e.target.value})} 
                                    className={`${inputBaseClass} border-indigo-200`} 
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="font-bold text-gray-700 text-sm px-2 flex items-center gap-2">
                                    <Hammer size={14} className="text-gray-400"/> Material / Tech Specifications
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Mild Steel, Heavy Duty Polycarbonate" 
                                    value={newProduct.size || ''} 
                                    onChange={(e) => setNewProduct({...newProduct, size: e.target.value})} 
                                    className={`${inputBaseClass} border-indigo-200`} 
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="font-bold text-gray-700 text-sm px-2 flex items-center gap-2">
                                    <Building size={14} className="text-gray-400"/> Manufacturer Brand
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Bosch, DeWalt" 
                                    value={newProduct.brand || ''} 
                                    onChange={(e) => setNewProduct({...newProduct, brand: e.target.value})} 
                                    className={`${inputBaseClass} border-indigo-200`} 
                                />
                            </div>
                        </div>
                    )}
                </Card>
            </div>

            {/* Form Control Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-10 pt-8 border-t border-gray-100">
                <Button 
                    variant="neutral" 
                    onClick={() => { setIsEditorOpen(false); window.history.back(); }} 
                    className="py-4 !rounded-full font-black uppercase tracking-widest text-xs border-2 border-gray-100 hover:bg-gray-50 text-gray-500 active:scale-95"
                >
                    Cancel
                </Button>
                <Button 
                    variant="neutral" 
                    onClick={handleAddToBatch} 
                    className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 py-4 !rounded-full font-black uppercase tracking-widest text-xs border-2 border-indigo-100 flex items-center justify-center gap-2 active:scale-95"
                >
                    <ListPlus size={20}/> Queue
                </Button>
                <Button 
                    onClick={handleSaveProduct} 
                    className="py-4 !rounded-full font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-200/50 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white active:scale-95"
                >
                    {isEditing ? <Save size={20}/> : <Plus size={20}/>} 
                    {isEditing ? "Update Product" : "Save Product"}
                </Button>
            </div>
        </div>
    );
  };

  const renderProducts = () => (
      <div className="space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-6 md:px-8 pb-12 pt-4">
              {groupedProducts.map(g => renderProductGroup(g.key, g.items))}
          </div>

          {groupedProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
                  <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 ring-8 ring-gray-50/50">
                      <Search size={48} className="text-gray-200" strokeWidth={1.5}/>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">No products found</h3>
                  <p className="text-gray-500 mt-2 max-w-xs mx-auto">Try adjusting your search or filters.</p>
              </div>
          )}
      </div>
  );

  const renderTags = () => {
    const filteredTags = tags.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return (
      <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto px-6 md:px-8 py-4">
          <div className="flex justify-between items-center">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">All Categories</span>
              <Button onClick={() => { setIsEditingTag(false); setNewTag({ name: '', color: '#3b82f6' }); window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, ''); setShowTagModal(true); }} className="rounded-full !py-2 !px-4 shadow-sm whitespace-nowrap flex items-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"><Plus size={16} className="mr-1"/> Create Category</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTags.map(t => (
                  <Card key={t.id} className="flex justify-between items-center group hover:shadow-lg transition-all border border-gray-100 cursor-pointer active:scale-95 relative overflow-hidden" onClick={() => { setActiveTab(SubTab.PRODUCTS); }}>
                      <div className="flex items-center gap-4 flex-1">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-50 border border-gray-100 shadow-inner"><div className="w-5 h-5 rounded-full" style={{ backgroundColor: t.color }}></div></div>
                          <div><div className="font-bold text-gray-800 text-lg text-left">{t.name}</div><div className="text-xs text-gray-500 font-medium uppercase tracking-widest text-left">{products.filter(p => p.tagId === t.id).length} Products</div></div>
                      </div>
                      <div className="relative z-10 flex items-center gap-1">
                          <button onClick={(e) => { e.stopPropagation(); setNewTag({ ...t }); setIsEditingTag(true); window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, ''); setShowTagModal(true); }} className="text-gray-400 hover:text-blue-600 p-2 transition-colors bg-white hover:bg-blue-50 rounded-full border border-transparent hover:border-blue-100" title="Edit Category"><Pencil size={18} /></button>
                          <button onClick={(e) => { e.stopPropagation(); setItemToDelete({ id: t.id, type: 'tag', name: t.name }); window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, ''); }} className="text-gray-400 hover:text-red-600 p-2 transition-colors bg-white hover:bg-red-50 rounded-full border border-transparent hover:border-red-100" title="Delete Category"><Trash2 size={18} /></button>
                      </div>
                  </Card>
              ))}
          </div>
          {filteredTags.length === 0 && <div className="text-center py-20 text-gray-400"><TagIcon size={48} className="mx-auto mb-2 opacity-20"/><p className="text-lg font-medium">No categories found.</p></div>}
      </div>
    );
  };


  if (viewMode === 'REVIEW') {
      return (
          <div className="fixed inset-0 bg-white z-[60] flex flex-col animate-in slide-in-from-right duration-300">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shadow-sm shrink-0">
                  <div className="flex items-center gap-3"><button onClick={handleCloseReview} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft size={24} className="text-gray-600" /></button><div><h1 className="text-xl font-bold text-gray-900">Review Items</h1><p className="text-xs text-gray-500">{parsedProducts.length} items detected</p></div></div>
                  <Button onClick={handleImportParsedProducts} className="!rounded-full px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 border-0 font-bold transition-all active:scale-95 flex items-center gap-2"><Save size={18}/> Import All</Button>
              </div>
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-gray-50">
                  <div className="md:w-1/2 p-4 flex items-center justify-center bg-gray-900 relative group overflow-hidden shrink-0 h-1/3 md:h-full">{invoiceImage ? <img src={invoiceImage} className="max-w-full max-h-full object-contain" alt="Invoice" /> : <div className="text-gray-500 flex flex-col items-center"><Eye size={48} className="mb-2 opacity-50"/><span>No image preview</span></div>}</div>
                  <div className="flex-1 overflow-y-auto p-4 bg-white">
                      <table className="w-full text-sm">
                        <thead className="bg-white text-gray-500 font-bold text-xs uppercase sticky top-0 z-10 shadow-sm"><tr><th className="pb-3 pt-2 text-left pl-2">Product Name</th><th className="pb-3 pt-2 text-center w-16">Qty</th><th className="pb-3 pt-2 text-right w-20">Sell</th><th className="pb-3 pt-2 text-center w-10"></th></tr></thead>
                        <tbody className="divide-y divide-gray-100">
                            {parsedProducts.map((p, idx) => (
                                <tr key={idx} className="group hover:bg-blue-50/30 transition-colors">
                                    <td className="py-3 px-2 align-top"><input className="w-full bg-transparent border-b border-transparent focus:border-blue-400 focus:outline-none font-bold text-gray-900 py-1" value={p.name} onChange={(e) => updateParsedProduct(idx, 'name', e.target.value)} /><div className="flex gap-2 mt-2"><input className="bg-gray-100 rounded px-2 py-1 text-xs text-gray-600 w-24" value={p.category || ''} onChange={(e) => updateParsedProduct(idx, 'category', e.target.value)} /><select className="bg-gray-100 rounded px-1 py-1 text-xs text-gray-600" value={p.unit} onChange={(e) => updateParsedProduct(idx, 'unit', e.target.value)}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></div></td>
                                    <td className="py-3 px-1 align-top"><input type="number" className="w-full bg-gray-50 border border-gray-200 rounded px-1 py-1 text-center font-bold text-gray-700" value={p.stock} onChange={(e) => updateParsedProduct(idx, 'stock', parseFloat(e.target.value))} /></td>
                                    <td className="py-3 px-1 align-top"><div className="relative"><span className="absolute left-2 top-1.5 text-gray-400 text-xs">₹</span><input type="number" className="w-full pl-4 bg-transparent border-b border-transparent text-right font-bold text-green-700 py-1" value={p.sellPrice} onChange={(e) => updateParsedProduct(idx, 'sellPrice', parseFloat(e.target.value))} /></div><div className="relative mt-1"><span className="absolute left-2 top-1.5 text-gray-400 text-xs">Buy</span><input type="number" className="w-full pl-8 bg-transparent border-b border-transparent text-right text-xs text-gray-500 py-1" value={p.buyPrice} onChange={(e) => updateParsedProduct(idx, 'buyPrice', parseFloat(e.target.value))} /></div></td>
                                    <td className="py-3 pl-2 text-center align-top pt-4"><button onClick={() => removeParsedProduct(idx)} className="text-gray-300 hover:text-red-500 transition-colors p-1 hover:bg-red-50 rounded"><X size={16} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="pb-32 min-h-screen" onTouchStart={(e) => setTouchStart({x: e.touches[0].clientX, y: e.touches[0].clientY})} onTouchMove={(e) => setTouchEnd({x: e.touches[0].clientX, y: e.touches[0].clientY})} onTouchEnd={() => { if(!touchStart || !touchEnd) return; const dx = touchStart.x - touchEnd.x; if(Math.abs(dx) > 50) { const tabs = [SubTab.PRODUCTS, SubTab.TAGS]; const idx = tabs.indexOf(activeTab); if(dx > 0 && idx < tabs.length - 1) setActiveTab(tabs[idx+1]); if(dx < 0 && idx > 0) setActiveTab(tabs[idx-1]); } }}>
      {!isEditorOpen && (
          <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-3.5">
              <button 
                  onClick={handleAnalyzeClick} 
                  className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-full shadow-xl shadow-indigo-500/20 border-0 font-bold text-xs tracking-wider uppercase transition-all active:scale-95 cursor-pointer"
              >
                  {isParsingInvoice ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16} />}
                  <span>Scan via AI</span>
              </button>
              <button 
                  onClick={handleOpenAdd} 
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-xl shadow-emerald-500/20 flex items-center justify-center border-0 transition-all active:scale-95 cursor-pointer"
              >
                  <Plus size={24}/>
              </button>
          </div>
      )}
      <div className="w-full">
          {isEditorOpen ? renderEditor() : (
              <>
                  {/* Top Fixed/Sticky Navbar */}
                  <div id="warehouse-navbar" className="sticky top-0 z-30 -mx-4 -mt-4 px-4 py-3 md:-mx-6 md:-mt-6 md:px-6 bg-gradient-to-r from-emerald-50/80 via-white/90 to-white/95 backdrop-blur-md border-b border-emerald-100/60 flex items-center justify-between gap-4 mb-6 shadow-[0_1px_3px_rgba(16,185,129,0.05)]">
                      {/* Left Side: Stock Info & SubTabs Toggle */}
                      <div id="warehouse-left" className="flex items-center gap-4 shrink-0 select-none">
                          <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl shadow-md shadow-emerald-500/35"><Box size={18} /></div>
                              <div className="text-left">
                                  <h2 className="text-sm font-extrabold text-slate-800 leading-tight">Stock</h2>
                                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                                      {activeTab === SubTab.PRODUCTS ? `${products.length} Products` : `${tags.length} Categories`}
                                  </p>
                              </div>
                          </div>
                          
                          {/* Elegant segment controller for SubTabs */}
                          <div className="bg-slate-100/80 p-0.5 rounded-full flex items-center text-[11px] font-bold shadow-inner">
                              <button 
                                  onClick={() => { setActiveTab(SubTab.PRODUCTS); setSearchTerm(''); }} 
                                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${activeTab === SubTab.PRODUCTS ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                              >
                                  Products
                              </button>
                              <button 
                                  onClick={() => { setActiveTab(SubTab.TAGS); setSearchTerm(''); }} 
                                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${activeTab === SubTab.TAGS ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                              >
                                  Categories
                              </button>
                          </div>
                      </div>

                      {/* Right Side: Search / Actions */}
                      <div id="warehouse-right" className="flex-1 max-w-lg flex items-center gap-2.5 justify-end">
                          <div id="warehouse-search-container" className="flex-1 max-w-sm relative">
                              <div className="relative flex items-center bg-white hover:bg-slate-50 focus-within:bg-white rounded-full transition-all duration-300 border border-slate-200 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 focus-within:shadow-sm h-10 px-3.5">
                                    <Search className={`mr-2 shrink-0 transition-colors duration-300 ${isAiParsing ? 'text-indigo-500 animate-pulse' : 'text-emerald-500'}`} size={18} />
                                    <input 
                                        type="text" 
                                        placeholder={activeTab === SubTab.PRODUCTS ? "Ask Gemini or search..." : "Search categories..."} 
                                        className="w-full bg-transparent border-none focus:ring-0 text-xs text-slate-700 placeholder-slate-400 h-full outline-none font-bold" 
                                        value={searchTerm} 
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && activeTab === SubTab.PRODUCTS) {
                                                runAiSearch(searchTerm);
                                            }
                                        }}
                                    />
                                    {isAiParsing ? (
                                        <Loader2 size={16} className="text-indigo-500 animate-spin shrink-0 mr-2" />
                                    ) : searchTerm && (
                                        <button 
                                            onClick={() => {
                                                setSearchTerm('');
                                                if (activeTab === SubTab.PRODUCTS) {
                                                    setAiFilters({});
                                                    setAiNotice(null);
                                                    setActiveFilter(ProductFilter.ALL);
                                                }
                                            }}
                                            className="text-gray-400 hover:text-gray-600 p-1.5 shrink-0 mr-2"
                                            title="Clear search"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                    {activeTab === SubTab.PRODUCTS && (
                                        <button onClick={() => { window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, ''); setShowScanner(true); }} className="text-gray-400 hover:text-emerald-600 transition-colors p-1 shrink-0" title="Scan Barcode">
                                            <Scan size={18} />
                                        </button>
                                    )}
                              </div>
                          </div>

                          {activeTab === SubTab.PRODUCTS && (
                              <div className="relative shrink-0">
                                   <button 
                                       onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                                       className="flex items-center gap-1.5 bg-white px-3 h-10 rounded-full border border-slate-200 text-slate-700 hover:border-emerald-400 hover:bg-slate-50 font-bold text-xs shadow-sm active:scale-95 transition-all"
                                       title="Filter Stocks"
                                   >
                                       <Filter size={14} className="text-emerald-500"/>
                                       <span className="hidden sm:inline">Filter</span>
                                       <ChevronDown size={14} className={`transition-transform duration-200 ${showFilterDropdown ? 'rotate-180' : ''}`}/>
                                   </button>

                                   {showFilterDropdown && (
                                       <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                                           <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Stock Status</div>
                                           {[
                                               { id: ProductFilter.ALL, label: 'All Stocks' },
                                               { id: ProductFilter.LOW_STOCK, label: 'Low Stock' },
                                               { id: ProductFilter.OUT_OF_STOCK, label: 'Out of Stock' },
                                               { id: ProductFilter.EXPIRING_SOON, label: 'Expiring' }
                                           ].map(f => (
                                               <button
                                                   key={f.id}
                                                   onClick={() => {
                                                       setActiveFilter(f.id);
                                                       setShowFilterDropdown(false);
                                                   }}
                                                   className={`w-full text-left px-5 py-2.5 text-sm font-bold flex items-center justify-between hover:bg-gray-50
                                                       ${activeFilter === f.id ? 'text-emerald-600 bg-emerald-50/50' : 'text-gray-700'}
                                                   `}
                                               >
                                                   {f.label}
                                                   {activeFilter === f.id && <Check size={16} />}
                                               </button>
                                           ))}

                                           {Object.keys(aiFilters).length > 0 && (
                                               <>
                                                   <div className="border-t my-2 border-gray-100"></div>
                                                   <div className="px-4 py-1 text-xs font-bold text-indigo-500 uppercase tracking-wider">AI Filters</div>
                                                   <button
                                                       onClick={() => {
                                                           setAiFilters({});
                                                           setAiNotice(null);
                                                           setShowFilterDropdown(false);
                                                       }}
                                                       className="w-full text-left px-5 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-1.5"
                                                   >
                                                       <Trash2 size={14}/> Clear AI Filters
                                                   </button>
                                               </>
                                           )}
                                       </div>
                                   )}
                              </div>
                          )}
                      </div>
                  </div>

                  {/* AI Guidance/Notice Bar */}
                  {aiNotice && (
                      <div className="max-w-4xl mx-auto w-full px-6 flex items-center justify-between bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs py-2 rounded-full mb-4 animate-in fade-in duration-300">
                          <span className="font-bold flex items-center gap-1"><Sparkles size={12}/> {aiNotice}</span>
                          <button 
                              onClick={() => {
                                  setAiFilters({});
                                  setAiNotice(null);
                              }}
                              className="font-black hover:text-indigo-900 ml-2"
                          >
                              Clear
                          </button>
                      </div>
                  )}

                  {activeTab === SubTab.PRODUCTS && renderProducts()}
                  {activeTab === SubTab.TAGS && renderTags()}
              </>
          )}
      </div>

      <Modal isOpen={showTagModal} onClose={() => { window.history.back(); }} title={isEditingTag ? "Edit Category" : "Create New Tag"}>
          <div className="space-y-4">
              <div><label className="text-xs font-bold text-gray-500 uppercase block mb-1">Category Name</label><Input placeholder="e.g. Dairy" value={newTag.name || ''} onChange={e => setNewTag({...newTag, name: e.target.value})} autoFocus/></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase block mb-2">Color Code</label><div className="grid grid-cols-6 sm:grid-cols-8 gap-3 justify-items-center p-3 bg-gray-50 rounded-xl border border-gray-100">{TAG_COLORS.map(color => (<button key={color} onClick={() => setNewTag({...newTag, color})} className={`w-8 h-8 rounded-full shadow-sm border border-black/5`} style={{ backgroundColor: color, transform: newTag.color === color ? 'scale(1.2)' : 'scale(1)', boxShadow: newTag.color === color ? '0 0 0 2px white, 0 0 0 4px ' + color : '' }}>{newTag.color === color && <Check size={14} className="text-white mx-auto" strokeWidth={4} />}</button>))}</div></div>
              
              <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Custom Hex Code</label>
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg shadow-sm border border-gray-200 shrink-0" style={{ backgroundColor: newTag.color || '#3b82f6' }}></div>
                      <Input placeholder="#3b82f6" value={newTag.color || ''} onChange={e => { const val = e.target.value; if (val === '' || /^#[0-9A-Fa-f]{0,6}$/.test(val)) { setNewTag({...newTag, color: val}); } }} className="flex-1" />
                  </div>
              </div>

              <Button className="w-full mt-2" onClick={handleSaveTag} disabled={isSavingTag}>{isSavingTag ? <Loader2 size={18} className="animate-spin mx-auto"/> : (isEditingTag ? "Update Category" : "Save Category")}</Button>
          </div>
      </Modal>

      <Modal isOpen={!!showTagWarning} onClose={() => setShowTagWarning(null)} title="Duplicate Category">
          <div className="text-center py-4">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200 shadow-sm">
                  <AlertTriangle size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Category Already Exists</h3>
              <p className="text-sm text-gray-500 mb-6 px-2 leading-relaxed">
                  The category <strong>"{showTagWarning}"</strong> has already been created. Each category name must be unique to organize your warehouse effectively.
              </p>
              <Button onClick={() => setShowTagWarning(null)} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3">I Understand</Button>
          </div>
      </Modal>

      <Modal isOpen={showScanner} onClose={() => { window.history.back(); }} title="Scan Barcode"><div className="relative w-full bg-black rounded-lg overflow-hidden min-h-[300px]"><div id="reader" className="w-full"></div></div>{isScanningToAdd && <div className="mt-4 pt-4 border-t border-gray-100 flex justify-center"><Button variant="neutral" onClick={handleManualEntry} className="w-full">Can't scan? Enter Manually</Button></div>}</Modal>
      
      <Modal isOpen={!!itemToDelete} onClose={() => { window.history.back(); }} title="Delete Confirmation">
          <div className="text-center py-4">
              <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
              <h3 className="text-lg font-bold text-gray-900 mb-1">Delete {itemToDelete?.name}?</h3>
              <p className="text-sm text-gray-500 mb-6">This action cannot be undone.</p>
              <div className="flex gap-3">
                  <Button variant="neutral" className="flex-1" onClick={() => { window.history.back(); }}>Cancel</Button>
                  <Button variant="danger" className="flex-1" onClick={confirmDelete}>Delete</Button>
              </div>
          </div>
      </Modal>

      <Modal isOpen={showSourceOptions} onClose={() => { window.history.back(); }} title="Add Stock via AI">
          <div className="grid grid-cols-2 gap-4">
              <button onClick={() => { window.history.pushState({ tab: Tab.WAREHOUSE, depth: 2 }, ''); setShowCamera(true); setShowSourceOptions(false);}} className="flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all gap-3 text-gray-600"><Camera size={32}/><span className="font-bold text-sm">Camera</span></button>
              <button onClick={() => {fileInputRef.current?.click(); setShowSourceOptions(false);}} className="flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-2xl hover:border-purple-500 hover:bg-purple-50 transition-all gap-3 text-gray-600"><FileType size={32}/><span className="font-bold text-sm">Upload</span></button>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
      </Modal>

      {showCamera && (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col">
              <video ref={videoRef} autoPlay playsInline className="flex-1 object-cover"></video>
              <div className="h-32 flex items-center justify-center gap-12 bg-black pb-8">
                  <button onClick={() => { setShowCamera(false); window.history.back(); }} className="p-4 rounded-full bg-white/10 text-white"><X/></button>
                  <button onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 shadow-xl"></button>
                  <div className="w-12"></div>
              </div>
          </div>
      )}

      {isParsingInvoice && (
          <div className="fixed inset-0 z-[100] bg-slate-900/65 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
              <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full mx-4 text-center border border-gray-100 flex flex-col items-center gap-6">
                  <div className="relative">
                      <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white animate-pulse shadow-lg shadow-indigo-500/35">
                          <Sparkles size={36} className="animate-spin duration-3000" />
                      </div>
                      <div className="absolute inset-0 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
                  </div>
                  <div>
                      <h3 className="text-lg font-black text-slate-800 mb-1.5">Processing with Gemini AI</h3>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">
                          We are analyzing your document to extract products, unit measures, prices, and stocks automatically.
                      </p>
                  </div>
                  <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-pulse" style={{ width: '70%' }}></div>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 animate-pulse">Reading Document...</span>
              </div>
          </div>
      )}
    </div>
  );
};
