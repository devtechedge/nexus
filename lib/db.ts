export interface TelemetryLog {
  timestamp: number;
  sequence: number;
  hardware: {
    cpuUsage: number;
    memoryUsage: number;
    diskIo: number;
    networkIn: number;
    networkOut: number;
    temperature: number;
  };
  market: {
    BTC: number;
    ETH: number;
    SOL: number;
    AAPL: number;
    GOOGL: number;
  };
  traffic: {
    endpoint: string;
    method: "GET" | "POST" | "PUT" | "DELETE";
    latency: number;
    statusCode: number;
    region: string;
  };
}

class TelemetryDB {
  private dbName = "NexusTelemetryDB";
  private storeName = "logs";
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error("Failed to open IndexedDB"));
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: "sequence",
          });
          store.createIndex("timestamp", "timestamp", { unique: false });
          store.createIndex("region", "traffic.region", { unique: false });
          store.createIndex("statusCode", "traffic.statusCode", { unique: false });
        }
      };
    });
  }

  async addLog(log: TelemetryLog): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      
      const request = store.put(log);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async addLogsBulk(logs: TelemetryLog[]): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      for (const log of logs) {
        store.put(log);
      }
    });
  }

  async getLogs(limit: number = 100, offset: number = 0): Promise<TelemetryLog[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, "readonly");
      const store = transaction.objectStore(this.storeName);
      const index = store.index("timestamp");
      const request = index.openCursor(null, "prev"); // newest first
      const results: TelemetryLog[] = [];
      let skipped = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (!cursor) {
          resolve(results);
          return;
        }

        if (skipped < offset) {
          skipped++;
          cursor.continue();
          return;
        }

        results.push(cursor.value);
        if (results.length < limit) {
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getStats(): Promise<{
    count: number;
    avgCpu: number;
    avgLatency: number;
    errorRate: number;
  }> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.openCursor();
      let count = 0;
      let totalCpu = 0;
      let totalLatency = 0;
      let errorCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          count++;
          const val = cursor.value as TelemetryLog;
          totalCpu += val.hardware.cpuUsage;
          totalLatency += val.traffic.latency;
          if (val.traffic.statusCode >= 400) {
            errorCount++;
          }
          cursor.continue();
        } else {
          resolve({
            count,
            avgCpu: count > 0 ? parseFloat((totalCpu / count).toFixed(2)) : 0,
            avgLatency: count > 0 ? parseFloat((totalLatency / count).toFixed(2)) : 0,
            errorRate: count > 0 ? parseFloat(((errorCount / count) * 100).toFixed(2)) : 0,
          });
        }
      };

      request.onerror = () => reject(request.error);
    });
  }
}

export const telemetryDB = new TelemetryDB();
