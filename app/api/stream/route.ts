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
  };
}

const ENDPOINTS = ["/api/v1/auth", "/api/v1/telemetry", "/api/v1/analytics", "/api/v1/compute", "/api/v1/predict"];
const METHODS: Array<"GET" | "POST" | "PUT" | "DELETE"> = ["GET", "POST", "PUT", "DELETE"];
const REGIONS = ["us-east", "us-west", "eu-west", "ap-northeast", "sa-east"];

function generateTelemetry(seq: number): TelemetryPayload {
  const t = Date.now();
  // Base values with slight sine wave variations
  const cpu = 25 + Math.sin(t / 20000) * 15 + Math.random() * 5;
  const mem = 45 + Math.cos(t / 50000) * 10 + Math.random() * 2;
  const disk = 12 + Math.sin(t / 10000) * 8 + (Math.random() > 0.95 ? 40 : 0);
  const netIn = 150 + Math.sin(t / 15000) * 50 + Math.random() * 20;
  const netOut = 220 + Math.cos(t / 15000) * 60 + Math.random() * 30;
  const temp = 42 + (cpu / 10) + Math.random() * 1.5;

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
      endpoint: ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)],
      method: METHODS[Math.floor(Math.random() * METHODS.length)],
      latency: Math.floor(25 + Math.random() * 150 + (Math.random() > 0.98 ? 800 : 0)),
      statusCode: Math.random() > 0.98 ? (Math.random() > 0.5 ? 500 : 404) : 200,
      region: REGIONS[Math.floor(Math.random() * REGIONS.length)],
    },
  };
}

export async function GET(req: NextRequest) {
  let seq = 0;
  const encoder = new TextEncoder();

  const customStream = new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        try {
          const telemetryData = generateTelemetry(seq++);
          const sseString = `data: ${JSON.stringify(telemetryData)}\n\n`;
          controller.enqueue(encoder.encode(sseString));
        } catch (err) {
          clearInterval(interval);
          controller.error(err);
        }
      }, 500); // 2Hz frequency streaming

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
