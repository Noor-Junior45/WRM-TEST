import { Product, Sale, Customer, Tag, StoreSettings, User, DeletedItem } from '../types';
import { db, auth, storage } from './firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  writeBatch 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';

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
  warehouseType: 'general', // Default warehouse type
  upiId: '', // Default merchant UPI ID
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

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const getUid = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    return localStorage.getItem('noor_user_uid') || 'guest';
  }
  return uid;
};

const StoreService = {
  getLastBackupTime() { 
    return localStorage.getItem('noor_last_sync') || new Date().toISOString(); 
  },

  saveToLocalCache() {
    if (cache) {
      localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(cache));
      localStorage.setItem('noor_last_sync', new Date().toISOString());
      // Back up to the local Node.js server storage so public invoices can be generated immediately
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
            const [productsSnap, salesSnap, customersSnap, tagsSnap, settingsSnap, deletedSnap] = await Promise.all([
                getDocs(query(collection(db, 'products'), where('userId', '==', uid))).catch(e => handleFirestoreError(e, OperationType.LIST, 'products')),
                getDocs(query(collection(db, 'sales'), where('userId', '==', uid))).catch(e => handleFirestoreError(e, OperationType.LIST, 'sales')),
                getDocs(query(collection(db, 'customers'), where('userId', '==', uid))).catch(e => handleFirestoreError(e, OperationType.LIST, 'customers')),
                getDocs(query(collection(db, 'tags'), where('userId', '==', uid))).catch(e => handleFirestoreError(e, OperationType.LIST, 'tags')),
                getDocs(query(collection(db, 'settings'), where('userId', '==', uid))).catch(e => handleFirestoreError(e, OperationType.LIST, 'settings')),
                getDocs(query(collection(db, 'deletedItems'), where('userId', '==', uid))).catch(e => handleFirestoreError(e, OperationType.LIST, 'deletedItems'))
            ]);

            const products = productsSnap ? productsSnap.docs.map(d => d.data() as Product) : [];
            const sales = salesSnap ? salesSnap.docs.map(d => d.data() as Sale) : [];
            const customers = customersSnap ? customersSnap.docs.map(d => d.data() as Customer) : [];
            const tags = tagsSnap ? tagsSnap.docs.map(d => d.data() as Tag) : [];
            const deletedItems = deletedSnap ? deletedSnap.docs.map(d => d.data() as DeletedItem) : [];
            
            let settings = defaultSettings;
            if (settingsSnap && !settingsSnap.empty) {
                settings = { ...defaultSettings, ...settingsSnap.docs[0].data() as StoreSettings };
            } else {
                const settingsId = generateId();
                const initialSettings = { ...defaultSettings, userId: uid, id: settingsId };
                await setDoc(doc(db, 'settings', settingsId), initialSettings).catch(e => handleFirestoreError(e, OperationType.WRITE, `settings/${settingsId}`));
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
            console.warn("Firestore fetch failed, using local cache fallback", err);
            const local = localStorage.getItem(LS_BACKUP_KEY);
            cache = local ? { ...defaultData, ...JSON.parse(local) } : JSON.parse(JSON.stringify(defaultData));
            resolve(cache as StoreData);
        }
    });
    
    return loadPromise.then((d) => { loadPromise = null; return d; });
  },

  async saveData(): Promise<void> {
    // Firestore writes are made eagerly in modifications, so saveData() acts to update cache locally
    this.saveToLocalCache();
  },

  // Cloud Storage File Uploader
  async uploadFile(fileOrBase64: File | string, folder: string): Promise<string> {
    const uid = getUid();
    const filename = `${uid}_${Date.now()}_${generateId().substring(0, 8)}`;
    const fileRef = ref(storage, `${folder}/${filename}`);
    
    if (typeof fileOrBase64 === 'string') {
      const base64Data = fileOrBase64.replace(/^data:.+;base64,/, '');
      const mimeMatch = fileOrBase64.match(/^data:(.+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      await uploadString(fileRef, base64Data, 'base64', { contentType: mimeType }).catch(e => handleFirestoreError(e, OperationType.WRITE, `${folder}/${filename}`));
    } else {
      await uploadBytes(fileRef, fileOrBase64).catch(e => handleFirestoreError(e, OperationType.WRITE, `${folder}/${filename}`));
    }
    
    return await getDownloadURL(fileRef);
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
      this.logProductHistory(np.id, np.name, 'create', `Created product with initial stock: ${np.stock} and price: $${np.price}`, performer);

      // Trigger Firestore sync in the background
      setDoc(doc(db, 'products', np.id), np)
        .catch(e => console.error("Firestore sync failed for addProduct:", e));

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
        if (updates.price !== undefined) detailParts.push(`Price: $${updates.price}`);
        if (updates.name !== undefined) detailParts.push(`Name changed to: "${updates.name}"`);
        const details = detailParts.length > 0 ? `Updated fields: ${detailParts.join(', ')}` : 'Updated details';
        this.logProductHistory(id, updated.name, 'update', details, performer);

        // Trigger Firestore sync in the background
        setDoc(doc(db, 'products', id), updated)
          .catch(e => console.error("Firestore sync failed for updateProduct:", e));
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

          // Trigger Firestore sync in the background
          Promise.all([
            setDoc(doc(db, 'deletedItems', delItem.id), { ...delItem, userId: uid }),
            deleteDoc(doc(db, 'products', id))
          ]).catch(e => console.error("Firestore sync failed for deleteProduct:", e));
      }
  },
  
  async batchAddProducts(items: Partial<Product>[]) {
      const d = await this.loadData();
      const uid = getUid();
      const now = new Date().toISOString();
      const batch = writeBatch(db);
      
      items.forEach(i => {
         const id = i.id || generateId();
         const np = { ...i, id, createdAt: now, userId: uid } as Product;
         d.products.push(np);
         batch.set(doc(db, 'products', id), np);
      });
      
      this.saveToLocalCache();

      // Commit the batch in the background
      batch.commit().catch(e => console.error("Firestore sync failed for batchAddProducts:", e));
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
      
      await setDoc(doc(db, 'sales', ns.id), ns).catch(e => handleFirestoreError(e, OperationType.WRITE, `sales/${ns.id}`));
      d.sales.push(ns); 
      
      // Update inventory stock
      const batch = writeBatch(db);
      s.items.forEach((item: any) => {
          const p = d.products.find(x => x.id === item.id);
          if (p) {
              p.stock = Math.max(0, p.stock - item.quantity);
              batch.update(doc(db, 'products', p.id), { stock: p.stock });
          }
      });
      
      // Update customer stats
      if (s.customerId) {
          const c = d.customers.find(x => x.id === s.customerId);
          if (c) {
              c.totalSpent += s.total;
              c.visitCount += 1;
              c.totalDues += (s.total - (s.amountPaid || 0));
              if (!c.history) c.history = [];
              c.history.push(ns.id);
              batch.update(doc(db, 'customers', c.id), { 
                totalSpent: c.totalSpent, 
                visitCount: c.visitCount, 
                totalDues: c.totalDues, 
                history: c.history 
              });
          }
      }
      
      await batch.commit().catch(e => handleFirestoreError(e, OperationType.WRITE, 'batch/sale_updates'));
      this.saveToLocalCache(); 
      return ns; 
  },
  
  async deleteSales(ids: string[]) {
      const d = await this.loadData();
      const uid = getUid();
      const batch = writeBatch(db);
      
      ids.forEach(id => {
          const i = d.sales.findIndex(x => x.id === id);
          if (i > -1) {
              const [s] = d.sales.splice(i, 1);
              const delItem: DeletedItem = { id: generateId(), originalId: s.id, type: 'sale', data: s, deletedAt: new Date().toISOString() };
              
              d.deletedItems.push(delItem);
              batch.set(doc(db, 'deletedItems', delItem.id), { ...delItem, userId: uid });
              batch.delete(doc(db, 'sales', id));
          }
      });
      
      await batch.commit().catch(e => handleFirestoreError(e, OperationType.WRITE, 'batch/delete_sales'));
      this.saveToLocalCache();
  },
  
  async updateSale(sale: Sale) {
      const d = await this.loadData();
      const i = d.sales.findIndex(s => s.id === sale.id);
      if (i > -1) { 
        d.sales[i] = sale; 
        await setDoc(doc(db, 'sales', sale.id), sale).catch(e => handleFirestoreError(e, OperationType.WRITE, `sales/${sale.id}`));
        this.saveToLocalCache(); 
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
      
      await setDoc(doc(db, 'customers', updatedCustomer.id), updatedCustomer).catch(e => handleFirestoreError(e, OperationType.WRITE, `customers/${updatedCustomer.id}`));
      this.saveToLocalCache();
      return updatedCustomer;
  },
  
  async deleteCustomer(id: string) {
      const d = await this.loadData();
      const i = d.customers.findIndex(x => x.id === id);
      if (i > -1) {
          const [c] = d.customers.splice(i, 1);
          const uid = getUid();
          const delItem: DeletedItem = { id: generateId(), originalId: c.id, type: 'customer', data: c, deletedAt: new Date().toISOString() };
          
          await Promise.all([
            setDoc(doc(db, 'deletedItems', delItem.id), { ...delItem, userId: uid }).catch(e => handleFirestoreError(e, OperationType.WRITE, `deletedItems/${delItem.id}`)),
            deleteDoc(doc(db, 'customers', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `customers/${id}`))
          ]);

          d.deletedItems.push(delItem);
          this.saveToLocalCache();
      }
  },
  
  async addCustomerPayment(cid: string, amt: number, method: string, note: string, date: string, receipt?: string) {
      const d = await this.loadData();
      const c = d.customers.find(x => x.id === cid);
      if (c) {
          if (!c.payments) c.payments = [];
          
          let receiptUrl = receipt;
          if (receipt && receipt.startsWith('data:')) {
             // Upload base64 receipt to Cloud Storage
             receiptUrl = await this.uploadFile(receipt, 'receipts');
          }
          
          c.payments.push({ id: generateId(), amount: amt, method, note, date, receiptImage: receiptUrl });
          c.totalDues = Math.max(0, c.totalDues - amt);
          
          await setDoc(doc(db, 'customers', c.id), c).catch(e => handleFirestoreError(e, OperationType.WRITE, `customers/${c.id}`));
          this.saveToLocalCache();
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
         logoUrl = await this.uploadFile(s.logo, 'logos');
      }
      
      const updatedSettings = { ...s, logo: logoUrl, userId: uid };
      d.settings = updatedSettings; 
      
      // Save settings to Firestore
      const settingsId = s.id || generateId();
      await setDoc(doc(db, 'settings', settingsId), { ...updatedSettings, id: settingsId }).catch(e => handleFirestoreError(e, OperationType.WRITE, `settings/${settingsId}`));
      this.saveToLocalCache(); 
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

      // Sync to Firestore in background
      setDoc(doc(db, 'tags', nt.id), nt)
        .catch(e => console.error("Firestore sync failed for addTag:", e));

      return nt; 
  },
  
  async updateTag(id: string, u: Partial<Tag>) {
      const d = await this.loadData();
      const i = d.tags.findIndex(x => x.id === id);
      if (i > -1) { 
        const updated = { ...d.tags[i], ...u };
        d.tags[i] = updated; 
        this.saveToLocalCache(); 

        // Sync to Firestore in background
        setDoc(doc(db, 'tags', id), updated)
          .catch(e => console.error("Firestore sync failed for updateTag:", e));
      }
  },
  
  async deleteTag(id: string) {
      const d = await this.loadData();
      const i = d.tags.findIndex(x => x.id === id);
      if (i > -1) { 
        d.tags.splice(i, 1); 
        this.saveToLocalCache(); 

        // Sync to Firestore in background
        deleteDoc(doc(db, 'tags', id))
          .catch(e => console.error("Firestore sync failed for deleteTag:", e));
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
          const batch = writeBatch(db);
          
          if (item.type === 'product') {
             d.products.push(item.data);
             batch.set(doc(db, 'products', item.data.id), { ...item.data, userId: uid });
          } else if (item.type === 'customer') {
             d.customers.push(item.data);
             batch.set(doc(db, 'customers', item.data.id), { ...item.data, userId: uid });
          } else if (item.type === 'sale') {
             d.sales.push(item.data);
             batch.set(doc(db, 'sales', item.data.id), { ...item.data, userId: uid });
          }
          
          batch.delete(doc(db, 'deletedItems', id));
          await batch.commit().catch(e => handleFirestoreError(e, OperationType.WRITE, `batch/restore/${id}`));
          this.saveToLocalCache();
      }
  },
  
  async permanentlyDelete(id: string) {
      const d = await this.loadData();
      d.deletedItems = d.deletedItems.filter(x => x.id !== id);
      await deleteDoc(doc(db, 'deletedItems', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `deletedItems/${id}`));
      this.saveToLocalCache();
  },
  
  async emptyRecycleBin() { 
      const d = await this.loadData(); 
      const batch = writeBatch(db);
      
      d.deletedItems.forEach(item => {
         batch.delete(doc(db, 'deletedItems', item.id));
      });
      
      d.deletedItems = []; 
      await batch.commit().catch(e => handleFirestoreError(e, OperationType.DELETE, 'batch/empty_recycle'));
      this.saveToLocalCache(); 
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
      return []; // Replaced by standard real-time Firestore synchronization
  },
  async createCloudBackup() {
      // Replaced by standard real-time Firestore synchronization
  },
  async restoreCloudBackup(fileId: string) {
      // Replaced by standard real-time Firestore synchronization
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
        const snap = await getDocs(query(collection(db, 'staff'), where('userId', '==', uid)));
        return snap.docs.map(d => d.data());
    } catch (error) {
        console.warn("Error getting staff members:", error);
        return [];
    }
  },

  async addStaffMember(staff: { id: string; name: string; pin: string; role: 'pos' | 'inventory' }) {
    const uid = getUid();
    const adminEmail = auth.currentUser?.email || '';
    const staffDoc = { ...staff, userId: uid, adminEmail, createdAt: new Date().toISOString() };
    await setDoc(doc(db, 'staff', staff.id), staffDoc).catch(e => handleFirestoreError(e, OperationType.WRITE, `staff/${staff.id}`));
    return staffDoc;
  },

  async updateStaffMember(staffId: string, updates: Partial<{ name: string; pin: string; role: 'pos' | 'inventory' }>) {
    await updateDoc(doc(db, 'staff', staffId), updates).catch(e => handleFirestoreError(e, OperationType.WRITE, `staff/${staffId}`));
  },

  async deleteStaffMember(staffId: string) {
    await deleteDoc(doc(db, 'staff', staffId)).catch(e => handleFirestoreError(e, OperationType.DELETE, `staff/${staffId}`));
  },

  async loginStaff(adminEmailOrId: string, staffId: string, pin: string): Promise<{ staff: any; adminUid: string } | null> {
    try {
        const q = query(
          collection(db, 'staff'), 
          where('id', '==', staffId), 
          where('pin', '==', pin)
        );
        const snap = await getDocs(q);
        if (snap.empty) {
            return null;
        }
        
        // Find the staff doc that belongs to this admin's DB (if adminEmailOrId is provided, we can verify)
        let docData = snap.docs[0].data();
        if (adminEmailOrId) {
            const cleanId = adminEmailOrId.trim().toLowerCase();
            const matchedDoc = snap.docs.find(d => {
                const s = d.data();
                return (s.userId && s.userId.toLowerCase() === cleanId) || 
                       (s.adminEmail && s.adminEmail.toLowerCase() === cleanId) ||
                       (s.userId === adminEmailOrId.trim());
            });
            if (matchedDoc) {
                docData = matchedDoc.data();
            } else {
                return null;
            }
        }
        
        const adminUid = docData.userId;
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
    const logEntry = {
        id: historyId,
        productId,
        productName,
        action,
        details,
        timestamp: new Date().toISOString(),
        userId: uid,
        performedBy: performedBy || 'System'
    };
    setDoc(doc(db, 'productHistory', historyId), logEntry)
      .catch(e => console.warn("Firestore sync failed for logProductHistory:", e));
  },

  async getProductHistory(): Promise<any[]> {
    const uid = getUid();
    if (!uid || uid === 'guest') return [];
    try {
        const snap = await getDocs(query(collection(db, 'productHistory'), where('userId', '==', uid)));
        const history = snap.docs.map(d => d.data());
        return history.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
        console.warn("Error fetching product history:", error);
        return [];
    }
  },

  async logout() { 
    localStorage.clear(); 
    try {
        await auth.signOut();
    } catch (e) {
        console.warn("Sign-out failed:", e);
    }
  }
};

export { StoreService };
