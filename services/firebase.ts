import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create client - will use empty strings if env vars missing, which Supabase will handle
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Export as legacy names for backward compatibility
export const auth = supabase.auth;
export const db = supabase;
export const storage = supabase.storage;

export default supabase;
