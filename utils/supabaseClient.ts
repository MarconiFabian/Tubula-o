
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DO SUPABASE ---
// Substitua pelas suas chaves reais no painel do Supabase.
const SUPABASE_URL = 'SUA_URL_DO_SUPABASE'; 
const SUPABASE_KEY = 'SUA_CHAVE_ANON_DO_SUPABASE';

const isConfigValid = () => {
  try {
    return (
      SUPABASE_URL && 
      SUPABASE_URL.startsWith('https://') && 
      SUPABASE_URL !== 'SUA_URL_DO_SUPABASE' &&
      SUPABASE_KEY !== 'SUA_CHAVE_ANON_DO_SUPABASE'
    );
  } catch (e) {
    return false;
  }
};

export const supabase = isConfigValid() 
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

export const isSupabaseConfigured = !!supabase;
