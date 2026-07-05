import { NextRequest } from "next/server";

export const runtime = "edge";

interface TelemetryPayload {
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
    clientIp?: string;
  };
}

const ENDPOINTS = ["/api/v1/auth", "/api/v1/telemetry", "/api/v1/analytics", "/api/v1/compute", "/api/v1/predict"];
const METHODS: Array<"GET" | "POST" | "PUT" | "DELETE"> = ["GET", "POST", "PUT", "DELETE"];
const REGIONS = ["us-east", "us-west", "eu-west", "ap-northeast", "sa-east"];
const MALICIOUS_PAYLOADS = [
  "/api/v1/auth?id=1' OR '1'='1",
  "/admin/users; DROP TABLE users;--",
  "/api/v1/compute?cmd=cat%20/etc/passwd",
  "/api/v1/analytics?debug=true&xml=<entity>",
];

function generateTelemetry(seq: number, chaos: string): TelemetryPayload {
  const t = Date.now();
  
  // Base values with slight sine wave variations
  let cpu = 25 + Math.sin(t / 20000) * 15 + Math.random() * 5;
  let mem = 45 + Math.cos(t / 50000) * 10 + Math.random() * 2;
  let disk = 12 + Math.sin(t / 10000) * 8 + (Math.random() > 0.95 ? 40 : 0);
  let netIn = 150 + Math.sin(t / 15000) * 50 + Math.random() * 20;
  let netOut = 220 + Math.cos(t / 15000) * 60 + Math.random() * 30;
  let temp = 42 + (cpu / 10) + Math.random() * 1.5;

  let endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
  let method = METHODS[Math.floor(Math.random() * METHODS.length)];
  let latency = Math.floor(25 + Math.random() * 150 + (Math.random() > 0.98 ? 800 : 0));
  let statusCode = Math.random() > 0.98 ? (Math.random() > 0.5 ? 500 : 404) : 200;
  let region = REGIONS[Math.floor(Math.random() * REGIONS.length)];
  let clientIp = `192.168.1.${Math.floor(Math.random() * 254) + 1}`;

  // Apply Chaos SRE injects
  if (chaos === "cpu_spike") {
    cpu = 92.5 + Math.random() * 6.5;
    temp = 68.0 + Math.random() * 4.0;
  } else if (chaos === "thermal_meltdown") {
    cpu = 85.0 + Math.random() * 10.0;
    temp = 79.5 + Math.random() * 8.5;
  } else if (chaos === "network_blackout") {
    latency = 980 + Math.floor(Math.random() * 800);
    statusCode = Math.random() > 0.3 ? 503 : 504;
  } else if (chaos === "memory_leak") {
    // progressive simulation base on seq
    const creep = Math.min(50, (seq % 100) * 0.6);
    mem = 45 + creep + Math.random() * 3;
    if (mem > 90) {
      statusCode = 500;
    }
  } else if (chaos === "sql_injection") {
    endpoint = MALICIOUS_PAYLOADS[Math.floor(Math.random() * MALICIOUS_PAYLOADS.length)];
    method = "POST";
    statusCode = 403; // WAF Block simulated or vulnerable
    clientIp = "45.138.204.15"; // simulated attacker
  }

  const btcBase = 95000;
  const ethBase = 3200;
  const solBase = 180;
  const aaplBase = 240;
  const googlBase = 190;

  return {
    timestamp: t,
    sequence: seq,
    hardware: {
      cpuUsage: parseFloat(cpu.toFixed(2)),
      memoryUsage: parseFloat(mem.toFixed(2)),
      diskIo: parseFloat(disk.toFixed(2)),
      networkIn: parseFloat(netIn.toFixed(2)),
      networkOut: parseFloat(netOut.toFixed(2)),
      temperature: parseFloat(temp.toFixed(2)),
    },
    market: {
      BTC: parseFloat((btcBase + Math.sin(t / 30000) * 1000 + Math.random() * 50).toFixed(2)),
      ETH: parseFloat((ethBase + Math.cos(t / 25000) * 50 + Math.random() * 5).toFixed(2)),
      SOL: parseFloat((solBase + Math.sin(t / 15000) * 5 + Math.random() * 0.8).toFixed(2)),
      AAPL: parseFloat((aaplBase + Math.cos(t / 40000) * 2 + Math.random() * 0.2).toFixed(2)),
      GOOGL: parseFloat((googlBase + Math.sin(t / 45000) * 1.5 + Math.random() * 0.15).toFixed(2)),
    },
    traffic: {
      endpoint,
      method,
      latency,
      statusCode,
      region,
      clientIp,
    },
  };
}

export async function GET(req: NextRequest) {
  let seq = 0;
  const encoder = new TextEncoder();
  const { searchParams } = new URL(req.url);
  
  const speed = searchParams.get("speed") || "normal";
  const chaos = searchParams.get("chaos") || "none";

  // Frequency mapping (low, normal, high burst)
  let streamInterval = 500;
  if (speed === "low") {
    streamInterval = 1000;
  } else if (speed === "high") {
    streamInterval = 100;
  }

  const customStream = new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        try {
          const telemetryData = generateTelemetry(seq++, chaos);
          const sseString = `data: ${JSON.stringify(telemetryData)}\n\n`;
          controller.enqueue(encoder.encode(sseString));
        } catch (err) {
          clearInterval(interval);
          controller.error(err);
        }
      }, streamInterval);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new NextResponse(customStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}

import { NextResponse } from "next/server";
