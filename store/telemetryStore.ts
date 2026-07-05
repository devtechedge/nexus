import { create } from "zustand";
import { TelemetryLog } from "@/lib/db";

export interface UserSession {
  username: string;
  role: "admin" | "operator" | "recruiter";
  token: string;
  authenticated: boolean;
}

export interface TelemetryFilters {
  endpoint: string;
  method: string;
  region: string;
  statusCode: string;
  search: string;
}

export type AppTab = "dashboard" | "security" | "routing" | "chaos" | "greenops" | "kernel";
export type StreamSpeed = "low" | "normal" | "high";
export type ChaosType = "none" | "cpu_spike" | "thermal_meltdown" | "network_blackout" | "memory_leak" | "sql_injection";

export interface CustomAlert {
  id: string;
  message: string;
  timestamp: number;
  type: string;
  severity: "warning" | "critical";
}

interface TelemetryState {
  latestLog: TelemetryLog | null;
  logsHistory: TelemetryLog[];
  isStreaming: boolean;
  filters: TelemetryFilters;
  user: UserSession | null;
  
  // New States for Multi-Tab and Production-Grade Features
  activeTab: AppTab;
  streamSpeed: StreamSpeed;
  activeChaos: ChaosType;
  cpuThreshold: number;
  tempThreshold: number;
  latencyThreshold: number;
  routingWeights: Record<string, number>;
  blockedIPs: string[];
  blockedEndpoints: string[];
  webglRenderStyle: "cube" | "sphere" | "wireframe" | "particles";
  customAlerts: CustomAlert[];

  // Actions
  setLatestLog: (log: TelemetryLog) => void;
  setStreaming: (isStreaming: boolean) => void;
  clearHistory: () => void;
  setFilters: (filters: Partial<TelemetryFilters>) => void;
  setUser: (user: UserSession | null) => void;
  
  // New Actions
  setActiveTab: (tab: AppTab) => void;
  setStreamSpeed: (speed: StreamSpeed) => void;
  setActiveChaos: (chaos: ChaosType) => void;
  setCpuThreshold: (val: number) => void;
  setTempThreshold: (val: number) => void;
  setLatencyThreshold: (val: number) => void;
  setRoutingWeights: (weights: Record<string, number>) => void;
  addBlockedIP: (ip: string) => void;
  removeBlockedIP: (ip: string) => void;
  addBlockedEndpoint: (endpoint: string) => void;
  removeBlockedEndpoint: (endpoint: string) => void;
  setWebGLRenderStyle: (style: "cube" | "sphere" | "wireframe" | "particles") => void;
  addCustomAlert: (alert: Omit<CustomAlert, "id" | "timestamp">) => void;
  clearCustomAlerts: () => void;
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  latestLog: null,
  logsHistory: [],
  isStreaming: false,
  filters: {
    endpoint: "ALL",
    method: "ALL",
    region: "ALL",
    statusCode: "ALL",
    search: "",
  },
  user: null,

  // New States Init
  activeTab: "dashboard",
  streamSpeed: "normal",
  activeChaos: "none",
  cpuThreshold: 85,
  tempThreshold: 55,
  latencyThreshold: 500,
  routingWeights: {
    "us-east": 20,
    "us-west": 20,
    "eu-west": 20,
    "ap-northeast": 20,
    "sa-east": 20,
  },
  blockedIPs: ["45.138.204.15"], // Default blocked threat IP
  blockedEndpoints: [],
  webglRenderStyle: "cube",
  customAlerts: [],

  setLatestLog: (log) =>
    set((state) => {
      // Keep only last 150 items in memory history for instant charting
      const updatedHistory = [log, ...state.logsHistory].slice(0, 150);
      return {
        latestLog: log,
        logsHistory: updatedHistory,
      };
    }),

  setStreaming: (isStreaming) => set({ isStreaming }),

  clearHistory: () => set({ latestLog: null, logsHistory: [] }),

  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),

  setUser: (user) => set({ user }),

  // New Actions Implementations
  setActiveTab: (activeTab) => set({ activeTab }),
  setStreamSpeed: (streamSpeed) => set({ streamSpeed }),
  setActiveChaos: (activeChaos) => set({ activeChaos }),
  setCpuThreshold: (cpuThreshold) => set({ cpuThreshold }),
  setTempThreshold: (tempThreshold) => set({ tempThreshold }),
  setLatencyThreshold: (latencyThreshold) => set({ latencyThreshold }),
  setRoutingWeights: (routingWeights) => set({ routingWeights }),
  addBlockedIP: (ip) => set((state) => {
    if (state.blockedIPs.includes(ip)) return {};
    return { blockedIPs: [...state.blockedIPs, ip] };
  }),
  removeBlockedIP: (ip) => set((state) => ({
    blockedIPs: state.blockedIPs.filter((item) => item !== ip),
  })),
  addBlockedEndpoint: (endpoint) => set((state) => {
    if (state.blockedEndpoints.includes(endpoint)) return {};
    return { blockedEndpoints: [...state.blockedEndpoints, endpoint] };
  }),
  removeBlockedEndpoint: (endpoint) => set((state) => ({
    blockedEndpoints: state.blockedEndpoints.filter((item) => item !== endpoint),
  })),
  setWebGLRenderStyle: (webglRenderStyle) => set({ webglRenderStyle }),
  addCustomAlert: (alert) => set((state) => ({
    customAlerts: [
      {
        ...alert,
        id: `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
      },
      ...state.customAlerts,
    ].slice(0, 50), // keep last 50 alerts
  })),
  clearCustomAlerts: () => set({ customAlerts: [] }),
}));
