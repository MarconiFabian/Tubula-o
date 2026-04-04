
import { openDB, DBSchema } from 'idb';
import { PipeSegment, Annotation, DailyProduction, ProjectCalendar } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

export interface ProjectData {
  id: string;
  name: string;
  updatedAt: Date | Timestamp;
  pipes: PipeSegment[];
  annotations: Annotation[];
  location: string;
  client: string;
  secondaryImage: string | null;
  mapImage: string | null;
  userId?: string;
  dailyProduction?: DailyProduction[];
  activityDate?: string;
  deadlineDate?: string | null;
  projectCalendar?: ProjectCalendar | null;
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

export const saveProjectToDB = async (project: ProjectData, userId?: string) => {
  // 1. Save to Local IndexedDB (Cache)
  try {
    const localDB = await initDB();
    await localDB.put(STORE_NAME, {
      ...project,
      updatedAt: project.updatedAt instanceof Date ? project.updatedAt : new Date()
    });
  } catch (err) {
    console.warn('Failed to save to local IndexedDB:', err);
  }

  // 2. Save to Firestore (Primary)
  const effectiveUserId = userId || auth.currentUser?.uid || 'marconi-default';
  const path = `projects/${project.id}`;
  try {
    const firestoreData = {
      ...project,
      userId: effectiveUserId,
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, 'projects', project.id), firestoreData);
  } catch (error) {
    console.error('Firestore Error saving project:', error);
    // handleFirestoreError(error, OperationType.WRITE, path); // Desativado para evitar crash se não logado
  }

  return project;
};

export const getAllProjects = async (userId?: string) => {
  let projects: ProjectData[] = [];
  const effectiveUserId = userId || auth.currentUser?.uid || 'marconi-default';

  // 1. Try to get from Firestore
  const path = 'projects';
  try {
    const q = query(collection(db, 'projects'), where('userId', '==', effectiveUserId));
    const querySnapshot = await getDocs(q);
    projects = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt)
      } as ProjectData;
    });

    // Update local cache with Firestore data
    try {
      const localDB = await initDB();
      for (const proj of projects) {
        await localDB.put(STORE_NAME, proj);
      }
    } catch (err) {
      console.warn('Failed to update local cache:', err);
    }
  } catch (error) {
    console.error('Firestore Error fetching projects:', error);
    // Fallback to local if Firestore fails
  }

  // 2. If no projects from Firestore, get from local IndexedDB
  if (projects.length === 0) {
    try {
      const localDB = await initDB();
      projects = await localDB.getAllFromIndex(STORE_NAME, 'by-date');
    } catch (err) {
      console.error('Failed to fetch from local IndexedDB:', err);
    }
  }

  return projects;
};

export const getProjectById = async (id: string) => {
  // 1. Try Firestore
  const path = `projects/${id}`;
  try {
    const docSnap = await getDoc(doc(db, 'projects', id));
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ...data,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt)
      } as ProjectData;
    }
  } catch (error) {
    console.error('Firestore Error fetching project by ID:', error);
  }

  // 2. Fallback to local
  try {
    const localDB = await initDB();
    return await localDB.get(STORE_NAME, id);
  } catch (err) {
    console.error('Failed to fetch project by ID from local IndexedDB:', err);
    return undefined;
  }
};

export const deleteProjectFromDB = async (id: string) => {
  // 1. Delete from local
  try {
    const localDB = await initDB();
    await localDB.delete(STORE_NAME, id);
  } catch (err) {
    console.warn('Failed to delete from local IndexedDB:', err);
  }

  // 2. Delete from Firestore
  const path = `projects/${id}`;
  try {
    await deleteDoc(doc(db, 'projects', id));
  } catch (error) {
    console.error('Firestore Error deleting project:', error);
  }
};
