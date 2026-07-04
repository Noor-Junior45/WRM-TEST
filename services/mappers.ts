import { Product, Customer, Sale, Tag, StoreSettings, DeletedItem } from '../types';

// Generic helper types for staff & product history (not in types.ts but used
// internally by storeService.ts)
export interface StaffRecord {
  id: string;
  name: string;
  pin: string;
  role: 'pos' | 'inventory';
  adminEmail?: string;
  createdAt?: string;
}

export interface ProductHistoryRecord {
  id: string;
  productId: string;
  productName: string;
  action: 'create' | 'update' | 'delete';
  details: string;
  timestamp: string;
  performedBy: string;
}

// ---------- PRODUCT ----------
export function productToDb(p: Product, userId: string) {
  return {
    id: p.id,
    user_id: userId,
    name: p.name,
    sku: p.sku,
    stock: p.stock,
    unit: p.unit,
    low_stock_threshold: p.lowStockThreshold,
    buy_price: p.buyPrice,
    sell_price: p.sellPrice,
    wholesale_price: p.wholesalePrice,
    tax_rate: p.taxRate,
    expiry_date: p.expiryDate || null,
    manufacturing_date: p.manufacturingDate || null,
    created_at: p.createdAt,
    location: p.location,
    tag_id: p.tagId,
    category: p.category,
    capacity: p.capacity,
    size: p.size,
    color: p.color,
    brand: p.brand,
    warranty: p.warranty,
    weight: p.weight,
    supplier: p.supplier,
  };
}

export function productFromDb(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    stock: row.stock,
    unit: row.unit,
    lowStockThreshold: row.low_stock_threshold,
    buyPrice: row.buy_price,
    sellPrice: row.sell_price,
    wholesalePrice: row.wholesale_price,
    taxRate: row.tax_rate,
    expiryDate: row.expiry_date,
    manufacturingDate: row.manufacturing_date,
    createdAt: row.created_at,
    location: row.location,
    tagId: row.tag_id,
    category: row.category,
    capacity: row.capacity,
    size: row.size,
    color: row.color,
    brand: row.brand,
    warranty: row.warranty,
    weight: row.weight,
    supplier: row.supplier,
  };
}

// ---------- CUSTOMER ----------
export function customerToDb(c: Customer, userId: string) {
  return {
    id: c.id,
    user_id: userId,
    name: c.name,
    phone: c.phone,
    email: c.email,
    location: c.location,
    total_spent: c.totalSpent,
    total_dues: c.totalDues,
    visit_count: c.visitCount,
    history: c.history ?? [],
    payments: c.payments ?? [],
    is_wholesaler: c.isWholesaler ?? false,
    pending_updates: c.pendingUpdates ?? null,
  };
}

export function customerFromDb(row: any): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    location: row.location,
    totalSpent: row.total_spent,
    totalDues: row.total_dues,
    visitCount: row.visit_count,
    history: row.history ?? [],
    payments: row.payments ?? [],
    isWholesaler: row.is_wholesaler,
    pendingUpdates: row.pending_updates ?? undefined,
  };
}

// ---------- SALE ----------
export function saleToDb(s: Sale, userId: string) {
  return {
    id: s.id,
    user_id: userId,
    customer_id: s.customerId ?? null,
    customer_name: s.customerName,
    items: s.items,
    subtotal: s.subtotal,
    tax: s.tax,
    total: s.total,
    amount_paid: s.amountPaid,
    timestamp: s.timestamp,
    served_by: s.servedBy,
    payment_method: s.paymentMethod,
  };
}

export function saleFromDb(row: any): Sale {
  return {
    id: row.id,
    customerId: row.customer_id ?? undefined,
    customerName: row.customer_name,
    items: row.items ?? [],
    subtotal: row.subtotal,
    tax: row.tax,
    total: row.total,
    amountPaid: row.amount_paid,
    timestamp: row.timestamp,
    servedBy: row.served_by,
    paymentMethod: row.payment_method,
  };
}

// ---------- TAG ----------
export function tagToDb(t: Tag, userId: string) {
  return { id: t.id, user_id: userId, name: t.name, color: t.color };
}

export function tagFromDb(row: any): Tag {
  return { id: row.id, name: row.name, color: row.color };
}

