
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { PipeSegment, Annotation } from '../types';

// --- FALLBACK LOCAL STORAGE ---
const saveLocal = (key: string, data: any) => localStorage.setItem(`iso_local_${key}`, JSON.stringify(data));
const getLocal = (key: string) => {
    const d = localStorage.getItem(`iso_local_${key}`);
    return d ? JSON.parse(d) : null;
};

// --- PROJETOS ---
export const saveProjectToDB = async (project: any) => {
  if (!isSupabaseConfigured || !supabase) {
      const localProjects = getLocal('projects') || [];
      const index = localProjects.findIndex((p: any) => p.id === project.id);
      if (index >= 0) localProjects[index] = project;
      else localProjects.push(project);
      saveLocal('projects', localProjects);
      return project;
  }
  const { data, error } = await supabase
    .from('projects')
    .upsert({ ...project, updatedAt: new Date().toISOString() })
    .select();
  if (error) throw error;
  return data;
};

export const getAllProjects = async () => {
  if (!isSupabaseConfigured || !supabase) {
      return getLocal('projects') || [];
  }
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updatedAt', { ascending: false });
  if (error) return getLocal('projects') || [];
  return data;
};

export const deleteProjectFromDB = async (id: string) => {
  if (!isSupabaseConfigured || !supabase) {
      const local = getLocal('projects') || [];
      saveLocal('projects', local.filter((p:any) => p.id !== id));
      return;
  }
  await supabase.from('projects').delete().eq('id', id);
};

// --- USUÁRIOS ---
export const getAllUsers = async () => {
  const defaultAdmin = { username: 'Marconi Fabian', password: '2905', role: 'ADMIN', status: 'APPROVED', createdAt: new Date().toISOString() };
  
  if (!isSupabaseConfigured || !supabase) {
      const localUsers = getLocal('users') || [defaultAdmin];
      return localUsers;
  }

  const { data, error } = await supabase.from('app_users').select('*');
  if (error) return [defaultAdmin];
  return data.length > 0 ? data : [defaultAdmin];
};

export const registerUserDB = async (user: any) => {
  if (!isSupabaseConfigured || !supabase) {
      const local = getLocal('users') || [];
      local.push(user);
      saveLocal('users', local);
      return;
  }
  await supabase.from('app_users').insert([user]);
};
