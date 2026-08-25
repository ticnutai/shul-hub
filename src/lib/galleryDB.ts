/**
 * IndexedDB storage for screenshot gallery.
 * Replaces localStorage which is limited to ~5MB.
 * IndexedDB supports hundreds of MB to GB.
 */

const DB_NAME = 'screenshot-tool';
const DB_VERSION = 1;
const STORE_NAME = 'gallery';

export interface GalleryItem {
  id: number;
  dataUrl: string;
  label: string;
  timestamp: number;
  pinned: boolean;
  favorite: boolean;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadGallery(): Promise<GalleryItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      tx.oncomplete = () => db.close();
      tx.onabort = () => {
        db.close();
        reject(tx.error ?? new Error('IndexedDB read transaction aborted'));
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('IndexedDB read transaction failed'));
      };
      req.onsuccess = () => {
        const items = (req.result as GalleryItem[]).sort((a, b) => b.timestamp - a.timestamp);
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveGalleryItem(item: GalleryItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(item);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB write transaction aborted'));
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB write transaction failed'));
    };
  });
}

export async function deleteGalleryItem(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB delete transaction aborted'));
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB delete transaction failed'));
    };
  });
}

export async function clearGalleryDB(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB clear transaction aborted'));
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB clear transaction failed'));
    };
  });
}

export async function updateGalleryItem(id: number, updates: Partial<GalleryItem>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB update transaction aborted'));
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB update transaction failed'));
    };
    getReq.onsuccess = () => {
      if (getReq.result) {
        store.put({ ...getReq.result, ...updates });
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/** Migrate existing localStorage gallery to IndexedDB (one-time) */
export async function migrateFromLocalStorage(): Promise<GalleryItem[]> {
  const LS_KEY = 'screenshot-tool-gallery';
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return [];
  try {
    const items: GalleryItem[] = JSON.parse(raw);
    if (!Array.isArray(items) || items.length === 0) return [];
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const item of items) {
      store.put(item);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error ?? new Error('IndexedDB migration transaction aborted'));
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('IndexedDB migration transaction failed'));
      };
    });
    localStorage.removeItem(LS_KEY);
    return items;
  } catch {
    localStorage.removeItem(LS_KEY);
    return [];
  }
}
