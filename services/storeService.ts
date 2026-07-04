import { Product, Sale, Customer, Tag, StoreSettings, User, DeletedItem } from '../types';
import { supabase } from './supabase';
import { 
  productToDb, 
  productFromDb, 
  customerToDb, 
  customerFromDb, 
  saleToDb, 
  saleFromDb, 
  tagToDb, 
  tagFromDb, 
  settingsToDb, 
  settingsFromDb, 
  deletedItemToDb, 
  deletedItemFromDb, 
  staffToDb, 
  staffFromDb, 
  productHistoryToDb, 
  productHistoryFromDb,
  StaffRecord,
  ProductHistoryRecord
} from './mappers';

interface StoreData {
  products: Product[];
  tags: Tag[];
  sales: Sale[];
  customers: Customer[];
  users: User[];
  deletedItems: DeletedItem[];
  settings: StoreSettings;
}

const defaultSettings: StoreSettings = {
  storeName: 'My Warehouse',
  storeAddress: '',
  storePhone: '',
  storeEmail: '',
  logo: '',
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
  warehouseType: 'general', 
  upiId: '', 
  salesTarget: 50000,
  receiptHeader: 'Thank you for your business!',
  receiptFooter: 'Please visit us again!',
  showLogoOnReceipt: true,
  taxRateDefault: 18
};

const defaultData: StoreData = {
  products: [],
  tags: [],
  sales: [],
  customers: [],
  users: [],
  deletedItems: [],
  settings: defaultSettings
};

const LS_BACKUP_KEY = 'noor_offline_store_v1';
let cache: StoreData | null = null;
let loadPromise: Promise<StoreData> | null = null;

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

let currentUid: string | null = null;
supabase.auth.onAuthStateChange((_event, session) => {
  currentUid = session?.user?.id || null;
});

const getUid = () => {
  if (currentUid) return currentUid;
  return localStorage.getItem('noor_user_uid') || 'guest';
};

