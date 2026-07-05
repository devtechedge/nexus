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

interface TelemetryState {
  latestLog: TelemetryLog | null;
  logsHistory: TelemetryLog[];
  isStreaming: boolean;
  filters: TelemetryFilters;
  user: UserSession | null;
  
  // Actions
  setLatestLog: (log: TelemetryLog) => void;
  setStreaming: (isStreaming: boolean) => void;
  clearHistory: () => void;
  setFilters: (filters: Partial<TelemetryFilters>) => void;
  setUser: (user: UserSession | null) => void;
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
}));
