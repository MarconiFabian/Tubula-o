import { openDB, DBSchema } from 'idb';
import { PipeSegment, Annotation } from '../types';

interface ProjectData {
  id: string;
  name: string;
  updatedAt: Date;
  pipes: PipeSegment[];
  annotations: Annotation[];
  location: string;
  secondaryImage: string | null;
  mapImage: string | null;
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
  return project;
};

export const getAllProjects = async () => {
  const db = await initDB();
  return db.getAllFromIndex(STORE_NAME, 'by-date');
};

export const getProjectById = async (id: string) => {
  const db = await initDB();
  return db.get(STORE_NAME, id);
};

export const deleteProjectFromDB = async (id: string) => {
  const db = await initDB();
  await db.delete(STORE_NAME, id);
};
