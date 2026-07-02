/*
# Noor POS Schema - Multi-user with Owner-Scoped RLS

1. New Tables: tags, products, customers, payments, sales, settings, deleted_items, staff, product_history
2. Security: RLS enabled, owner-scoped CRUD policies (auth.uid() = user_id)
3. user_id columns DEFAULT auth.uid() so inserts without user_id still pass RLS
*/

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6'
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

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text DEFAULT '',
  stock integer NOT NULL DEFAULT 0,
  unit text DEFAULT 'pcs',
  low_stock_threshold integer DEFAULT 10,
  buy_price numeric(12,2) DEFAULT 0,
  sell_price numeric(12,2) NOT NULL DEFAULT 0,
  wholesale_price numeric(12,2) DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 0,
  expiry_date date,
  manufacturing_date date,
  created_at timestamptz DEFAULT now(),
  location text,
  tag_id uuid REFERENCES tags(id) ON DELETE SET NULL,
  category text,
  capacity text,
  size text,
  color text,
  brand text,
  material text,
  warranty_period text,
  serial_number text,
  batch_number text,
  dosage_form text,
  manufacturer text,
  warehouse_type text
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

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  location text,
  total_spent numeric(12,2) DEFAULT 0,
  total_dues numeric(12,2) DEFAULT 0,
  visit_count integer DEFAULT 0,
  is_wholesaler boolean DEFAULT false,
  history text[] DEFAULT '{}',
  pending_updates jsonb
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

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  method text NOT NULL,
  note text,
  date timestamptz DEFAULT now(),
  receipt_image text
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_payments" ON payments;
CREATE POLICY "select_own_payments" ON payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_payments" ON payments;
CREATE POLICY "insert_own_payments" ON payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  subtotal numeric(12,2) NOT NULL,
  tax numeric(12,2) DEFAULT 0,
  total numeric(12,2) NOT NULL,
  amount_paid numeric(12,2) DEFAULT 0,
  payment_method text DEFAULT 'Cash',
  served_by text,
  created_at timestamptz DEFAULT now(),
  items jsonb NOT NULL DEFAULT '[]'
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

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  store_name text DEFAULT 'My Warehouse',
  store_address text,
  store_phone text,
  store_email text,
  logo text,
  warehouse_type text DEFAULT 'general',
  upi_id text,
  expiry_alert_days integer DEFAULT 7,
  low_stock_default integer DEFAULT 10,
  sound_enabled boolean DEFAULT true,
  notifications_enabled boolean DEFAULT false,
  currency_symbol text DEFAULT '₹',
  recycle_bin_retention_days integer DEFAULT 30,
  direct_print_enabled boolean DEFAULT false,
  scanner_preference text DEFAULT 'both',
  sales_target numeric(12,2) DEFAULT 50000,
  tax_rate_default numeric(5,2) DEFAULT 18,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_settings" ON settings;
CREATE POLICY "select_own_settings" ON settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_settings" ON settings;
CREATE POLICY "insert_own_settings" ON settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_settings" ON settings;
CREATE POLICY "update_own_settings" ON settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS deleted_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  original_id uuid NOT NULL,
  item_type text NOT NULL,
  item_data jsonb NOT NULL,
  deleted_at timestamptz DEFAULT now()
);
ALTER TABLE deleted_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_deleted_items" ON deleted_items;
CREATE POLICY "select_own_deleted_items" ON deleted_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_deleted_items" ON deleted_items;
CREATE POLICY "insert_own_deleted_items" ON deleted_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_deleted_items" ON deleted_items;
CREATE POLICY "delete_own_deleted_items" ON deleted_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS staff (
  id text PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  pin text NOT NULL,
  role text NOT NULL DEFAULT 'pos',
  admin_email text,
  created_at timestamptz DEFAULT now()
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

CREATE TABLE IF NOT EXISTS product_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  product_name text NOT NULL,
  action text NOT NULL,
  details text,
  performed_by text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE product_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_product_history" ON product_history;
CREATE POLICY "select_own_product_history" ON product_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_product_history" ON product_history;
CREATE POLICY "insert_own_product_history" ON product_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);
CREATE INDEX IF NOT EXISTS idx_deleted_items_user_id ON deleted_items(user_id);