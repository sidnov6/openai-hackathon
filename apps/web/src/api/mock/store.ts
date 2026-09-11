/**
 * Persistence for the mock adapter.
 *
 * The acceptance checks require the tenancy journey - tasks, dates, evidence - to
 * survive a page refresh. With no server, that means the browser: JSON state in
 * localStorage, and evidence binaries in IndexedDB (localStorage would blow its quota
 * on photos). Evidence is read back through an authorised-looking accessor and served
 * as a revocable object URL, matching how the live adapter fetches private files.
 */

const STATE_KEY = 'mainhaus.mock.state.v1'
const DB_NAME = 'mainhaus-mock-evidence'
const STORE = 'files'

export function loadState<T>(fallback: T): T {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (!raw) return fallback
    return { ...fallback, ...(JSON.parse(raw) as object) } as T
  } catch {
    return fallback
  }
}

export function saveState(state: unknown): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    // Private mode / quota. The session keeps working in memory; only refresh is lost.
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STATE_KEY)
  } catch {
    /* no-op */
  }
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, 1)
    } catch {
      return resolve(null)
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
}

export async function putBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(blob, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
    tx.onabort = () => resolve()
  })
  db.close()
}

export async function getBlob(key: string): Promise<Blob | null> {
  const db = await openDb()
  if (!db) return null
  const blob = await new Promise<Blob | null>((resolve) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null)
    req.onerror = () => resolve(null)
  })
  db.close()
  return blob
}

export async function deleteBlobsWithPrefix(prefix: string): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.getAllKeys()
    req.onsuccess = () => {
      for (const key of req.result as IDBValidKey[]) {
        if (typeof key === 'string' && key.startsWith(prefix)) store.delete(key)
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
    tx.onabort = () => resolve()
  })
  db.close()
}
