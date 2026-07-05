"use client";

import React, { useState } from "react";
import { useTelemetryStore, ChaosType } from "@/store/telemetryStore";
import { Flame, Bomb, Zap, Play, Square, FileText, CheckCircle2, AlertOctagon, Terminal } from "lucide-react";

export const ChaosTab: React.FC = () => {
  const { activeChaos, setActiveChaos, isStreaming, logsHistory } = useTelemetryStore();
  const [postMortem, setPostMortem] = useState<string>("");
  const [loadingPostMortem, setLoadingPostMortem] = useState(false);

  const chaosScenarios = [
    {
      id: "cpu_spike" as ChaosType,
      name: "Inject CPU Workload Spike",
      description: "Overloads virtualization hypervisor scheduling. Forces CPU utilization up to 95%+",
      icon: <Zap className="w-5 h-5 text-indigo-400" />,
      color: "border-indigo-500/20 bg-indigo-950/10 hover:bg-indigo-950/20",
    },
    {
      id: "thermal_meltdown" as ChaosType,
      name: "Trigger Thermal Meltdown",
      description: "Disables cooling rack fans on active rack server chassis. Spikes junction temps up to 85°C+",
      icon: <Flame className="w-5 h-5 text-red-500 animate-pulse" />,
      color: "border-red-500/20 bg-red-950/10 hover:bg-red-950/20",
    },
    {
      id: "network_blackout" as ChaosType,
      name: "Simulate Network Blackout",
      description: "Generates massive cross-region packet drops. Latency climbs past 1500ms with HTTP 503/504s",
      icon: <Bomb className="w-5 h-5 text-amber-500" />,
      color: "border-amber-500/20 bg-amber-950/10 hover:bg-amber-950/20",
    },
    {
      id: "memory_leak" as ChaosType,
      name: "Trigger Memory Leak",
      description: "Simulates progressive garbage collection failure. Creeps memory heap up to 99% until OOM",
      icon: <AlertOctagon className="w-5 h-5 text-pink-500" />,
      color: "border-pink-500/20 bg-pink-950/10 hover:bg-pink-950/20",
    },
    {
      id: "sql_injection" as ChaosType,
      name: "Launch Penetration/SQLi",
      description: "Pumps malicious URL traversal payloads and database query injections from attacker proxies",
      icon: <Terminal className="w-5 h-5 text-cyan-400" />,
      color: "border-cyan-500/20 bg-cyan-950/10 hover:bg-cyan-950/20",
    },
  ];

  const handleTriggerChaos = (type: ChaosType) => {
    if (activeChaos === type) {
      setActiveChaos("none");
    } else {
      setActiveChaos(type);
    }
  };

  const generateAIReport = async () => {
    setLoadingPostMortem(true);
    setPostMortem("");
    try {
      // Fetch latest 20 logs as a sample
      const sampleLogs = logsHistory.slice(0, 15).map((l) => ({
        cpu: l.hardware.cpuUsage,
        temp: l.hardware.temperature,
        latency: l.traffic.latency,
        statusCode: l.traffic.statusCode,
        endpoint: l.traffic.endpoint,
      }));

      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Generate a highly professional, clinical, Markdown-formatted SRE Incident Post-Mortem for an active chaos experiment of type "${activeChaos}". Include sections: Root Cause, Timeline (using sample logs metrics), Impact Assessment, and Remediation/Prevention. Here is a brief metrics sample: ${JSON.stringify(sampleLogs)}`,
          metricsHistory: {},
        }),
      });
      const data = await res.json();
      if (data.text) {
        setPostMortem(data.text);
      } else {
        setPostMortem("Unable to compose report. SRE link offline.");
      }
    } catch (err) {
      setPostMortem("Failed to communicate with SRE Copilot endpoint.");
    } finally {
      setLoadingPostMortem(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Simulation Warn Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${activeChaos !== "none" ? "bg-red-500 animate-ping" : "bg-emerald-500"}`} />
            <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
              Chaos Injection Sandbox: {activeChaos === "none" ? "BASELINE STABLE" : `DRILL ACTIVE [${activeChaos.toUpperCase()}]`}
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            Inject synthetic micro-architectural, thermal, network, or malicious payload faults into the live stream.
          </p>
        </div>
        
        {activeChaos !== "none" && (
          <button
            onClick={() => setActiveChaos("none")}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-xs font-extrabold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-lg transition"
          >
            <CheckCircle2 className="w-4 h-4" /> Stop Chaos & Recover
          </button>
        )}
      </div>

      {/* Main Scenarios & Copilot Report Generator split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Scenarios lists */}
        <div className="space-y-4">
          <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-800">
            Microservice Fault Libraries
          </h3>

          <div className="space-y-3">
            {chaosScenarios.map((sc) => {
              const isCurrent = activeChaos === sc.id;
              return (
                <div
                  key={sc.id}
                  onClick={() => handleTriggerChaos(sc.id)}
                  className={`border rounded-xl p-4 cursor-pointer transition flex justify-between items-center ${sc.color} ${isCurrent ? "border-red-500 bg-red-950/20 ring-1 ring-red-500/30" : "border-slate-800"}`}
                >
                  <div className="flex items-center gap-4.5 pr-4">
                    <div className={`p-3 rounded-lg border bg-slate-950 flex items-center justify-center ${isCurrent ? "border-red-500" : "border-slate-800"}`}>
                      {sc.icon}
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-200 block font-mono">
                        {sc.name}
                      </span>
                      <p className="text-[11px] text-slate-500 font-mono leading-relaxed">
                        {sc.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {isCurrent ? (
                      <div className="p-1.5 bg-red-500 hover:bg-red-600 rounded-full text-slate-950 cursor-pointer">
                        <Square className="w-4 h-4 fill-current" />
                      </div>
                    ) : (
                      <div className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-full text-slate-400 cursor-pointer">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Post mortem reports */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col h-[490px]">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-400" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                SRE Incident Post-Mortem Generator
              </h3>
            </div>
            
            <button
              onClick={generateAIReport}
              disabled={activeChaos === "none" || loadingPostMortem || !isStreaming}
              className="text-[10px] font-mono font-bold px-3 py-1 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Compose Post-Mortem of Active Outage"
            >
              {loadingPostMortem ? "Analyzing..." : "Draft Post-Mortem"}
            </button>
          </div>

          <div className="flex-1 mt-4 overflow-y-auto font-mono text-xs p-4 bg-slate-950 border border-slate-850 rounded-lg text-slate-300 pr-1 scrollbar-thin select-text">
            {loadingPostMortem ? (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-teal-500/20 border-t-teal-400 rounded-full animate-spin" />
                <span>Gemini API assembling trace analytics & timelines...</span>
              </div>
            ) : postMortem ? (
              <div className="whitespace-pre-wrap leading-relaxed prose prose-invert prose-xs">
                {postMortem}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-1 text-center px-4">
                <Terminal className="w-8 h-8 text-slate-700 mb-1" />
                <span>No active analysis drafted.</span>
                <span className="text-[10px] text-slate-600 block mt-1 leading-relaxed">
                  Start the telemetry stream, activate any of the chaos fault injections on the left to gather metrics, and hit &quot;Draft Post-Mortem&quot; to compile.
                </span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
