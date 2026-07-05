"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { telemetryDB, TelemetryLog } from "@/lib/db";
import { useTelemetryStore } from "@/store/telemetryStore";
import { Search, RotateCcw, ArrowUpDown, ChevronDown, Download, AlertTriangle, Cpu, Globe, Activity } from "lucide-react";

export const VirtualTable: React.FC = () => {
  const { filters, setFilters, latestLog } = useTelemetryStore();
  const [dbLogs, setDbLogs] = useState<TelemetryLog[]>([]);
  const [totalDbCount, setTotalDbCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<keyof TelemetryLog | "traffic.latency" | "traffic.statusCode" | "traffic.endpoint" | "traffic.method" | "traffic.region" | "hardware.cpuUsage" | "hardware.temperature" | "">("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Local state for full search
  const [localSearch, setLocalSearch] = useState("");

  // Grid list height variables
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(400); // dynamic fallbacks
  const rowHeight = 44; // px

  // ResizeObserver to handle canvas or container scale changes dynamically
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 0) {
          setViewportHeight(entry.contentRect.height);
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Refresh logs from database
  const refreshLogs = useCallback(async () => {
    try {
      const logs = await telemetryDB.getLogs(1000, 0);
      setDbLogs(logs);
      setTotalDbCount(logs.length);
    } catch (err) {
      console.error("Failed to load historical logs:", err);
    }
  }, []);

  // Poll database or sync with new live telemetry log additions on mount only
  useEffect(() => {
    let active = true;
    
    const loadData = async () => {
      // Defer loading state to prevent synchronous cascading render error in effect
      setTimeout(() => {
        if (active) setIsLoading(true);
      }, 0);

      await refreshLogs();

      if (active) setIsLoading(false);
    };

    loadData();

    return () => {
      active = false;
    };
  }, [refreshLogs]);

  // Push latest log in memory as it arrives
  useEffect(() => {
    if (latestLog) {
      const timer = setTimeout(() => {
        setDbLogs((prev) => {
          if (prev.some((log) => log.sequence === latestLog.sequence)) {
            return prev;
          }
          const updated = [latestLog, ...prev];
          if (updated.length > 1000) {
            return updated.slice(0, 1000);
          }
          return updated;
        });
        setTotalDbCount((prev) => Math.min(1000, prev + 1));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [latestLog]);

  // Handle local search debouncing
  useEffect(() => {
    const handler = setTimeout(() => {
      setFilters({ search: localSearch });
    }, 250);
    return () => clearTimeout(handler);
  }, [localSearch, setFilters]);

  // Advanced multi-criteria filtering and sorting logic (in-memory memoized)
  const filteredSortedLogs = useMemo(() => {
    let result = [...dbLogs];

    // 1. Endpoint filter
    if (filters.endpoint !== "ALL") {
      result = result.filter((log) => log.traffic.endpoint === filters.endpoint);
    }
    // 2. Method filter
    if (filters.method !== "ALL") {
      result = result.filter((log) => log.traffic.method === filters.method);
    }
    // 3. Region filter
    if (filters.region !== "ALL") {
      result = result.filter((log) => log.traffic.region === filters.region);
    }
    // 4. Status code filter
    if (filters.statusCode !== "ALL") {
      if (filters.statusCode === "2xx") {
        result = result.filter((log) => log.traffic.statusCode >= 200 && log.traffic.statusCode < 300);
      } else if (filters.statusCode === "4xx") {
        result = result.filter((log) => log.traffic.statusCode >= 400 && log.traffic.statusCode < 500);
      } else if (filters.statusCode === "5xx") {
        result = result.filter((log) => log.traffic.statusCode >= 500);
      }
    }
    // 5. Search query (regex or substring match across coordinates, region, endpoint)
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (log) =>
          log.traffic.endpoint.toLowerCase().includes(q) ||
          log.traffic.region.toLowerCase().includes(q) ||
          log.traffic.method.toLowerCase().includes(q) ||
          log.traffic.statusCode.toString().includes(q)
      );
    }

    // Sort logs
    if (sortField) {
      result.sort((a, b) => {
        let valA: any = a;
        let valB: any = b;

        // Nested resolver
        if (sortField.includes(".")) {
          const parts = sortField.split(".");
          valA = (a as any)[parts[0]]?.[parts[1]];
          valB = (b as any)[parts[0]]?.[parts[1]];
        } else {
          valA = (a as any)[sortField];
          valB = (b as any)[sortField];
        }

        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [dbLogs, filters, sortField, sortOrder]);

  // Virtualization Scroll Calculation
  const totalRows = filteredSortedLogs.length;
  const totalHeight = totalRows * rowHeight;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Indices to render
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 2);
  const endIndex = Math.min(totalRows - 1, Math.floor((scrollTop + viewportHeight) / rowHeight) + 2);

  // Sliced items for display
  const visibleRows = useMemo(() => {
    const items = [];
    for (let i = startIndex; i <= endIndex; i++) {
      if (filteredSortedLogs[i]) {
        items.push({ index: i, data: filteredSortedLogs[i] });
      }
    }
    return items;
  }, [startIndex, endIndex, filteredSortedLogs]);

  // Handle column sorting
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Export current logs to CSV
  const exportCSV = () => {
    const headers = ["Timestamp", "Sequence", "CPU Usage (%)", "Mem Usage (%)", "Temp (°C)", "Endpoint", "Method", "Latency (ms)", "Status", "Region"];
    const rows = filteredSortedLogs.map((l) => [
      new Date(l.timestamp).toISOString(),
      l.sequence,
      l.hardware.cpuUsage,
      l.hardware.memoryUsage,
      l.hardware.temperature,
      l.traffic.endpoint,
      l.traffic.method,
      l.traffic.latency,
      l.traffic.statusCode,
      l.traffic.region,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `nexus_telemetry_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Clear IndexedDB completely
  const handleClearDB = async () => {
    if (confirm("Are you sure you want to purge all telemetry logs? This is irreversible.")) {
      await telemetryDB.clearAll();
      refreshLogs();
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl" id="telemetry-table-section">
      {/* Table Action Controls */}
      <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto md:flex-1 max-w-md">
          <div className="relative w-full">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Filter endpoint, status, region..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 focus:border-teal-500/80 rounded-lg text-sm text-slate-200 placeholder-slate-500 outline-none font-mono transition-all duration-200"
            />
          </div>
        </div>

        {/* Filters Panel */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Endpoint Selector */}
          <div className="flex flex-col">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest pl-1 mb-1">Endpoint</span>
            <select
              value={filters.endpoint}
              onChange={(e) => setFilters({ endpoint: e.target.value })}
              className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-300 font-mono focus:border-teal-500/50 outline-none cursor-pointer"
            >
              <option value="ALL">ALL</option>
              <option value="/api/v1/auth">Auth</option>
              <option value="/api/v1/telemetry">Telemetry</option>
              <option value="/api/v1/analytics">Analytics</option>
              <option value="/api/v1/compute">Compute</option>
              <option value="/api/v1/predict">Predict</option>
            </select>
          </div>

          {/* Region Selector */}
          <div className="flex flex-col">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest pl-1 mb-1">Region</span>
            <select
              value={filters.region}
              onChange={(e) => setFilters({ region: e.target.value })}
              className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-300 font-mono focus:border-teal-500/50 outline-none cursor-pointer"
            >
              <option value="ALL">ALL</option>
              <option value="us-east">us-east</option>
              <option value="us-west">us-west</option>
              <option value="eu-west">eu-west</option>
              <option value="ap-northeast">ap-northeast</option>
              <option value="sa-east">sa-east</option>
            </select>
          </div>

          {/* StatusCode Selector */}
          <div className="flex flex-col">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest pl-1 mb-1">Status</span>
            <select
              value={filters.statusCode}
              onChange={(e) => setFilters({ statusCode: e.target.value })}
              className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-300 font-mono focus:border-teal-500/50 outline-none cursor-pointer"
            >
              <option value="ALL">ALL</option>
              <option value="2xx">Success (2xx)</option>
              <option value="4xx">Client Err (4xx)</option>
              <option value="5xx">Server Err (5xx)</option>
            </select>
          </div>

          {/* Utility Tools */}
          <div className="flex items-end h-full gap-1.5 mt-4 self-end">
            <button
              onClick={refreshLogs}
              className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-md text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
              title="Refresh database records"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={exportCSV}
              className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-md text-teal-400 hover:text-teal-300 cursor-pointer transition-colors flex items-center gap-1.5 text-xs font-mono px-3"
              title="Export filtered records to CSV"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              onClick={handleClearDB}
              className="p-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-900/40 rounded-md text-red-400 hover:text-red-300 cursor-pointer transition-colors flex items-center gap-1.5 text-xs font-mono px-3"
              title="Wipe IndexedDB log history"
            >
              Wipe Logs
            </button>
          </div>
        </div>
      </div>

      {/* Grid Headers */}
      <div className="grid grid-cols-12 bg-slate-950 text-[10px] font-mono tracking-widest uppercase text-slate-400 border-b border-slate-800 font-bold py-2.5 px-4 select-none">
        <div className="col-span-2 flex items-center cursor-pointer hover:text-white" onClick={() => handleSort("timestamp")}>
          Timestamp <ArrowUpDown className="w-3 h-3 ml-1" />
        </div>
        <div className="col-span-1 flex items-center cursor-pointer hover:text-white" onClick={() => handleSort("sequence")}>
          Seq <ArrowUpDown className="w-3 h-3 ml-1" />
        </div>
        <div className="col-span-1 flex items-center cursor-pointer hover:text-white" onClick={() => handleSort("hardware.cpuUsage")}>
          CPU (%) <ArrowUpDown className="w-3 h-3 ml-1" />
        </div>
        <div className="col-span-1 flex items-center cursor-pointer hover:text-white" onClick={() => handleSort("hardware.temperature")}>
          Temp (°C) <ArrowUpDown className="w-3 h-3 ml-1" />
        </div>
        <div className="col-span-3 flex items-center cursor-pointer hover:text-white" onClick={() => handleSort("traffic.endpoint")}>
          Endpoint <ArrowUpDown className="w-3 h-3 ml-1" />
        </div>
        <div className="col-span-1 flex items-center cursor-pointer hover:text-white" onClick={() => handleSort("traffic.method")}>
          Method <ArrowUpDown className="w-3 h-3 ml-1" />
        </div>
        <div className="col-span-1 flex items-center cursor-pointer hover:text-white" onClick={() => handleSort("traffic.latency")}>
          Latency <ArrowUpDown className="w-3 h-3 ml-1" />
        </div>
        <div className="col-span-1 flex items-center cursor-pointer hover:text-white" onClick={() => handleSort("traffic.statusCode")}>
          Status <ArrowUpDown className="w-3 h-3 ml-1" />
        </div>
        <div className="col-span-1 flex items-center cursor-pointer hover:text-white" onClick={() => handleSort("traffic.region")}>
          Region <ArrowUpDown className="w-3 h-3 ml-1" />
        </div>
      </div>

      {/* Dynamic Virtual Scroll List */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-y-auto bg-slate-950/30 font-mono relative scrollbar-thin scrollbar-track-slate-950 scrollbar-thumb-slate-800"
        style={{ height: `${viewportHeight}px` }}
      >
        {totalRows === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm py-12">
            <Activity className="w-8 h-8 text-slate-600 animate-pulse mb-3" />
            <span>No historical log packets match active filter settings</span>
          </div>
        ) : (
          <div style={{ height: `${totalHeight}px`, width: "100%", position: "relative" }}>
            {visibleRows.map(({ index, data }) => {
              const dateStr = new Date(data.timestamp).toLocaleTimeString();
              const isError = data.traffic.statusCode >= 400;
              const isCrit = data.traffic.statusCode >= 500 || data.hardware.cpuUsage > 85;

              return (
                <div
                  key={data.sequence}
                  className={`grid grid-cols-12 text-xs text-slate-300 border-b border-slate-900/60 hover:bg-slate-800/40 items-center px-4 absolute left-0 w-full transition-colors duration-150 ${
                    isCrit ? "bg-red-950/10 text-red-100" : isError ? "bg-yellow-950/10 text-yellow-100" : ""
                  }`}
                  style={{
                    height: `${rowHeight}px`,
                    transform: `translateY(${index * rowHeight}px)`,
                  }}
                >
                  <div className="col-span-2 text-slate-500 font-light truncate">{dateStr}</div>
                  <div className="col-span-1 text-slate-400 font-semibold">#{data.sequence}</div>
                  
                  {/* CPU Progress */}
                  <div className="col-span-1 flex items-center gap-1.5 truncate">
                    <span className="font-semibold">{data.hardware.cpuUsage}%</span>
                    <div className="w-8 h-1 bg-slate-800 rounded-full overflow-hidden hidden xl:block">
                      <div
                        className={`h-full rounded-full ${
                          data.hardware.cpuUsage > 85 ? "bg-red-500 animate-pulse" : data.hardware.cpuUsage > 60 ? "bg-yellow-500" : "bg-teal-500"
                        }`}
                        style={{ width: `${data.hardware.cpuUsage}%` }}
                      />
                    </div>
                  </div>

                  {/* Temp */}
                  <div className="col-span-1 text-slate-300">{data.hardware.temperature}°C</div>

                  {/* Endpoint */}
                  <div className="col-span-3 truncate text-slate-400 font-medium">
                    {data.traffic.endpoint}
                  </div>

                  {/* Method */}
                  <div className="col-span-1">
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                      data.traffic.method === "GET" ? "bg-teal-950 text-teal-400" :
                      data.traffic.method === "POST" ? "bg-blue-950 text-blue-400" :
                      data.traffic.method === "DELETE" ? "bg-red-950 text-red-400" : "bg-yellow-950 text-yellow-400"
                    }`}>
                      {data.traffic.method}
                    </span>
                  </div>

                  {/* Latency */}
                  <div className="col-span-1 flex items-center">
                    <span className={`${data.traffic.latency > 300 ? "text-yellow-400 font-bold" : "text-slate-300"}`}>
                      {data.traffic.latency}ms
                    </span>
                  </div>

                  {/* Status Code */}
                  <div className="col-span-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center w-fit gap-1 ${
                      data.traffic.statusCode >= 500 ? "bg-red-950 text-red-400 border border-red-800" :
                      data.traffic.statusCode >= 400 ? "bg-yellow-950 text-yellow-400 border border-yellow-800" :
                      "bg-emerald-950 text-emerald-400 border border-emerald-800"
                    }`}>
                      {data.traffic.statusCode >= 400 && <AlertTriangle className="w-3 h-3" />}
                      {data.traffic.statusCode}
                    </span>
                  </div>

                  {/* Region */}
                  <div className="col-span-1 text-slate-500 truncate flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-slate-600" />
                    {data.traffic.region}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Table Footer Stats Overlay */}
      <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 flex flex-wrap justify-between items-center text-xs font-mono text-slate-500 select-none">
        <div className="flex items-center gap-4">
          <span>Buffer: <strong className="text-slate-300">{filteredSortedLogs.length} matching</strong> / {totalDbCount} records</span>
          <span className="hidden sm:inline">|</span>
          <span className="hidden sm:inline">Rendering indexes: <strong className="text-teal-400">{startIndex}-{endIndex}</strong></span>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Edge virtualized viewport system active
        </div>
      </div>
    </div>
  );
};
