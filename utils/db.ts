
import { openDB, DBSchema } from 'idb';
import { PipeSegment, Annotation } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface ProjectData {
  id: string;
  name: string;
  updatedAt: Date;
  pipes: PipeSegment[];
  annotations: Annotation[];
  location: string;
  client: string;
  secondaryImage: string | null;
  mapImage: string | null;
  userId?: string; // Adicionado para controle de usuário
}

interface IsometricoDB extends DBSchema {
  projects: {
    key: string;
    value: ProjectData;
    indexes: { 'by-date': Date };
  };
}

const DB_NAME = 'isometrico-manager-db';
const STORE_NAME = 'projects';

export const initDB = async () => {
  return openDB<IsometricoDB>(DB_NAME, 1, {
    upgrade(db) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('by-date', 'updatedAt');
    },
  });
};

export const saveProjectToDB = async (project: ProjectData) => {
  const db = await initDB();
  await db.put(STORE_NAME, project);

  // Sincronizar com Supabase se configurado
  if (isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase
        .from('projects')
        .upsert({
          id: project.id,
          name: project.name,
          updated_at: project.updatedAt,
          data: project, // Salvamos o objeto completo em uma coluna JSONB
          user_id: project.userId
        });
      if (error) console.error('Erro ao sincronizar com Supabase:', error);
    } catch (err) {
      console.error('Falha na conexão com Supabase:', err);
    }
  }

  return project;
};

export const getAllProjects = async (userId?: string) => {
  const db = await initDB();
  let localProjects = await db.getAllFromIndex(STORE_NAME, 'by-date');

  // Sincronizar do Supabase se configurado
  if (isSupabaseConfigured() && supabase) {
    try {
      const query = supabase.from('projects').select('*');
      if (userId) query.eq('user_id', userId);
      
      const { data, error } = await query;
      
      if (!error && data) {
        // Mesclar dados remotos com locais (Supabase vence se for mais recente)
        for (const remote of data) {
          const remoteProject = remote.data as ProjectData;
          const local = localProjects.find(p => p.id === remote.id);
          
          if (!local || new Date(remote.updated_at) > new Date(local.updatedAt)) {
            await db.put(STORE_NAME, remoteProject);
          }
        }
        // Atualizar lista local após mesclagem
        localProjects = await db.getAllFromIndex(STORE_NAME, 'by-date');
      }
    } catch (err) {
      console.error('Falha ao buscar do Supabase:', err);
    }
  }

  return localProjects;
};

export const getProjectById = async (id: string) => {
  const db = await initDB();
  return db.get(STORE_NAME, id);
};

export const deleteProjectFromDB = async (id: string) => {
  const db = await initDB();
  await db.delete(STORE_NAME, id);

  // Deletar do Supabase se configurado
  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.from('projects').delete().eq('id', id);
    } catch (err) {
      console.error('Erro ao deletar do Supabase:', err);
    }
  }
};
