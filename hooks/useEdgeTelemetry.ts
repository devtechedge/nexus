"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTelemetryStore } from "@/store/telemetryStore";
import { telemetryWorkerCode } from "@/workers/workerCode";
import { TelemetryLog } from "@/lib/db";

export interface AnomalyEvent {
  id: string;
  timestamp: number;
  type: string;
  severity: "warning" | "critical";
  message: string;
}

export function useEdgeTelemetry() {
  const { setLatestLog, setStreaming, isStreaming } = useTelemetryStore();
  const [anomalies, setAnomalies] = useState<AnomalyEvent[]>([]);
  const [systemHealth, setSystemHealth] = useState<number>(100);
  const [movingCpu, setMovingCpu] = useState<number>(0);

  const workerRef = useRef<Worker | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isStreamingRef = useRef(isStreaming);
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Initialize Web Worker
  useEffect(() => {
    const blob = new Blob([telemetryWorkerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    worker.onmessage = (e: MessageEvent) => {
      const { type, payload } = e.data;

      if (type === "PROCESSED_LOG") {
        const { log, analysis } = payload;
        
        // Update global state store
        setLatestLog(log as TelemetryLog);

        // Update local hook metrics
        setMovingCpu(analysis.movingAvgCpu);

        // Handle anomalies
        if (analysis.anomalies && analysis.anomalies.length > 0) {
          const newAnomalies = analysis.anomalies.map((an: any) => ({
            id: `${log.sequence}-${an.type}-${Date.now()}`,
            timestamp: log.timestamp,
            ...an,
          }));

          setAnomalies((prev) => [
            ...newAnomalies,
            ...prev,
          ].slice(0, 100)); // limit log to 100 occurrences

          // Calculate a dynamic system health index
          setSystemHealth((prev) => {
            const deduction = newAnomalies.reduce(
              (acc: number, an: any) => acc + (an.severity === "critical" ? 8 : 3),
              0
            );
            return Math.max(20, Math.min(100, prev - deduction));
          });
        } else {
          // Slow recovery of system health
          setSystemHealth((prev) => Math.min(100, prev + 0.5));
        }
      } else if (type === "ERROR") {
        console.error("Worker error:", payload);
      }
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };
  }, [setLatestLog]);

  // Start telemetry stream
  const startStream = useCallback(async () => {
    if (isStreamingRef.current) return;

    setStreaming(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/stream", {
        signal: controller.signal,
      });

      if (!response.body) {
        throw new Error("No response body received from Edge stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");

        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && workerRef.current) {
            // Forward raw line off the main thread to Web Worker!
            workerRef.current.postMessage({
              type: "PARSE_RAW_LINE",
              payload: trimmed,
            });
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Telemetry streaming failed:", err);
      }
    } finally {
      setStreaming(false);
    }
  }, [setStreaming]);

  // Stop telemetry stream
  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStreaming(false);
  }, [setStreaming]);

  return {
    isStreaming,
    startStream,
    stopStream,
    anomalies,
    systemHealth: Math.round(systemHealth),
    movingCpu,
    clearAnomalies: () => setAnomalies([]),
  };
}
