import { createClient } from '@supabase/supabase-js';

// Use a more robust way to get env variables
const getEnv = (key: string): string => {
  try {
    return import.meta.env[key] || '';
  } catch {
    return '';
  }
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = () => {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  
  // Basic validation to ensure it's a valid URL structure
  try {
    const url = new URL(supabaseUrl);
    return (url.protocol === 'http:' || url.protocol === 'https:') && supabaseAnonKey.length > 0;
  } catch {
    return false;
  }
};

// Only initialize if both are present to avoid "supabaseUrl is required" error
const initializeSupabase = () => {
  if (!isSupabaseConfigured()) return null;
  
  try {
    return createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
};

export const supabase = initializeSupabase();

if (!isSupabaseConfigured()) {
  console.warn('Supabase is not configured. Cloud sync will be disabled. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.');
}