// ---------- SETTINGS ----------
export function settingsToDb(s: StoreSettings & { id: string }, userId: string) {
  return {
    id: s.id,
    user_id: userId,
    store_name: s.storeName,
    store_address: s.storeAddress,
    store_phone: s.storePhone,
    store_email: s.storeEmail,
    logo: s.logo,
    warehouse_type: s.warehouseType,
    warehouse_code: s.warehouseCode,
    warehouse_manager: s.warehouseManager,
    warehouse_capacity: s.warehouseCapacity,
    warehouse_zone: s.warehouseZone,
    upi_id: s.upiId,
    expiry_alert_days: s.expiryAlertDays,
    low_stock_default: s.lowStockDefault,
    sound_enabled: s.soundEnabled,
    notifications_enabled: s.notificationsEnabled,
    currency_symbol: s.currencySymbol,
    recycle_bin_retention_days: s.recycleBinRetentionDays,
    direct_print_enabled: s.directPrintEnabled,
    scanner_preference: s.scannerPreference,
    nas_url: s.nasUrl,
    sync_to_nas: s.syncToNas,
    sales_target: s.salesTarget,
    receipt_header: s.receiptHeader,
    receipt_footer: s.receiptFooter,
    show_logo_on_receipt: s.showLogoOnReceipt,
    tax_rate_default: s.taxRateDefault,
  };
}

export function settingsFromDb(row: any): StoreSettings & { id: string } {
  return {
    id: row.id,
    storeName: row.store_name,
    storeAddress: row.store_address,
    storePhone: row.store_phone,
    storeEmail: row.store_email,
    logo: row.logo,
    warehouseType: row.warehouse_type,
    warehouseCode: row.warehouse_code,
    warehouseManager: row.warehouse_manager,
    warehouseCapacity: row.warehouse_capacity,
    warehouseZone: row.warehouse_zone,
    upiId: row.upi_id,
    expiryAlertDays: row.expiry_alert_days,
    lowStockDefault: row.low_stock_default,
    soundEnabled: row.sound_enabled,
    notificationsEnabled: row.notifications_enabled,
    currencySymbol: row.currency_symbol,
    recycleBinRetentionDays: row.recycle_bin_retention_days,
    directPrintEnabled: row.direct_print_enabled,
    scannerPreference: row.scanner_preference,
    nasUrl: row.nas_url,
    syncToNas: row.sync_to_nas,
    salesTarget: row.sales_target,
    receiptHeader: row.receipt_header,
    receiptFooter: row.receipt_footer,
    showLogoOnReceipt: row.show_logo_on_receipt,
    taxRateDefault: row.tax_rate_default,
  };
}

// ---------- DELETED ITEM ----------
export function deletedItemToDb(d: DeletedItem, userId: string) {
  return {
    id: d.id,
    user_id: userId,
    original_id: d.originalId,
    type: d.type,
    data: d.data,
    deleted_at: d.deletedAt,
  };
}

export function deletedItemFromDb(row: any): DeletedItem {
  return {
    id: row.id,
    originalId: row.original_id,
    type: row.type,
    data: row.data,
    deletedAt: row.deleted_at,
  };
}

// ---------- STAFF ----------
export function staffToDb(s: StaffRecord, userId: string) {
  return {
    id: s.id,
    user_id: userId,
    name: s.name,
    pin: s.pin,
    role: s.role,
    admin_email: s.adminEmail,
    created_at: s.createdAt,
  };
}

export function staffFromDb(row: any): StaffRecord {
  return {
    id: row.id,
    name: row.name,
    pin: row.pin,
    role: row.role,
    adminEmail: row.admin_email,
    createdAt: row.created_at,
  };
}

// ---------- PRODUCT HISTORY ----------
export function productHistoryToDb(h: ProductHistoryRecord, userId: string) {
  return {
    id: h.id,
    user_id: userId,
    product_id: h.productId,
    product_name: h.productName,
    action: h.action,
    details: h.details,
    timestamp: h.timestamp,
    performed_by: h.performedBy,
  };
}

export function productHistoryFromDb(row: any): ProductHistoryRecord {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    action: row.action,
    details: row.details,
    timestamp: row.timestamp,
    performedBy: row.performed_by,
  };
}