const StoreService = {
  getLastBackupTime() { 
    return localStorage.getItem('noor_last_sync') || new Date().toISOString(); 
  },

  saveToLocalCache() {
    if (cache) {
      localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(cache));
      localStorage.setItem('noor_last_sync', new Date().toISOString());
      
      fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cache)
      }).catch(err => console.warn("Auto-sync background backup failed:", err));
    }
  },

  async loadData(): Promise<StoreData> {
    if (cache) return cache;
    if (loadPromise) return loadPromise;

    loadPromise = new Promise(async (resolve) => {
        const uid = getUid();
        if (!uid || uid === 'guest') {
            const local = localStorage.getItem(LS_BACKUP_KEY);
            cache = local ? { ...defaultData, ...JSON.parse(local) } : JSON.parse(JSON.stringify(defaultData));
            resolve(cache as StoreData);
            return;
        }

        try {
            const [productsRes, salesRes, customersRes, tagsRes, settingsRes, deletedRes] = await Promise.all([
                supabase.from('products').select('*').eq('user_id', uid),
                supabase.from('sales').select('*').eq('user_id', uid),
                supabase.from('customers').select('*').eq('user_id', uid),
                supabase.from('tags').select('*').eq('user_id', uid),
                supabase.from('settings').select('*').eq('user_id', uid),
                supabase.from('deleted_items').select('*').eq('user_id', uid)
            ]);

            const products = (productsRes.data ?? []).map(productFromDb);
            const sales = (salesRes.data ?? []).map(saleFromDb);
            const customers = (customersRes.data ?? []).map(customerFromDb);
            const tags = (tagsRes.data ?? []).map(tagFromDb);
            const deletedItems = (deletedRes.data ?? []).map(deletedItemFromDb);
            
            let settings = defaultSettings;
            try {
                const local = localStorage.getItem(LS_BACKUP_KEY);
                if (local) {
                    const parsed = JSON.parse(local);
                    if (parsed && parsed.settings) {
                        settings = { ...defaultSettings, ...parsed.settings };
                    }
                }
            } catch (e) {
                console.warn("Failed to load local settings fallback:", e);
            }

            if (settingsRes.data && settingsRes.data.length > 0) {
                settings = { ...settings, ...settingsFromDb(settingsRes.data[0]) };
            } else {
                const settingsId = generateId();
                const initialSettings = { ...settings, userId: uid, id: settingsId };
                try {
                    await supabase.from('settings').upsert(settingsToDb(initialSettings, uid));
                } catch (upsertErr) {
                    console.warn("Failed to upsert default onboarding settings to cloud, keeping local configuration:", upsertErr);
                }
                settings = initialSettings;
            }

            cache = {
                products,
                tags,
                sales,
                customers,
                deletedItems,
                users: [],
                settings
            };

            localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(cache));
            localStorage.setItem('noor_last_sync', new Date().toISOString());
            resolve(cache);
        } catch (err) {
            console.warn("Supabase fetch failed, using local cache fallback", err);
            const local = localStorage.getItem(LS_BACKUP_KEY);
            cache = local ? { ...defaultData, ...JSON.parse(local) } : JSON.parse(JSON.stringify(defaultData));
            resolve(cache as StoreData);
        }
    });
    
    return loadPromise.then((d) => { loadPromise = null; return d; });
  },

  async saveData(): Promise<void> {
    this.saveToLocalCache();
  },

  async uploadFile(fileOrBase64: File | string, folder: string): Promise<string> {
    const uid = getUid();
    const filename = `${uid}_${Date.now()}_${generateId().substring(0, 8)}`;
    
    let fileOrBlob: any = fileOrBase64;
    let contentType = 'image/jpeg';
    if (typeof fileOrBase64 === 'string') {
      const mimeMatch = fileOrBase64.match(/^data:(.+);base64,/);
      if (mimeMatch) {
        contentType = mimeMatch[1];
      }
      const base64Data = fileOrBase64.replace(/^data:.+;base64,/, '');
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      fileOrBlob = new Blob([byteArray], { type: contentType });
    } else {
      contentType = fileOrBase64.type || 'image/jpeg';
    }
    
    const path = `${uid}/${folder}/${filename}`;
    const { error } = await supabase.storage.from('uploads').upload(path, fileOrBlob, {
      contentType: contentType,
      upsert: true
    });
    
    if (error) {
      console.error("Storage upload error:", error);
      throw error;
    }
    
    const { data } = supabase.storage.from('uploads').getPublicUrl(path);
    return data.publicUrl;
  },

  // Inventory Management
  async getInventory() { 
    const d = await this.loadData(); 
    return d.products; 
  },
  
  async addProduct(p: Product) { 
      const d = await this.loadData(); 
      const uid = getUid();
      const np = { ...p, id: p.id || generateId(), createdAt: new Date().toISOString(), userId: uid };
      
      d.products.push(np); 
      this.saveToLocalCache();

      // Log action
      const performer = localStorage.getItem('noor_user_name') || 'Admin';
      this.logProductHistory(np.id, np.name, 'create', `Created product with initial stock: ${np.stock} and price: $${np.sellPrice}`, performer);

      // Trigger Supabase sync in the background
      Promise.resolve(supabase.from('products').upsert(productToDb(np, uid)))
        .catch(e => console.error("Supabase sync failed for addProduct:", e));

      return np; 
  },
  
  async updateProduct(id: string, updates: Partial<Product>) {
      const d = await this.loadData();
      const i = d.products.findIndex(x => x.id === id);
      if (i > -1) { 
        const updated = { ...d.products[i], ...updates }; 
        d.products[i] = updated; 
        this.saveToLocalCache();

        // Log action
        const performer = localStorage.getItem('noor_user_name') || 'Admin';
        const detailParts = [];
        if (updates.stock !== undefined) detailParts.push(`Stock: ${updates.stock}`);
        if (updates.sellPrice !== undefined) detailParts.push(`Price: $${updates.sellPrice}`);
        if (updates.name !== undefined) detailParts.push(`Name changed to: "${updates.name}"`);
        const details = detailParts.length > 0 ? `Updated fields: ${detailParts.join(', ')}` : 'Updated details';
        this.logProductHistory(id, updated.name, 'update', details, performer);

        // Trigger Supabase sync in the background
        const uid = getUid();
        Promise.resolve(supabase.from('products').upsert(productToDb(updated, uid)))
          .catch(e => console.error("Supabase sync failed for updateProduct:", e));
      }
  },
  
  async deleteProduct(id: string) {
      const d = await this.loadData();
      const i = d.products.findIndex(x => x.id === id);
      if (i > -1) {
          const [p] = d.products.splice(i, 1);
          const uid = getUid();
          const delItem: DeletedItem = { id: generateId(), originalId: p.id, type: 'product', data: p, deletedAt: new Date().toISOString() };
          
          d.deletedItems.push(delItem);
          this.saveToLocalCache();

          // Log action
          const performer = localStorage.getItem('noor_user_name') || 'Admin';
          this.logProductHistory(p.id, p.name, 'delete', `Deleted product from warehouse (moved to recycle bin)`, performer);

          // Trigger Supabase sync in the background
          Promise.all([
            supabase.from('deleted_items').upsert(deletedItemToDb(delItem, uid)),
            supabase.from('products').delete().eq('id', id)
          ]).catch(e => console.error("Supabase sync failed for deleteProduct:", e));
      }
  },
  
  async batchAddProducts(items: Partial<Product>[]) {
      const d = await this.loadData();
      const uid = getUid();
      const now = new Date().toISOString();
      
      const mappedItems: any[] = [];
      items.forEach(i => {
         const id = i.id || generateId();
         const np = { ...i, id, createdAt: now, userId: uid } as Product;
         d.products.push(np);
         mappedItems.push(productToDb(np, uid));
      });
      
      this.saveToLocalCache();

      // Upsert mappedItems to Supabase
      Promise.resolve(supabase.from('products').upsert(mappedItems))
        .catch(e => console.error("Supabase sync failed for batchAddProducts:", e));
  },

  // Sales Management
  async getSales() { 
    const d = await this.loadData(); 
    return d.sales; 
  },
  
  async createSale(s: any) { 
      const d = await this.loadData(); 
      const uid = getUid();
      const ns = { ...s, id: generateId(), timestamp: new Date().toISOString(), userId: uid };
      
      // Update local state immediately
      d.sales.push(ns); 
      
      s.items.forEach((item: any) => {
          const p = d.products.find(x => x.id === item.id);
          if (p) {
              p.stock = Math.max(0, p.stock - item.quantity);
          }
      });
      
      if (s.customerId) {
          const c = d.customers.find(x => x.id === s.customerId);
          if (c) {
              c.totalSpent += s.total;
              c.visitCount += 1;
              c.totalDues += (s.total - (s.amountPaid || 0));
              if (!c.history) c.history = [];
              c.history.push(ns.id);
          }
      }
      
      this.saveToLocalCache(); 

      // Sync to Supabase in the background
      Promise.resolve(supabase.from('sales').upsert(saleToDb(ns, uid)))
        .then(() => {
            const productUpserts = s.items.map((item: any) => {
                const updatedP = d.products.find(x => x.id === item.id);
                if (updatedP) {
                    return supabase.from('products').upsert(productToDb(updatedP, uid));
                }
                return Promise.resolve();
            });
            let customerUpsert = Promise.resolve() as any;
            if (s.customerId) {
                const c = d.customers.find(x => x.id === s.customerId);
                if (c) {
                    customerUpsert = supabase.from('customers').upsert(customerToDb(c, uid));
                }
            }
            return Promise.all([...productUpserts, customerUpsert]);
        })
        .catch(e => console.warn("Supabase sync failed for createSale, running in offline mode:", e));

      return ns; 
  },
  
  async deleteSales(ids: string[]) {
      const d = await this.loadData();
      const uid = getUid();
      
      const deletedSalesList: DeletedItem[] = [];
      ids.forEach(id => {
          const i = d.sales.findIndex(x => x.id === id);
          if (i > -1) {
              const [s] = d.sales.splice(i, 1);
              const delItem: DeletedItem = { id: generateId(), originalId: s.id, type: 'sale', data: s, deletedAt: new Date().toISOString() };
              
              d.deletedItems.push(delItem);
              deletedSalesList.push(delItem);
          }
      });
      
      this.saveToLocalCache();

      if (deletedSalesList.length > 0) {
          const deletedUpserts = deletedSalesList.map(delItem => 
              supabase.from('deleted_items').upsert(deletedItemToDb(delItem, uid))
          );
          const salesDeletes = deletedSalesList.map(delItem => 
              supabase.from('sales').delete().eq('id', delItem.originalId)
          );
          Promise.all([...deletedUpserts, ...salesDeletes])
             .catch(e => console.warn("Supabase sync failed for deleteSales, running in offline mode:", e));
      }
  },
  
  async updateSale(sale: Sale) {
      const d = await this.loadData();
      const i = d.sales.findIndex(s => s.id === sale.id);
      if (i > -1) { 
        d.sales[i] = sale; 
        this.saveToLocalCache(); 
        const uid = getUid();
        Promise.resolve(supabase.from('sales').upsert(saleToDb(sale, uid)))
          .catch(e => console.warn("Supabase sync failed for updateSale, running in offline mode:", e));
      }
  },

  // Customer Management
  async getCustomers() { 
    const d = await this.loadData(); 
    return d.customers; 
  },
  
  async upsertCustomer(c: Partial<Customer>) {
      const d = await this.loadData();
      const uid = getUid();
      const nc = { ...c, id: c.id || generateId(), userId: uid } as Customer;
      
      const i = d.customers.findIndex(x => x.id === nc.id);
      let updatedCustomer = nc;
      if (i > -1) {
         updatedCustomer = { ...d.customers[i], ...nc };
         d.customers[i] = updatedCustomer;
      } else {
         d.customers.push(updatedCustomer);
      }
      
      this.saveToLocalCache();
      
      Promise.resolve(supabase.from('customers').upsert(customerToDb(updatedCustomer, uid)))
        .catch(e => console.warn("Supabase sync failed for upsertCustomer, running in offline mode:", e));
      return updatedCustomer;
  },
  
  async deleteCustomer(id: string) {
      const d = await this.loadData();
      const i = d.customers.findIndex(x => x.id === id);
      if (i > -1) {
          const [c] = d.customers.splice(i, 1);
          const uid = getUid();
          const delItem: DeletedItem = { id: generateId(), originalId: c.id, type: 'customer', data: c, deletedAt: new Date().toISOString() };
          
          d.deletedItems.push(delItem);
          this.saveToLocalCache();

          Promise.all([
            supabase.from('deleted_items').upsert(deletedItemToDb(delItem, uid)),
            supabase.from('customers').delete().eq('id', id)
          ]).catch(e => console.warn("Supabase sync failed for deleteCustomer, running in offline mode:", e));
      }
  },
  
  async addCustomerPayment(cid: string, amt: number, method: string, note: string, date: string, receipt?: string) {
      const d = await this.loadData();
      const c = d.customers.find(x => x.id === cid);
      if (c) {
          if (!c.payments) c.payments = [];
          
          let receiptUrl = receipt;
          if (receipt && receipt.startsWith('data:')) {
             try {
                receiptUrl = await this.uploadFile(receipt, 'receipts');
             } catch (err) {
                console.warn("Could not upload receipt to cloud, using local base64:", err);
             }
          }
          
          c.payments.push({ id: generateId(), amount: amt, method, note, date, receiptImage: receiptUrl });
          c.totalDues = Math.max(0, c.totalDues - amt);
          
          this.saveToLocalCache();

          const uid = getUid();
          Promise.resolve(supabase.from('customers').upsert(customerToDb(c, uid)))
            .catch(e => console.warn("Supabase sync failed for addCustomerPayment, running in offline mode:", e));
      }
  },

  // Settings & Utilities
  async getSettings() { 
    const d = await this.loadData(); 
    return d.settings; 
  },
  
  async saveSettings(s: StoreSettings) { 
      const d = await this.loadData(); 
      const uid = getUid();
      
      let logoUrl = s.logo;
      if (s.logo && s.logo.startsWith('data:')) {
         try {
            logoUrl = await this.uploadFile(s.logo, 'logos');
         } catch (err) {
            console.warn("Could not upload logo to cloud, using local base64:", err);
         }
      }
      
      const updatedSettings = { ...s, logo: logoUrl, userId: uid };
      d.settings = updatedSettings; 
      this.saveToLocalCache(); 
      
      const settingsId = s.id || generateId();
      Promise.resolve(supabase.from('settings').upsert(settingsToDb({ ...updatedSettings, id: settingsId }, uid)))
        .catch(e => console.warn("Supabase sync failed for saveSettings, running in offline mode:", e));
  },
  
  async getTags() { 
    const d = await this.loadData(); 
    return d.tags; 
  },
  
  async addTag(t: Tag) { 
      const d = await this.loadData(); 
      const uid = getUid();
      const nt = { ...t, id: t.id || generateId(), userId: uid }; 
      
      d.tags.push(nt); 
      this.saveToLocalCache(); 

      Promise.resolve(supabase.from('tags').upsert(tagToDb(nt, uid)))
        .catch(e => console.error("Supabase sync failed for addTag:", e));

      return nt; 
  },
  
  async updateTag(id: string, u: Partial<Tag>) {
      const d = await this.loadData();
      const i = d.tags.findIndex(x => x.id === id);
      if (i > -1) { 
        const updated = { ...d.tags[i], ...u };
        d.tags[i] = updated; 
        this.saveToLocalCache(); 

        const uid = getUid();
        Promise.resolve(supabase.from('tags').upsert(tagToDb(updated, uid)))
          .catch(e => console.error("Supabase sync failed for updateTag:", e));
      }
  },
  
  async deleteTag(id: string) {
      const d = await this.loadData();
      const i = d.tags.findIndex(x => x.id === id);
      if (i > -1) { 
        d.tags.splice(i, 1); 
        this.saveToLocalCache(); 

        Promise.resolve(supabase.from('tags').delete().eq('id', id))
          .catch(e => console.error("Supabase sync failed for deleteTag:", e));
      }
  },

  // Recycle Bin & Data
  async getDeletedItems() { 
    const d = await this.loadData(); 
    return d.deletedItems; 
  },
  
  async restoreItem(id: string) {
      const d = await this.loadData();
      const i = d.deletedItems.findIndex(x => x.id === id);
      if (i > -1) {
          const item = d.deletedItems.splice(i, 1)[0];
          const uid = getUid();
          
          if (item.type === 'product') {
             d.products.push(item.data);
          } else if (item.type === 'customer') {
             d.customers.push(item.data);
          } else if (item.type === 'sale') {
             d.sales.push(item.data);
          }
          
          this.saveToLocalCache();

          const promises: Promise<any>[] = [
              supabase.from('deleted_items').delete().eq('id', id)
          ];
          if (item.type === 'product') {
             promises.push(supabase.from('products').upsert(productToDb(item.data, uid)));
          } else if (item.type === 'customer') {
             promises.push(supabase.from('customers').upsert(customerToDb(item.data, uid)));
          } else if (item.type === 'sale') {
             promises.push(supabase.from('sales').upsert(saleToDb(item.data, uid)));
          }
          Promise.all(promises)
             .catch(e => console.warn("Supabase sync failed for restoreItem, running in offline mode:", e));
      }
  },
  
  async permanentlyDelete(id: string) {
      const d = await this.loadData();
      d.deletedItems = d.deletedItems.filter(x => x.id !== id);
      this.saveToLocalCache();
      Promise.resolve(supabase.from('deleted_items').delete().eq('id', id))
         .catch(e => console.warn("Supabase sync failed for permanentlyDelete, running in offline mode:", e));
  },
  
  async emptyRecycleBin() { 
      const d = await this.loadData(); 
      const itemsToDelete = [...d.deletedItems];
      d.deletedItems = []; 
      this.saveToLocalCache(); 

      const promises = itemsToDelete.map(item => 
          supabase.from('deleted_items').delete().eq('id', item.id)
      );
      Promise.all(promises)
         .catch(e => console.warn("Supabase sync failed for emptyRecycleBin, running in offline mode:", e));
  },
  
  async getRawData() { 
    return await this.loadData(); 
  },
  
  async importData(newData: any) { 
      cache = newData; 
      this.saveToLocalCache(); 
      window.location.reload(); 
  },
  
  async factoryReset() { 
      localStorage.clear(); 
      window.location.reload(); 
  },
  
  async forceSync() { 
      cache = null; 
      await this.loadData(); 
  },
  
  async getCloudBackups(): Promise<any[]> {
      return []; 
  },
  async createCloudBackup() {
  },
  async restoreCloudBackup(_fileId: string) {
  },

  // POS State
  savePOSDraft(d: any) { 
    localStorage.setItem('noor_pos_draft', JSON.stringify(d)); 
  },
  getPOSDraft() { 
    const d = localStorage.getItem('noor_pos_draft'); 
    return d ? JSON.parse(d) : null; 
  },
  clearPOSDraft() { 
    localStorage.removeItem('noor_pos_draft'); 
  },
  
  // Staff & Role Management
  async getStaffMembers(): Promise<any[]> {
    const uid = getUid();
    if (!uid || uid === 'guest') return [];
    try {
        const { data, error } = await supabase.from('staff').select('*').eq('user_id', uid);
        if (error) throw error;
        return (data ?? []).map(staffFromDb);
    } catch (error) {
        console.warn("Error getting staff members:", error);
        return [];
    }
  },

  async addStaffMember(staff: StaffRecord) {
    const uid = getUid();
    const session = (await supabase.auth.getSession()).data.session;
    const adminEmail = session?.user?.email || '';
    const staffDoc = { ...staff, userId: uid, adminEmail, createdAt: new Date().toISOString() };
    
    Promise.resolve(supabase.from('staff').upsert(staffToDb(staffDoc, uid)))
      .catch(e => console.warn("Supabase sync failed for addStaffMember:", e));
    return staffDoc;
  },

  async updateStaffMember(staffId: string, updates: Partial<StaffRecord>) {
    const uid = getUid();
    const d = await supabase.from('staff').select('*').eq('id', staffId).single();
    if (d.data) {
       const merged = { ...staffFromDb(d.data), ...updates };
       await Promise.resolve(supabase.from('staff').upsert(staffToDb(merged, uid)))
          .catch(e => console.warn("Supabase sync failed for updateStaffMember:", e));
    }
  },

  async deleteStaffMember(staffId: string) {
    await Promise.resolve(supabase.from('staff').delete().eq('id', staffId))
       .catch(e => console.warn("Supabase sync failed for deleteStaffMember:", e));
  },

  async loginStaff(adminEmailOrId: string, staffId: string, pin: string): Promise<{ staff: any; adminUid: string } | null> {
    try {
        const { data, error } = await supabase.from('staff')
          .select('*')
          .eq('id', staffId)
          .eq('pin', pin);
        
        if (error || !data || data.length === 0) {
            return null;
        }
        
        let docData = staffFromDb(data[0]);
        if (adminEmailOrId) {
            const cleanId = adminEmailOrId.trim().toLowerCase();
            const matchedRow = data.find(row => {
                const s = staffFromDb(row);
                const rUserId = row.user_id || '';
                const rAdminEmail = row.admin_email || '';
                return (rUserId.toLowerCase() === cleanId) || 
                       (rAdminEmail.toLowerCase() === cleanId) ||
                       (rUserId === adminEmailOrId.trim());
            });
            if (matchedRow) {
                docData = staffFromDb(matchedRow);
            } else {
                return null;
            }
        }
        
        const adminUid = (data[0] as any).user_id;
        return { staff: docData, adminUid };
    } catch (error) {
        console.warn("Staff login failed:", error);
        return null;
    }
  },

  // Product Action History
  async logProductHistory(productId: string, productName: string, action: 'create' | 'update' | 'delete', details: string, performedBy: string) {
    const uid = getUid();
    const historyId = generateId();
    const logEntry: ProductHistoryRecord = {
        id: historyId,
        productId,
        productName,
        action,
        details,
        timestamp: new Date().toISOString(),
        performedBy: performedBy || 'System'
    };
    Promise.resolve(supabase.from('product_history').upsert(productHistoryToDb(logEntry, uid)))
      .catch(e => console.warn("Supabase sync failed for logProductHistory:", e));
  },

  async getProductHistory(): Promise<any[]> {
    const uid = getUid();
    if (!uid || uid === 'guest') return [];
    try {
        const { data, error } = await supabase.from('product_history').select('*').eq('user_id', uid);
        if (error) throw error;
        const history = (data ?? []).map(productHistoryFromDb);
        return history.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
        console.warn("Error fetching product history:", error);
        return [];
    }
  },

  async logout() { 
    localStorage.clear(); 
    try {
        await supabase.auth.signOut();
    } catch (e) {
        console.warn("Sign-out failed:", e);
    }
  }
};

export { StoreService };
