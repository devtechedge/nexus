"use client";

import React, { useState } from "react";
import { useTelemetryStore } from "@/store/telemetryStore";
import { Shield, ShieldAlert, ShieldCheck, Lock, Unlock, Plus, Trash2, Sliders, Server, AlertTriangle } from "lucide-react";

export const SecurityTab: React.FC = () => {
  const {
    blockedIPs,
    addBlockedIP,
    removeBlockedIP,
    customAlerts,
    clearCustomAlerts,
    cpuThreshold,
    setCpuThreshold,
    tempThreshold,
    setTempThreshold,
    latencyThreshold,
    setLatencyThreshold,
  } = useTelemetryStore();

  const [newIp, setNewIp] = useState("");

  const handleAddIp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIp) return;
    const cleanIp = newIp.trim();
    // basic validation
    if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(cleanIp)) {
      addBlockedIP(cleanIp);
      setNewIp("");
    } else {
      alert("Invalid IPv4 address format.");
    }
  };

  const threatAlerts = customAlerts.filter((a) => a.type === "WAF_BLOCK");

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Overview stats block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* IDS Status */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between shadow">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              WAF Firewall Mode
            </h3>
            <ShieldCheck className="w-5 h-5 text-teal-400 animate-pulse" />
          </div>
          <div className="my-4">
            <div className="text-2xl font-mono font-extrabold text-white">ACTIVE / SHIELD</div>
            <p className="text-[11px] text-slate-500 font-mono mt-1">
              Dynamic Threat Filter inspecting 100% of Edge payload logs.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
            <span className="text-[10px] font-mono text-teal-400 uppercase">Packet Inspection Live</span>
          </div>
        </div>

        {/* Threat Alert Count */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between shadow">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              Intrusions Intercepted
            </h3>
            <ShieldAlert className="w-5 h-5 text-red-400 animate-bounce" />
          </div>
          <div className="my-4">
            <div className="text-3xl font-mono font-extrabold text-red-400">{threatAlerts.length}</div>
            <p className="text-[11px] text-slate-500 font-mono mt-1">
              Malicious payloads filtered at the Edge layer.
            </p>
          </div>
          <button
            onClick={clearCustomAlerts}
            disabled={threatAlerts.length === 0}
            className="text-[10px] font-mono self-start text-slate-400 hover:text-white border border-slate-800 bg-slate-950 px-3 py-1 rounded hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Clear Intrusion History
          </button>
        </div>

        {/* System Active Policies */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between shadow">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              Active Security Policies
            </h3>
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-4 space-y-1 text-[11px] font-mono text-slate-300">
            <div className="flex justify-between border-b border-slate-800/60 pb-1">
              <span>SQL injection block list:</span>
              <span className="text-teal-400 font-bold">STRICT (WAF-v2)</span>
            </div>
            <div className="flex justify-between border-b border-slate-800/60 pb-1 pt-1">
              <span>Cross-Origin verification:</span>
              <span className="text-teal-400 font-bold">ENFORCED (CORS)</span>
            </div>
            <div className="flex justify-between pt-1">
              <span>Rate limiter cap:</span>
              <span className="text-teal-400 font-bold">120 reqs/sec</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Rule coverage: OWASP Top 10 Threat Map
          </div>
        </div>
      </div>

      {/* Main Firewall Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Blacklist manager */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
            <Sliders className="w-4 h-4 text-teal-400" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
              IP Access Blacklist (WAF Rules)
            </h2>
          </div>

          <form onSubmit={handleAddIp} className="flex gap-2">
            <input
              type="text"
              placeholder="Add IP (e.g. 192.168.1.1)"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs font-mono outline-none focus:border-teal-500/50 text-slate-200"
            />
            <button
              type="submit"
              className="p-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded cursor-pointer transition-colors flex items-center justify-center"
              title="Add IP to Blocklist"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>

          <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
            {blockedIPs.length === 0 ? (
              <div className="text-center font-mono text-[11px] text-slate-500 py-6">
                No blacklisted IP coordinates.
              </div>
            ) : (
              blockedIPs.map((ip) => (
                <div
                  key={ip}
                  className="flex justify-between items-center bg-slate-950 border border-slate-850 px-3 py-1.5 rounded"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span className="font-mono text-xs text-slate-300">{ip}</span>
                  </div>
                  <button
                    onClick={() => removeBlockedIP(ip)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                    title="Remove Rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
          <p className="text-[10px] text-slate-500 font-mono italic">
            * Incoming streams originating from these IP ranges will trigger immediate drop-actions.
          </p>
        </div>

        {/* Center/Right columns: Threat Log Stream & Customizable Alert Thresholds */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* SRE Alert Threshold Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
              <Server className="w-4 h-4 text-teal-400" />
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                Core Alerting Threshold Tuner
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* CPU Limit */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>CPU Limit Alert:</span>
                  <span className="text-teal-400 font-bold">{cpuThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="98"
                  value={cpuThreshold}
                  onChange={(e) => setCpuThreshold(parseInt(e.target.value))}
                  className="w-full accent-teal-400 cursor-pointer"
                />
                <span className="text-[9px] text-slate-500 block font-mono">
                  Warn if moving average breaches limit.
                </span>
              </div>

              {/* Temp Limit */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>Thermal Limit:</span>
                  <span className="text-teal-400 font-bold">{tempThreshold}°C</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="90"
                  value={tempThreshold}
                  onChange={(e) => setTempThreshold(parseInt(e.target.value))}
                  className="w-full accent-teal-400 cursor-pointer"
                />
                <span className="text-[9px] text-slate-500 block font-mono">
                  Warn on high silicon-core temp values.
                </span>
              </div>

              {/* Latency Limit */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>Latency Limit:</span>
                  <span className="text-teal-400 font-bold">{latencyThreshold}ms</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="1500"
                  step="50"
                  value={latencyThreshold}
                  onChange={(e) => setLatencyThreshold(parseInt(e.target.value))}
                  className="w-full accent-teal-400 cursor-pointer"
                />
                <span className="text-[9px] text-slate-500 block font-mono">
                  Warn on microservice timeout.
                </span>
              </div>
            </div>
          </div>

          {/* Blocked Threat Intrusion Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow flex flex-col h-[230px]">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  Live Blocked Security Threats Index
                </h2>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-950/50 border border-red-500/20 text-red-400 font-mono">
                WAF Logs
              </span>
            </div>

            <div className="flex-1 overflow-y-auto font-mono text-[11px] py-2 space-y-2 pr-1 scrollbar-thin">
              {threatAlerts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-1.5 py-8">
                  <ShieldCheck className="w-6 h-6 text-slate-700" />
                  <span>No security block events have been triggered yet.</span>
                </div>
              ) : (
                threatAlerts.map((al) => (
                  <div
                    key={al.id}
                    className="p-2 border border-red-900/30 bg-red-950/10 text-red-200 rounded flex justify-between gap-4 items-start"
                  >
                    <div>
                      <span className="text-[9px] bg-red-950 border border-red-800 px-1 rounded text-red-400 font-bold uppercase mr-2">
                        BLOCKED
                      </span>
                      <span>{al.message}</span>
                    </div>
                    <span className="text-[9px] text-slate-500 flex-shrink-0">
                      {new Date(al.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
