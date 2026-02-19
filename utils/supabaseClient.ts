
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DO SUPABASE ---
// VOCÊ PRECISA COLOCAR SUAS CREDENCIAIS AQUI PARA O SISTEMA FUNCIONAR NA NUVEM
const SUPABASE_URL = 'https://xyzcompany.supabase.co'; // Substitua pela URL do seu projeto
const SUPABASE_KEY = 'eyJxh...'; // Substitua pela sua API Key (anon public)

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
