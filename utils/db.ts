
import { supabase } from './supabaseClient';
import { PipeSegment, Annotation } from '../types';

// --- TIPOS ---
export interface ProjectData {
  id: string;
  name: string;
  updatedAt: string; // Supabase usa string ISO para datas
  pipes: PipeSegment[];
  annotations: Annotation[];
  location: string;
  client: string;
  secondaryImage: string | null;
  mapImage: string | null;
}

export interface UserData {
  username: string;
  password: string; // Em produção real, use Supabase Auth. Aqui mantemos simples conforme o app original.
  role: 'ADMIN' | 'USER';
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  createdAt: string;
}

// --- GERENCIAMENTO DE PROJETOS (CLOUD) ---

export const saveProjectToDB = async (project: any) => {
  // Converte data object para string ISO se necessário
  const payload = {
    ...project,
    updatedAt: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('projects')
    .upsert(payload, { onConflict: 'id' }) // Usa ID para decidir se cria ou atualiza
    .select();

  if (error) {
    console.error('Erro ao salvar projeto no Supabase:', error);
    throw error;
  }
  return data;
};

export const getAllProjects = async () => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updatedAt', { ascending: false });

  if (error) {
    console.error('Erro ao buscar projetos:', error);
    return [];
  }
  
  // Normalizar datas de volta para objetos Date se necessário no front, 
  // mas o app lida bem com strings ISO.
  return data as ProjectData[];
};

export const deleteProjectFromDB = async (id: string) => {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao deletar projeto:', error);
  }
};

// --- GERENCIAMENTO DE USUÁRIOS (CLOUD) ---

export const getAllUsers = async () => {
  const { data, error } = await supabase
    .from('app_users')
    .select('*');

  if (error) {
    console.error('Erro ao buscar usuários:', error);
    // Fallback para admin inicial se o banco estiver vazio ou der erro de conexão inicial
    return [{ 
      username: 'Marconi Fabian', 
      password: '2905', 
      role: 'ADMIN', 
      status: 'APPROVED', 
      createdAt: new Date().toISOString() 
    } as UserData];
  }
  return data as UserData[];
};

export const registerUserDB = async (user: UserData) => {
  const { data, error } = await supabase
    .from('app_users')
    .insert([user])
    .select();

  if (error) throw error;
  return data;
};

export const updateUserStatusDB = async (username: string, status: 'APPROVED' | 'REJECTED') => {
  const { data, error } = await supabase
    .from('app_users')
    .update({ status })
    .eq('username', username)
    .select();

  if (error) throw error;
  return data;
};

export const deleteUserDB = async (username: string) => {
  const { error } = await supabase
    .from('app_users')
    .delete()
    .eq('username', username);
    
  if (error) throw error;
};
