/*
# Initial Schema for Noor POS

1. New Tables:
- `products` - Inventory items with user_id ownership
- `customers` - Customer CRM records with user_id ownership
- `sales` - Transaction records with user_id ownership
- `tags` - Category tags with user_id ownership
- `settings` - Store configuration with user_id ownership
- `deleted_items` - Recycle bin with user_id ownership
- `staff` - Staff members with user_id ownership
- `product_history` - Inventory audit log with user_id ownership

2. Security:
- RLS enabled on ALL tables
- Owner-scoped policies: Each authenticated user can only access their own rows
- All user_id columns DEFAULT to auth.uid() so inserts work without explicit ownership

3. Important Notes:
- All tables have user_id with DEFAULT auth.uid() - this is CRITICAL for RLS to work
- Policies follow SELECT/INSERT/UPDATE/DELETE pattern (not FOR ALL)
- `authentication` role is used for signed-in users
*/

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT DEFAULT '',
  stock INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  low_stock_threshold INTEGER DEFAULT 10,
  buy_price DECIMAL(10,2) DEFAULT 0,
  sell_price DECIMAL(10,2) DEFAULT 0,
  wholesale_price DECIMAL(10,2),
  tax_rate DECIMAL(5,2),
  expiry_date DATE,
  manufacturing_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  location TEXT,
  tag_id TEXT,
  category TEXT,
  capacity TEXT,
  size TEXT,
  color TEXT,
  brand TEXT,
  warranty TEXT,
  weight TEXT,
  supplier TEXT
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_products" ON products;
CREATE POLICY "select_own_products" ON products FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_products" ON products;
CREATE POLICY "insert_own_products" ON products FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_products" ON products;
CREATE POLICY "update_own_products" ON products FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_products" ON products;
CREATE POLICY "delete_own_products" ON products FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  location TEXT,
  total_spent DECIMAL(12,2) DEFAULT 0,
  total_dues DECIMAL(12,2) DEFAULT 0,
  visit_count INTEGER DEFAULT 0,
  history TEXT[] DEFAULT '{}',
  payments JSONB DEFAULT '[]',
  is_wholesaler BOOLEAN DEFAULT FALSE,
  pending_updates JSONB
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_customers" ON customers;
CREATE POLICY "select_own_customers" ON customers FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_customers" ON customers;
CREATE POLICY "insert_own_customers" ON customers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_customers" ON customers;
CREATE POLICY "update_own_customers" ON customers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_customers" ON customers;
CREATE POLICY "delete_own_customers" ON customers FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  items JSONB NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  tax DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  amount_paid DECIMAL(12,2),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  served_by TEXT,
  payment_method TEXT
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sales" ON sales;
CREATE POLICY "select_own_sales" ON sales FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_sales" ON sales;
CREATE POLICY "insert_own_sales" ON sales FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_sales" ON sales;
CREATE POLICY "update_own_sales" ON sales FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_sales" ON sales;
CREATE POLICY "delete_own_sales" ON sales FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6'
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tags" ON tags;
CREATE POLICY "select_own_tags" ON tags FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tags" ON tags;
CREATE POLICY "insert_own_tags" ON tags FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tags" ON tags;
CREATE POLICY "update_own_tags" ON tags FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tags" ON tags;
CREATE POLICY "delete_own_tags" ON tags FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT DEFAULT 'My Warehouse',
  store_address TEXT,
  store_phone TEXT,
  store_email TEXT,
  logo TEXT,
  warehouse_type TEXT DEFAULT 'general',
  warehouse_code TEXT,
  warehouse_manager TEXT,
  warehouse_capacity INTEGER,
  warehouse_zone TEXT,
  upi_id TEXT,
  expiry_alert_days INTEGER DEFAULT 7,
  low_stock_default INTEGER DEFAULT 10,
  sound_enabled BOOLEAN DEFAULT TRUE,
  notifications_enabled BOOLEAN DEFAULT FALSE,
  currency_symbol TEXT DEFAULT '₹',
  recycle_bin_retention_days INTEGER DEFAULT 30,
  direct_print_enabled BOOLEAN DEFAULT FALSE,
  scanner_preference TEXT DEFAULT 'both',
  nas_url TEXT,
  sync_to_nas BOOLEAN DEFAULT FALSE,
  sales_target DECIMAL(12,2) DEFAULT 50000,
  receipt_header TEXT,
  receipt_footer TEXT,
  show_logo_on_receipt BOOLEAN DEFAULT TRUE,
  tax_rate_default DECIMAL(5,2) DEFAULT 0
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_settings" ON settings;
CREATE POLICY "select_own_settings" ON settings FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_settings" ON settings;
CREATE POLICY "insert_own_settings" ON settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_settings" ON settings;
CREATE POLICY "update_own_settings" ON settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_settings" ON settings;
CREATE POLICY "delete_own_settings" ON settings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Deleted items (recycle bin)
CREATE TABLE IF NOT EXISTS deleted_items (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  original_id TEXT NOT NULL,
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE deleted_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_deleted_items" ON deleted_items;
CREATE POLICY "select_own_deleted_items" ON deleted_items FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_deleted_items" ON deleted_items;
CREATE POLICY "insert_own_deleted_items" ON deleted_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_deleted_items" ON deleted_items;
CREATE POLICY "update_own_deleted_items" ON deleted_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_deleted_items" ON deleted_items;
CREATE POLICY "delete_own_deleted_items" ON deleted_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Staff table
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  role TEXT NOT NULL,
  admin_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_staff" ON staff;
CREATE POLICY "select_own_staff" ON staff FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_staff" ON staff;
CREATE POLICY "insert_own_staff" ON staff FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_staff" ON staff;
CREATE POLICY "update_own_staff" ON staff FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_staff" ON staff;
CREATE POLICY "delete_own_staff" ON staff FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Product history table
CREATE TABLE IF NOT EXISTS product_history (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  performed_by TEXT
);

ALTER TABLE product_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_product_history" ON product_history;
CREATE POLICY "select_own_product_history" ON product_history FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_product_history" ON product_history;
CREATE POLICY "insert_own_product_history" ON product_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);
CREATE INDEX IF NOT EXISTS idx_deleted_items_user_id ON deleted_items(user_id);
CREATE INDEX IF NOT EXISTS idx_product_history_user_id ON product_history(user_id);