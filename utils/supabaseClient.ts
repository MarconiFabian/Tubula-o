
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DO SUPABASE ---
// Insira suas chaves aqui para ativar o modo Cloud.
// Se deixar como está, o app funcionará apenas no seu navegador atual (Modo Local).
const SUPABASE_URL = 'SUA_URL_DO_SUPABASE'; 
const SUPABASE_KEY = 'SUA_CHAVE_ANON_DO_SUPABASE';

const isConfigValid = () => {
    return SUPABASE_URL && 
           SUPABASE_URL.startsWith('https://') && 
           SUPABASE_URL !== 'SUA_URL_DO_SUPABASE';
};

export const supabase = isConfigValid() 
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

export const isSupabaseConfigured = !!supabase;
