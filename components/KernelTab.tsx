"use client";

import React, { useState, useEffect } from "react";
import { telemetryDB, TelemetryLog } from "@/lib/db";
import { useTelemetryStore } from "@/store/telemetryStore";
import { HardDrive, Sliders, Database, Trash2, Download, RefreshCw, Cpu, Activity, AlertTriangle, ShieldCheck } from "lucide-react";

export const KernelTab: React.FC = () => {
  const { clearHistory } = useTelemetryStore();
  
  // Simulated Kernel States
  const [tcpBuffer, setTcpBuffer] = useState(1024);
  const [keepaliveTimeout, setKeepaliveTimeout] = useState(60);
  const [batchSyncLimit, setBatchSyncLimit] = useState(25);

  // DB Stats
  const [dbStats, setDbStats] = useState({
    count: 0,
    avgCpu: 0,
    avgLatency: 0,
    errorRate: 0,
  });
  const [loadingStats, setLoadingStats] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState("");

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const stats = await telemetryDB.getStats();
      setDbStats(stats);
    } catch (err) {
      console.error("Failed to read database stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStats();
    }, 0);
    const interval = setInterval(fetchStats, 5000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  // Download entire database as a JSON dump
  const handleDownloadDump = async () => {
    setMaintenanceMsg("Querying all records for dump...");
    try {
      const allLogs = await telemetryDB.getLogs(5000, 0); // Query up to 5000 logs
      const blob = new Blob([JSON.stringify(allLogs, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `nexus_telemetry_dump_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setMaintenanceMsg("Database JSON Dump exported successfully.");
    } catch (err) {
      setMaintenanceMsg("Export failed. Internal storage error.");
    }
    setTimeout(() => setMaintenanceMsg(""), 4000);
  };

  // Compact DB table by dropping older entries, keeping only the latest 100 entries
  const handleCompactDB = async () => {
    setMaintenanceMsg("Compacting tables. Re-indexing B-Trees...");
    try {
      const allLogs = await telemetryDB.getLogs(5000, 0);
      if (allLogs.length > 100) {
        // Keep latest 100, clear DB, then write back those 100
        const latest100 = allLogs.slice(0, 100);
        await telemetryDB.clearAll();
        await telemetryDB.addLogsBulk(latest100);
        clearHistory();
        await fetchStats();
        setMaintenanceMsg("IndexedDB Table compacted successfully. Reclaimed free sectors.");
      } else {
        setMaintenanceMsg("Table density nominal. Compaction not required (<100 records).");
      }
    } catch (err) {
      setMaintenanceMsg("Compaction failed.");
    }
    setTimeout(() => setMaintenanceMsg(""), 4000);
  };

  // Wipe database
  const handleWipeDB = async () => {
    if (!confirm("Are you absolutely sure you want to purge all IndexedDB operational telemetry? This action cannot be undone.")) return;
    
    setMaintenanceMsg("Purging data blocks...");
    try {
      await telemetryDB.clearAll();
      clearHistory();
      await fetchStats();
      setMaintenanceMsg("IndexedDB table completely purged. Sector zero written.");
    } catch (err) {
      setMaintenanceMsg("Purge aborted.");
    }
    setTimeout(() => setMaintenanceMsg(""), 4000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Tuning Parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* TCP buffer slider */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow space-y-4 font-mono">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
            <Sliders className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-bold uppercase text-white tracking-wider">
              TCP Socket Buffer
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>TCP Window Size:</span>
              <span className="text-teal-400 font-bold">{tcpBuffer} bytes</span>
            </div>
            <input
              type="range"
              min="256"
              max="4096"
              step="256"
              value={tcpBuffer}
              onChange={(e) => setTcpBuffer(parseInt(e.target.value))}
              className="w-full accent-teal-400 cursor-pointer"
            />
            <span className="text-[9px] text-slate-500 block">
              Controls socket buffering limits before queue-dropping packets.
            </span>
          </div>
        </div>

        {/* Keepalive Probe timeout */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow space-y-4 font-mono">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
            <Cpu className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-bold uppercase text-white tracking-wider">
              Keepalive Heartbeats
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Timeout Interval:</span>
              <span className="text-teal-400 font-bold">{keepaliveTimeout} s</span>
            </div>
            <input
              type="range"
              min="15"
              max="300"
              step="15"
              value={keepaliveTimeout}
              onChange={(e) => setKeepaliveTimeout(parseInt(e.target.value))}
              className="w-full accent-teal-400 cursor-pointer"
            />
            <span className="text-[9px] text-slate-500 block">
              Time elapsed before closed connections are pruned from sockets.
            </span>
          </div>
        </div>

        {/* IndexedDB write batch size */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow space-y-4 font-mono">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
            <HardDrive className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-bold uppercase text-white tracking-wider">
              DB Sync Transaction Limit
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Transaction Cap:</span>
              <span className="text-teal-400 font-bold">{batchSyncLimit} ops</span>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={batchSyncLimit}
              onChange={(e) => setBatchSyncLimit(parseInt(e.target.value))}
              className="w-full accent-teal-400 cursor-pointer"
            />
            <span className="text-[9px] text-slate-500 block">
              Configures transactional limits on direct IndexedDB commits.
            </span>
          </div>
        </div>

      </div>

      {/* Database Maintenance and Stats Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* DB Metrics */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-teal-400" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                IndexedDB Storage Allocation Stats
              </h3>
            </div>
            <button
              onClick={fetchStats}
              className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
              title="Refresh Stats"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 font-mono text-xs">
            <div className="bg-slate-950 p-3 rounded border border-slate-850">
              <span className="text-slate-500 block text-[10px] uppercase">Record Count</span>
              <strong className="text-white text-lg font-bold">{dbStats.count} entries</strong>
            </div>

            <div className="bg-slate-950 p-3 rounded border border-slate-850">
              <span className="text-slate-500 block text-[10px] uppercase">Avg Latency Profiling</span>
              <strong className="text-teal-400 text-lg font-bold">{dbStats.avgLatency} ms</strong>
            </div>

            <div className="bg-slate-950 p-3 rounded border border-slate-850">
              <span className="text-slate-500 block text-[10px] uppercase">Mean SRE CPU load</span>
              <strong className="text-white text-lg font-bold">{dbStats.avgCpu}%</strong>
            </div>

            <div className="bg-slate-950 p-3 rounded border border-slate-850">
              <span className="text-slate-500 block text-[10px] uppercase">Mean Error Code Ratio</span>
              <strong className={`text-lg font-bold ${dbStats.errorRate > 10 ? "text-red-400" : "text-emerald-400"}`}>
                {dbStats.errorRate}%
              </strong>
            </div>
          </div>
        </div>

        {/* Maintenance Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase text-white tracking-wider pb-2 border-b border-slate-800 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
              Operational Maintenance Tasks
            </h3>

            {maintenanceMsg && (
              <div className="bg-teal-950/20 border border-teal-500/15 p-2.5 rounded text-xs font-mono text-teal-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span>{maintenanceMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
              {/* Dump */}
              <button
                onClick={handleDownloadDump}
                className="py-3 px-2 bg-slate-950 border border-slate-800 rounded hover:bg-slate-850 hover:text-white text-slate-300 text-xs font-bold transition flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                title="Download JSON telemetry logs"
              >
                <Download className="w-4 h-4 text-teal-400" />
                <span>Export JSON</span>
              </button>

              {/* Compact */}
              <button
                onClick={handleCompactDB}
                className="py-3 px-2 bg-slate-950 border border-slate-800 rounded hover:bg-slate-850 hover:text-white text-slate-300 text-xs font-bold transition flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                title="Compact Database records"
              >
                <RefreshCw className="w-4 h-4 text-amber-400" />
                <span>Compact Table</span>
              </button>

              {/* Wipe */}
              <button
                onClick={handleWipeDB}
                className="py-3 px-2 bg-slate-950 border border-slate-800 rounded hover:bg-red-950/30 hover:border-red-900 hover:text-red-400 text-slate-400 text-xs font-bold transition flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                title="Purge all logs"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
                <span>Nuke Database</span>
              </button>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 font-mono italic mt-2">
            * Warning: Purging database sector indexes wipes historical visualizations instantly. Use with absolute SRE discretion.
          </p>
        </div>

      </div>
    </div>
  );
};
