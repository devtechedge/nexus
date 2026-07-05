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
  const {
    setLatestLog,
    setStreaming,
    isStreaming,
    streamSpeed,
    activeChaos,
    cpuThreshold,
    tempThreshold,
    latencyThreshold,
    blockedIPs,
    blockedEndpoints,
    addCustomAlert,
  } = useTelemetryStore();

  const [anomalies, setAnomalies] = useState<AnomalyEvent[]>([]);
  const [systemHealth, setSystemHealth] = useState<number>(100);
  const [movingCpu, setMovingCpu] = useState<number>(0);

  const workerRef = useRef<Worker | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Synchronized refs to avoid stale worker callback scope
  const isStreamingRef = useRef(isStreaming);
  const cpuThresholdRef = useRef(cpuThreshold);
  const tempThresholdRef = useRef(tempThreshold);
  const latencyThresholdRef = useRef(latencyThreshold);
  const blockedIPsRef = useRef(blockedIPs);
  const blockedEndpointsRef = useRef(blockedEndpoints);
  const addCustomAlertRef = useRef(addCustomAlert);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    cpuThresholdRef.current = cpuThreshold;
    tempThresholdRef.current = tempThreshold;
    latencyThresholdRef.current = latencyThreshold;
    blockedIPsRef.current = blockedIPs;
    blockedEndpointsRef.current = blockedEndpoints;
    addCustomAlertRef.current = addCustomAlert;
  }, [cpuThreshold, tempThreshold, latencyThreshold, blockedIPs, blockedEndpoints, addCustomAlert]);

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

        // Custom thresholds, alert & threat inspections
        const localAnomalies: AnomalyEvent[] = [];
        const currentCpuThresh = cpuThresholdRef.current;
        const currentTempThresh = tempThresholdRef.current;
        const currentLatThresh = latencyThresholdRef.current;
        const currentBlockedIPs = blockedIPsRef.current;
        const currentBlockedEndpoints = blockedEndpointsRef.current;

        // Threat Guard IDS filtering
        const ipToCheck = log.traffic.clientIp || "";
        const epToCheck = log.traffic.endpoint || "";
        const isIpBlocked = currentBlockedIPs.includes(ipToCheck);
        const isEpBlocked = currentBlockedEndpoints.includes(epToCheck);
        
        if (isIpBlocked || isEpBlocked) {
          const blockAlert: AnomalyEvent = {
            id: `${log.sequence}-BLOCKED-THREAT-${Date.now()}`,
            timestamp: log.timestamp,
            type: "WAF_BLOCK",
            severity: "critical",
            message: `WAF Firewall Block: ${isIpBlocked ? `IP ${ipToCheck}` : `Endpoint ${epToCheck}`} blocked on ${log.traffic.method} ${epToCheck}`,
          };
          localAnomalies.push(blockAlert);
          
          addCustomAlertRef.current({
            message: `WAF Intrusion Blocked: ${ipToCheck} trying to access ${epToCheck}`,
            severity: "critical",
            type: "WAF_BLOCK",
          });
        }

        // Custom Threshold evaluations
        if (log.hardware.cpuUsage > currentCpuThresh) {
          localAnomalies.push({
            id: `${log.sequence}-CUSTOM_CPU-${Date.now()}`,
            timestamp: log.timestamp,
            type: "HIGH_CPU",
            severity: "warning",
            message: `CPU load breached custom threshold: ${log.hardware.cpuUsage}% (Limit: ${currentCpuThresh}%)`,
          });
        }
        if (log.hardware.temperature > currentTempThresh) {
          localAnomalies.push({
            id: `${log.sequence}-CUSTOM_TEMP-${Date.now()}`,
            timestamp: log.timestamp,
            type: "THERMAL_WARNING",
            severity: "critical",
            message: `Thermal matrix breached custom threshold: ${log.hardware.temperature}°C (Limit: ${currentTempThresh}°C)`,
          });
        }
        if (log.traffic.latency > currentLatThresh) {
          localAnomalies.push({
            id: `${log.sequence}-CUSTOM_LATENCY-${Date.now()}`,
            timestamp: log.timestamp,
            type: "HIGH_LATENCY",
            severity: "warning",
            message: `Latency breached custom threshold: ${log.traffic.latency}ms (Limit: ${currentLatThresh}ms)`,
          });
        }

        // Incorporate standard analysis anomalies
        if (analysis.anomalies && analysis.anomalies.length > 0) {
          analysis.anomalies.forEach((an: any) => {
            const alreadyAdded = localAnomalies.some((x) => x.type === an.type);
            if (!alreadyAdded) {
              localAnomalies.push({
                id: `${log.sequence}-${an.type}-${Date.now()}`,
                timestamp: log.timestamp,
                ...an,
              });
            }
          });
        }

        // Handle calculated anomalies in state
        if (localAnomalies.length > 0) {
          setAnomalies((prev) => [
            ...localAnomalies,
            ...prev,
          ].slice(0, 100)); // limit to 100

          // Deduct health
          setSystemHealth((prev) => {
            const deduction = localAnomalies.reduce(
              (acc: number, an: any) => acc + (an.severity === "critical" ? 8 : 3),
              0
            );
            return Math.max(20, Math.min(100, prev - deduction));
          });
        } else {
          // Slowly recover
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
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [setLatestLog]);

  // Start telemetry stream
  const startStream = useCallback(async () => {
    if (isStreamingRef.current) return;

    setStreaming(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`/api/stream?speed=${streamSpeed}&chaos=${activeChaos}`, {
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
  }, [setStreaming, streamSpeed, activeChaos]);

  // Stop telemetry stream
  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStreaming(false);
  }, [setStreaming]);

  // Restart stream dynamically on speed/chaos changes
  useEffect(() => {
    if (isStreamingRef.current) {
      stopStream();
      const restartTimeout = setTimeout(() => {
        startStream();
      }, 150);
      return () => clearTimeout(restartTimeout);
    }
  }, [streamSpeed, activeChaos, startStream, stopStream]);

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
