
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DO SUPABASE ---
// IMPORTANTE: Insira suas chaves aqui. 
// O app não funcionará na nuvem sem uma URL e Chave válidas.
const SUPABASE_URL = 'SUA_URL_DO_SUPABASE'; 
const SUPABASE_KEY = 'SUA_CHAVE_ANON_DO_SUPABASE';

// Função para validar se a URL é legítima antes de criar o cliente
const isValidUrl = (url: string) => {
    try {
        new URL(url);
        return url !== 'SUA_URL_DO_SUPABASE';
    } catch {
        return false;
    }
};

// Se a URL for inválida, criamos um cliente nulo ou lançamos erro controlado
export const supabase = isValidUrl(SUPABASE_URL) 
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

export const isSupabaseConfigured = !!supabase;
