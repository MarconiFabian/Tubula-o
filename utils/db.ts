
import { supabase } from './supabaseClient';
import { PipeSegment, Annotation } from '../types';

export interface ProjectData {
  id: string;
  name: string;
  updatedAt: string;
  pipes: PipeSegment[];
  annotations: Annotation[];
  location: string;
  client: string;
  secondaryImage: string | null;
  mapImage: string | null;
}

export interface UserData {
  username: string;
  password: string;
  role: 'ADMIN' | 'USER';
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  createdAt: string;
}

// --- PROJETOS ---
export const saveProjectToDB = async (project: any) => {
  const { data, error } = await supabase
    .from('projects')
    .upsert({ ...project, updatedAt: new Date().toISOString() })
    .select();
  if (error) throw error;
  return data;
};

export const getAllProjects = async () => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updatedAt', { ascending: false });
  if (error) return [];
  return data as ProjectData[];
};

export const deleteProjectFromDB = async (id: string) => {
  await supabase.from('projects').delete().eq('id', id);
};

// --- USUÁRIOS ---
export const getAllUsers = async () => {
  const { data, error } = await supabase.from('app_users').select('*');
  if (error) return [{ username: 'Marconi Fabian', password: '2905', role: 'ADMIN', status: 'APPROVED', createdAt: new Date().toISOString() }];
  return data as UserData[];
};

export const registerUserDB = async (user: UserData) => {
  const { error } = await supabase.from('app_users').insert([user]);
  if (error) throw error;
};

export const updateUserStatusDB = async (username: string, status: string) => {
  await supabase.from('app_users').update({ status }).eq('username', username);
};

export const deleteUserDB = async (username: string) => {
  await supabase.from('app_users').delete().eq('username', username);
};
