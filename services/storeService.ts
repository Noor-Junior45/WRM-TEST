import { Product, Sale, Customer, Tag, StoreSettings, User, DeletedItem } from '../types';
import { supabase } from './firebase';

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

const getUid = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || localStorage.getItem('noor_user_uid') || 'guest';
};

const saveToLocalCache = () => {
  if (cache) {
    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(cache));
    localStorage.setItem('noor_last_sync', new Date().toISOString());
  }
};

const StoreService = {
  getLastBackupTime() {
    return localStorage.getItem('noor_last_sync') || new Date().toISOString();
  },

  saveToLocalCache() {
    saveToLocalCache();
  },

  async loadData(): Promise<StoreData> {
    if (cache) return cache;
    if (loadPromise) return loadPromise;

    loadPromise = new Promise(async (resolve) => {
      const uid = await getUid();
      if (!uid || uid === 'guest') {
        const local = localStorage.getItem(LS_BACKUP_KEY);
        cache = local ? { ...defaultData, ...JSON.parse(local) } : JSON.parse(JSON.stringify(defaultData));
        resolve(cache as StoreData);
        return;
      }

      try {
        const [productsRes, salesRes, customersRes, tagsRes, settingsRes, deletedRes] = await Promise.all([
          supabase.from('products').select('*'),
          supabase.from('sales').select('*'),
          supabase.from('customers').select('*'),
          supabase.from('tags').select('*'),
          supabase.from('settings').select('*').maybeSingle(),
          supabase.from('deleted_items').select('*')
        ]);

        const products = (productsRes.data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          sku: p.sku || '',
          stock: p.stock,
          unit: p.unit || 'pcs',
          lowStockThreshold: p.low_stock_threshold || 10,
          buyPrice: Number(p.buy_price) || 0,
          sellPrice: Number(p.sell_price) || 0,
          wholesalePrice: Number(p.wholesale_price) || 0,
          taxRate: Number(p.tax_rate) || 0,
          expiryDate: p.expiry_date || undefined,
          manufacturingDate: p.manufacturing_date || undefined,
          createdAt: p.created_at || undefined,
          location: p.location || '',
          tagId: p.tag_id || undefined,
          category: p.category || '',
          capacity: p.capacity || '',
          size: p.size || '',
          color: p.color || '',
          brand: p.brand || '',
          material: p.material || '',
          warrantyPeriod: p.warranty_period || '',
          serialNumber: p.serial_number || '',
          batchNumber: p.batch_number || '',
          dosageForm: p.dosage_form || '',
          manufacturer: p.manufacturer || '',
          warehouseType: p.warehouse_type || ''
        }));

        const sales = (salesRes.data || []).map((s: any) => ({
          id: s.id,
          customerId: s.customer_id || undefined,
          customerName: s.customer_name,
          subtotal: Number(s.subtotal) || 0,
          tax: Number(s.tax) || 0,
          total: Number(s.total) || 0,
          amountPaid: Number(s.amount_paid) || 0,
          timestamp: s.created_at,
          servedBy: s.served_by || '',
          paymentMethod: s.payment_method || 'Cash',
          items: s.items || []
        }));

        const customers = (customersRes.data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email || '',
          location: c.location || '',
          totalSpent: Number(c.total_spent) || 0,
          totalDues: Number(c.total_dues) || 0,
          visitCount: c.visit_count || 0,
          isWholesaler: c.is_wholesaler || false,
          history: c.history || [],
          pendingUpdates: c.pending_updates || undefined,
          payments: []
        }));

        for (const customer of customers) {
          const { data: payments } = await supabase
            .from('payments')
            .select('*')
            .eq('customer_id', customer.id);
          customer.payments = (payments || []).map((p: any) => ({
            id: p.id,
            amount: Number(p.amount) || 0,
            method: p.method,
            note: p.note || '',
            date: p.date,
            receiptImage: p.receipt_image || ''
          }));
        }

        const tags = (tagsRes.data || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          color: t.color
        }));

        const deletedItems = (deletedRes.data || []).map((d: any) => ({
          id: d.id,
          originalId: d.original_id,
          type: d.item_type as 'product' | 'customer' | 'sale' | 'tag',
          data: d.item_data,
          deletedAt: d.deleted_at
        }));

        let settings = defaultSettings;
        if (settingsRes.data) {
          const s = settingsRes.data;
          settings = {
            storeName: s.store_name || 'My Warehouse',
            storeAddress: s.store_address || '',
            storePhone: s.store_phone || '',
            storeEmail: s.store_email || '',
            logo: s.logo || '',
            warehouseType: s.warehouse_type || 'general',
            warehouseCode: s.warehouse_code || '',
            warehouseManager: s.warehouse_manager || '',
            warehouseCapacity: s.warehouse_capacity || undefined,
            warehouseZone: s.warehouse_zone || '',
            upiId: s.upi_id || '',
            expiryAlertDays: s.expiry_alert_days || 7,
            lowStockDefault: s.low_stock_default || 10,
            soundEnabled: s.sound_enabled ?? true,
            notificationsEnabled: s.notifications_enabled ?? false,
            currencySymbol: s.currency_symbol || '₹',
            recycleBinRetentionDays: s.recycle_bin_retention_days || 30,
            directPrintEnabled: s.direct_print_enabled ?? false,
            scannerPreference: s.scanner_preference || 'both',
            nasUrl: s.nas_url || '',
            syncToNas: s.sync_to_nas ?? false,
            salesTarget: Number(s.sales_target) || 50000,
            receiptHeader: s.receipt_header || '',
            receiptFooter: s.receipt_footer || '',
            showLogoOnReceipt: s.show_logo_on_receipt ?? true,
            taxRateDefault: Number(s.tax_rate_default) || 18
          };
        }

        cache = { products, tags, sales, customers, deletedItems, users: [], settings };
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
    saveToLocalCache();
  },

  async uploadFile(fileOrBase64: File | string, folder: string): Promise<string> {
    const uid = await getUid();
    const filename = `${folder}/${uid}_${Date.now()}_${generateId().substring(0, 8)}.jpg`;

    if (typeof fileOrBase64 === 'string') {
      const base64Data = fileOrBase64.replace(/^data:.+;base64,/, '');
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      const { error } = await supabase.storage.from('store-files').upload(filename, blob, {
        contentType: 'image/jpeg',
        upsert: true
      });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from('store-files').getPublicUrl(filename);
      return urlData.publicUrl;
    } else {
      const { error } = await supabase.storage.from('store-files').upload(filename, fileOrBase64, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('store-files').getPublicUrl(filename);
      return urlData.publicUrl;
    }
  },

  async getInventory() {
    const d = await this.loadData();
    return d.products;
  },

  async addProduct(p: Product) {
    const d = await this.loadData();
    const np = { ...p, id: p.id || generateId(), createdAt: new Date().toISOString() };
    d.products.push(np);
    saveToLocalCache();

    const performer = localStorage.getItem('noor_user_name') || 'Admin';
    this.logProductHistory(np.id, np.name, 'create', `Created product with initial stock: ${np.stock} and price: ₹${np.sellPrice}`, performer);

    const { error } = await supabase.from('products').insert({
      id: np.id,
      name: np.name,
      sku: np.sku || '',
      stock: np.stock,
      unit: np.unit || 'pcs',
      low_stock_threshold: np.lowStockThreshold || 10,
      buy_price: np.buyPrice || 0,
      sell_price: np.sellPrice,
      wholesale_price: np.wholesalePrice || 0,
      tax_rate: np.taxRate || 0,
      expiry_date: np.expiryDate || null,
      manufacturing_date: np.manufacturingDate || null,
      location: np.location || '',
      tag_id: np.tagId || null,
      category: np.category || '',
      size: np.size || '',
      color: np.color || '',
      brand: np.brand || '',
      warehouse_type: np.warehouseType || ''
    });

    if (error) console.error("Supabase insert failed for addProduct:", error);
    return np;
  },

  async updateProduct(id: string, updates: Partial<Product>) {
    const d = await this.loadData();
    const i = d.products.findIndex(x => x.id === id);
    if (i > -1) {
      const updated = { ...d.products[i], ...updates };
      d.products[i] = updated;
      saveToLocalCache();

      const performer = localStorage.getItem('noor_user_name') || 'Admin';
      const detailParts = [];
      if (updates.stock !== undefined) detailParts.push(`Stock: ${updates.stock}`);
      if (updates.sellPrice !== undefined) detailParts.push(`Price: ₹${updates.sellPrice}`);
      const details = detailParts.length > 0 ? `Updated fields: ${detailParts.join(', ')}` : 'Updated details';
      this.logProductHistory(id, updated.name, 'update', details, performer);

      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.stock !== undefined) updateData.stock = updates.stock;
      if (updates.sellPrice !== undefined) updateData.sell_price = updates.sellPrice;
      if (updates.buyPrice !== undefined) updateData.buy_price = updates.buyPrice;
      if (updates.expiryDate !== undefined) updateData.expiry_date = updates.expiryDate || null;

      const { error } = await supabase.from('products').update(updateData).eq('id', id);
      if (error) console.error("Supabase update failed for updateProduct:", error);
    }
  },

  async deleteProduct(id: string) {
    const d = await this.loadData();
    const i = d.products.findIndex(x => x.id === id);
    if (i > -1) {
      const [p] = d.products.splice(i, 1);
      const delItem: DeletedItem = { id: generateId(), originalId: p.id, type: 'product', data: p, deletedAt: new Date().toISOString() };
      d.deletedItems.push(delItem);
      saveToLocalCache();

      const performer = localStorage.getItem('noor_user_name') || 'Admin';
      this.logProductHistory(p.id, p.name, 'delete', `Deleted product from warehouse`, performer);

      await Promise.all([
        supabase.from('deleted_items').insert({
          id: delItem.id,
          original_id: delItem.originalId,
          item_type: delItem.type,
          item_data: delItem.data
        }),
        supabase.from('products').delete().eq('id', id)
      ]);
    }
  },

  async batchAddProducts(items: Partial<Product>[]) {
    const d = await this.loadData();
    const now = new Date().toISOString();

    const insertData = items.map(i => {
      const id = i.id || generateId();
      d.products.push({ ...i, id, createdAt: now } as Product);
      return {
        id,
        name: i.name || '',
        sku: i.sku || '',
        stock: i.stock || 0,
        unit: i.unit || 'pcs',
        low_stock_threshold: i.lowStockThreshold || 10,
        buy_price: i.buyPrice || 0,
        sell_price: i.sellPrice || 0,
        category: i.category || ''
      };
    });

    saveToLocalCache();
    const { error } = await supabase.from('products').insert(insertData);
    if (error) console.error("Supabase batch insert failed:", error);
  },

  async getSales() {
    const d = await this.loadData();
    return d.sales;
  },

  async createSale(s: any) {
    const d = await this.loadData();
    const ns = { ...s, id: generateId(), timestamp: new Date().toISOString() };
    d.sales.push(ns);

    s.items.forEach((item: any) => {
      const p = d.products.find(x => x.id === item.id);
      if (p) p.stock = Math.max(0, p.stock - item.quantity);
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

    saveToLocalCache();

    const { error: saleError } = await supabase.from('sales').insert({
      id: ns.id,
      customer_id: ns.customerId || null,
      customer_name: ns.customerName,
      subtotal: ns.subtotal,
      tax: ns.tax || 0,
      total: ns.total,
      amount_paid: ns.amountPaid || 0,
      payment_method: ns.paymentMethod || 'Cash',
      items: ns.items
    });

    if (saleError) console.error("Supabase insert failed for createSale:", saleError);

    for (const item of s.items) {
      const p = d.products.find(x => x.id === item.id);
      if (p) await supabase.from('products').update({ stock: p.stock }).eq('id', item.id);
    }

    if (s.customerId) {
      const c = d.customers.find(x => x.id === s.customerId);
      if (c) {
        await supabase.from('customers').update({
          total_spent: c.totalSpent,
          visit_count: c.visitCount,
          total_dues: c.totalDues,
          history: c.history
        }).eq('id', s.customerId);
      }
    }

    return ns;
  },

  async deleteSales(ids: string[]) {
    const d = await this.loadData();
    const deletedSalesList: DeletedItem[] = [];

    for (const id of ids) {
      const i = d.sales.findIndex(x => x.id === id);
      if (i > -1) {
        const [s] = d.sales.splice(i, 1);
        const delItem: DeletedItem = { id: generateId(), originalId: s.id, type: 'sale', data: s, deletedAt: new Date().toISOString() };
        d.deletedItems.push(delItem);
        deletedSalesList.push(delItem);
      }
    }

    saveToLocalCache();

    for (const delItem of deletedSalesList) {
      await Promise.all([
        supabase.from('deleted_items').insert({
          id: delItem.id,
          original_id: delItem.originalId,
          item_type: delItem.type,
          item_data: delItem.data
        }),
        supabase.from('sales').delete().eq('id', delItem.originalId)
      ]);
    }
  },

  async updateSale(sale: Sale) {
    const d = await this.loadData();
    const i = d.sales.findIndex(s => s.id === sale.id);
    if (i > -1) {
      d.sales[i] = sale;
      saveToLocalCache();

      const { error } = await supabase.from('sales').update({
        customer_id: sale.customerId || null,
        customer_name: sale.customerName,
        subtotal: sale.subtotal,
        tax: sale.tax,
        total: sale.total,
        amount_paid: sale.amountPaid || 0,
        items: sale.items
      }).eq('id', sale.id);

      if (error) console.error("Supabase update failed for updateSale:", error);
    }
  },

  async getCustomers() {
    const d = await this.loadData();
    return d.customers;
  },

  async upsertCustomer(c: Partial<Customer>) {
    const d = await this.loadData();
    const nc = { ...c, id: c.id || generateId() } as Customer;

    const i = d.customers.findIndex(x => x.id === nc.id);
    let updatedCustomer = nc;
    if (i > -1) {
      updatedCustomer = { ...d.customers[i], ...nc };
      d.customers[i] = updatedCustomer;
    } else {
      d.customers.push(updatedCustomer);
    }

    saveToLocalCache();

    const { error } = await supabase.from('customers').upsert({
      id: updatedCustomer.id,
      name: updatedCustomer.name,
      phone: updatedCustomer.phone,
      email: updatedCustomer.email || '',
      location: updatedCustomer.location || '',
      total_spent: updatedCustomer.totalSpent || 0,
      total_dues: updatedCustomer.totalDues || 0,
      visit_count: updatedCustomer.visitCount || 0,
      is_wholesaler: updatedCustomer.isWholesaler || false
    });

    if (error) console.error("Supabase upsert failed for upsertCustomer:", error);
    return updatedCustomer;
  },

  async deleteCustomer(id: string) {
    const d = await this.loadData();
    const i = d.customers.findIndex(x => x.id === id);
    if (i > -1) {
      const [c] = d.customers.splice(i, 1);
      const delItem: DeletedItem = { id: generateId(), originalId: c.id, type: 'customer', data: c, deletedAt: new Date().toISOString() };
      d.deletedItems.push(delItem);
      saveToLocalCache();

      await Promise.all([
        supabase.from('deleted_items').insert({
          id: delItem.id,
          original_id: delItem.originalId,
          item_type: delItem.type,
          item_data: delItem.data
        }),
        supabase.from('customers').delete().eq('id', id)
      ]);
    }
  },

  async addCustomerPayment(cid: string, amt: number, method: string, note: string, date: string, receipt?: string) {
    const d = await this.loadData();
    const c = d.customers.find(x => x.id === cid);
    if (c) {
      if (!c.payments) c.payments = [];

      let receiptUrl = receipt;
      if (receipt && receipt.startsWith('data:')) {
        try { receiptUrl = await this.uploadFile(receipt, 'receipts'); } catch (err) { console.warn("Upload failed:", err); }
      }

      const paymentId = generateId();
      c.payments.push({ id: paymentId, amount: amt, method, note, date, receiptImage: receiptUrl });
      c.totalDues = Math.max(0, c.totalDues - amt);
      saveToLocalCache();

      await Promise.all([
        supabase.from('payments').insert({
          id: paymentId, customer_id: cid, amount: amt, method, note, date, receipt_image: receiptUrl || ''
        }),
        supabase.from('customers').update({ total_dues: c.totalDues }).eq('id', cid)
      ]);
    }
  },

  async getSettings() {
    const d = await this.loadData();
    return d.settings;
  },

  async saveSettings(s: StoreSettings) {
    const d = await this.loadData();
    let logoUrl = s.logo;
    if (s.logo && s.logo.startsWith('data:')) {
      try { logoUrl = await this.uploadFile(s.logo, 'logos'); } catch (err) { console.warn("Upload failed:", err); }
    }

    const updatedSettings = { ...s, logo: logoUrl };
    d.settings = updatedSettings;
    saveToLocalCache();

    const settingsId = s.id || generateId();
    const { error } = await supabase.from('settings').upsert({
      id: settingsId,
      store_name: updatedSettings.storeName,
      store_address: updatedSettings.storeAddress || '',
      store_phone: updatedSettings.storePhone || '',
      store_email: updatedSettings.storeEmail || '',
      logo: updatedSettings.logo || '',
      warehouse_type: updatedSettings.warehouseType || 'general',
      upi_id: updatedSettings.upiId || '',
      expiry_alert_days: updatedSettings.expiryAlertDays || 7,
      low_stock_default: updatedSettings.lowStockDefault || 10,
      currency_symbol: updatedSettings.currencySymbol || '₹'
    });

    if (error) console.error("Supabase upsert failed for saveSettings:", error);
  },

  async getTags() {
    const d = await this.loadData();
    return d.tags;
  },

  async addTag(t: Tag) {
    const d = await this.loadData();
    const nt = { ...t, id: t.id || generateId() };
    d.tags.push(nt);
    saveToLocalCache();

    const { error } = await supabase.from('tags').insert({ id: nt.id, name: nt.name, color: nt.color });
    if (error) console.error("Supabase insert failed for addTag:", error);
    return nt;
  },

  async updateTag(id: string, u: Partial<Tag>) {
    const d = await this.loadData();
    const i = d.tags.findIndex(x => x.id === id);
    if (i > -1) {
      d.tags[i] = { ...d.tags[i], ...u };
      saveToLocalCache();
      const { error } = await supabase.from('tags').update(u).eq('id', id);
      if (error) console.error("Supabase update failed for updateTag:", error);
    }
  },

  async deleteTag(id: string) {
    const d = await this.loadData();
    d.tags = d.tags.filter(x => x.id !== id);
    saveToLocalCache();
    const { error } = await supabase.from('tags').delete().eq('id', id);
    if (error) console.error("Supabase delete failed for deleteTag:", error);
  },

  async getDeletedItems() {
    const d = await this.loadData();
    return d.deletedItems;
  },

  async restoreItem(id: string) {
    const d = await this.loadData();
    const i = d.deletedItems.findIndex(x => x.id === id);
    if (i > -1) {
      const item = d.deletedItems.splice(i, 1)[0];

      if (item.type === 'product') {
        d.products.push(item.data);
      } else if (item.type === 'customer') {
        d.customers.push(item.data);
      } else if (item.type === 'sale') {
        d.sales.push(item.data);
      }

      saveToLocalCache();
      await supabase.from('deleted_items').delete().eq('id', id);
    }
  },

  async permanentlyDelete(id: string) {
    const d = await this.loadData();
    d.deletedItems = d.deletedItems.filter(x => x.id !== id);
    saveToLocalCache();
    await supabase.from('deleted_items').delete().eq('id', id);
  },

  async emptyRecycleBin() {
    const d = await this.loadData();
    d.deletedItems = [];
    saveToLocalCache();
    const uid = await getUid();
    await supabase.from('deleted_items').delete().eq('user_id', uid);
  },

  async getRawData() { return await this.loadData(); },

  async importData(newData: any) {
    cache = newData;
    saveToLocalCache();
    window.location.reload();
  },

  async factoryReset() {
    localStorage.clear();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await Promise.all([
        supabase.from('products').delete().eq('user_id', user.id),
        supabase.from('sales').delete().eq('user_id', user.id),
        supabase.from('customers').delete().eq('user_id', user.id),
        supabase.from('tags').delete().eq('user_id', user.id),
        supabase.from('deleted_items').delete().eq('user_id', user.id),
        supabase.from('settings').delete().eq('user_id', user.id)
      ]);
    }
    window.location.reload();
  },

  async forceSync() {
    cache = null;
    await this.loadData();
  },

  async getCloudBackups(): Promise<any[]> { return []; },
  async createCloudBackup() {},
  async restoreCloudBackup() {},

  savePOSDraft(d: any) { localStorage.setItem('noor_pos_draft', JSON.stringify(d)); },
  getPOSDraft() {
    const d = localStorage.getItem('noor_pos_draft');
    return d ? JSON.parse(d) : null;
  },
  clearPOSDraft() { localStorage.removeItem('noor_pos_draft'); },

  async getStaffMembers(): Promise<any[]> {
    const { data, error } = await supabase.from('staff').select('*');
    if (error) { console.warn("Error getting staff:", error); return []; }
    return data || [];
  },

  async addStaffMember(staff: { id: string; name: string; pin: string; role: 'pos' | 'inventory' }) {
    const { data: { user } } = await supabase.auth.getUser();
    const adminEmail = user?.email || '';
    const { error } = await supabase.from('staff').insert({
      id: staff.id, name: staff.name, pin: staff.pin, role: staff.role, admin_email: adminEmail
    });
    if (error) console.error("Supabase insert failed for addStaffMember:", error);
    return { ...staff, adminEmail };
  },

  async updateStaffMember(staffId: string, updates: Partial<{ name: string; pin: string; role: 'pos' | 'inventory' }>) {
    const { error } = await supabase.from('staff').update(updates).eq('id', staffId);
    if (error) console.error("Supabase update failed for updateStaffMember:", error);
  },

  async deleteStaffMember(staffId: string) {
    const { error } = await supabase.from('staff').delete().eq('id', staffId);
    if (error) console.error("Supabase delete failed for deleteStaffMember:", error);
  },

  async loginStaff(adminEmailOrId: string, staffId: string, pin: string): Promise<{ staff: any; adminUid: string } | null> {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('id', staffId)
        .eq('pin', pin)
        .maybeSingle();

      if (!data) return null;

      const cleanId = adminEmailOrId.trim().toLowerCase();
      if ((data.admin_email || '').toLowerCase() === cleanId || data.user_id === adminEmailOrId.trim()) {
        return { staff: data, adminUid: data.user_id };
      }
      return null;
    } catch (error) {
      console.warn("Staff login failed:", error);
      return null;
    }
  },

  async logProductHistory(productId: string, productName: string, action: 'create' | 'update' | 'delete', details: string, performedBy: string) {
    const { error } = await supabase.from('product_history').insert({
      id: generateId(), product_id: productId, product_name: productName, action, details, performed_by: performedBy || 'System'
    });
    if (error) console.error("Supabase insert failed for logProductHistory:", error);
  },

  async getProductHistory(): Promise<any[]> {
    const { data, error } = await supabase.from('product_history').select('*').order('created_at', { ascending: false });
    if (error) { console.warn("Error fetching history:", error); return []; }
    return (data || []).map(h => ({
      id: h.id, productId: h.product_id, productName: h.product_name, action: h.action, details: h.details, timestamp: h.created_at, performedBy: h.performed_by
    }));
  },

  async logout() {
    localStorage.clear();
    cache = null;
    await supabase.auth.signOut();
  }
};

export { StoreService };
