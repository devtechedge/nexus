export const telemetryWorkerCode = `
// Web Worker for off-main-thread processing of high-frequency SSE telemetry data
// This worker parses SSE chunks, runs telemetry analytics, detects anomalies, and persists logs directly to IndexedDB.

let db = null;
const dbName = "NexusTelemetryDB";
const storeName = "logs";
const dbVersion = 1;

// Initialize IndexedDB in the Web Worker
function initDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }
    const request = indexedDB.open(dbName, dbVersion);
    request.onerror = () => reject(request.error);
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(storeName)) {
        const store = database.createObjectStore(storeName, { keyPath: "sequence" });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("region", "traffic.region", { unique: false });
        store.createIndex("statusCode", "traffic.statusCode", { unique: false });
      }
    };
  });
}

// Persist a parsed log directly from the Web Worker to IndexedDB
async function persistLog(log) {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.put(log);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Worker IndexedDB write error:", err);
  }
}

// Analytics and Anomaly Detection State
let rollingCpu = [];
const ROLLING_WINDOW = 10;

function analyzeLog(log) {
  // 1. Calculate moving average of CPU usage
  rollingCpu.push(log.hardware.cpuUsage);
  if (rollingCpu.length > ROLLING_WINDOW) {
    rollingCpu.shift();
  }
  const avgCpu = rollingCpu.reduce((a, b) => a + b, 0) / rollingCpu.length;

  // 2. Anomaly Detection
  const anomalies = [];
  
  if (log.hardware.cpuUsage > 85) {
    anomalies.push({
      type: "HIGH_CPU",
      severity: "warning",
      message: \`Critical CPU load detected: \${log.hardware.cpuUsage}% (Moving Avg: \${avgCpu.toFixed(1)}%)\`,
    });
  }
  if (log.hardware.temperature > 55) {
    anomalies.push({
      type: "THERMAL_WARNING",
      severity: "critical",
      message: \`Core thermal threshold breached: \${log.hardware.temperature}°C\`,
    });
  }
  if (log.traffic.statusCode >= 500) {
    anomalies.push({
      type: "SERVER_ERROR",
      severity: "critical",
      message: \`HTTP \${log.traffic.statusCode} on \${log.traffic.method} \${log.traffic.endpoint} from \${log.traffic.region}\`,
    });
  } else if (log.traffic.statusCode >= 400) {
    anomalies.push({
      type: "CLIENT_ERROR",
      severity: "warning",
      message: \`HTTP \${log.traffic.statusCode} on \${log.traffic.method} \${log.traffic.endpoint}\`,
    });
  }
  if (log.traffic.latency > 500) {
    anomalies.push({
      type: "HIGH_LATENCY",
      severity: "warning",
      message: \`High API latency: \${log.traffic.latency}ms on \${log.traffic.endpoint}\`,
    });
  }

  return {
    movingAvgCpu: parseFloat(avgCpu.toFixed(2)),
    anomalies,
  };
}

// Listen to raw SSE messages from the main thread
self.onmessage = async function(e) {
  const { type, payload } = e.data;

  if (type === "PARSE_RAW_LINE") {
    try {
      if (!payload.startsWith("data: ")) return;
      const rawJson = payload.substring(6).trim();
      if (!rawJson) return;

      const log = JSON.parse(rawJson);
      
      // Analyze the log (calculations and anomalies)
      const analysis = analyzeLog(log);

      // Persist directly to database on background thread!
      await persistLog(log);

      // Post processed message and calculated metrics back to main thread
      self.postMessage({
        type: "PROCESSED_LOG",
        payload: {
          log,
          analysis,
        },
      });
    } catch (err) {
      self.postMessage({
        type: "ERROR",
        payload: "Failed to parse stream line: " + err.message,
      });
    }
  }
};
`;
