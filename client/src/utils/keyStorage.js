/**
 * Secure key storage using IndexedDB
 * Private keys are NEVER sent to the server
 */

const DB_NAME = 'E2EEKeyStore';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

let db = null;

/**
 * Initialize IndexedDB
 */
export function initKeyStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('username', 'username', { unique: false });
      }
    };
  });
}

/**
 * Store private key securely
 */
export async function storePrivateKey(username, privateKey, keyAlgorithm, keySize) {
  if (!db) {
    await initKeyStore();
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const keyData = {
      id: username,
      username: username,
      privateKey: privateKey,
      keyAlgorithm: keyAlgorithm,
      keySize: keySize,
      createdAt: new Date().toISOString()
    };

    const request = store.put(keyData);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error('Failed to store private key'));
    };
  });
}

/**
 * Retrieve private key
 */
export async function getPrivateKey(username) {
  if (!db) {
    await initKeyStore();
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(username);

    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result);
      } else {
        reject(new Error('Private key not found'));
      }
    };

    request.onerror = () => {
      reject(new Error('Failed to retrieve private key'));
    };
  });
}

/**
 * Check if private key exists
 */
export async function hasPrivateKey(username) {
  try {
    await getPrivateKey(username);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete private key (for logout/account deletion)
 */
export async function deletePrivateKey(username) {
  if (!db) {
    await initKeyStore();
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(username);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error('Failed to delete private key'));
    };
  });
}

/**
 * Clear all keys (for testing/debugging)
 */
export async function clearAllKeys() {
  if (!db) {
    await initKeyStore();
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error('Failed to clear keys'));
    };
  });
}

