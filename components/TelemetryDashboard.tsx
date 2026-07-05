"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useEdgeTelemetry } from "@/hooks/useEdgeTelemetry";
import { useTelemetryStore } from "@/store/telemetryStore";
import { WebGLCanvas } from "@/components/WebGLCanvas";
import { HistoricalCharts } from "@/components/HistoricalCharts";
import { VirtualTable } from "@/components/VirtualTable";

// New Tab Components
import { SecurityTab } from "@/components/SecurityTab";
import { RoutingTab } from "@/components/RoutingTab";
import { ChaosTab } from "@/components/ChaosTab";
import { GreenOpsTab } from "@/components/GreenOpsTab";
import { KernelTab } from "@/components/KernelTab";

import {
  Cpu,
  Activity,
  ShieldCheck,
  Compass,
  Wifi,
  WifiOff,
  LogOut,
  HelpCircle,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Sun,
  Moon,
  AlertTriangle,
  Send,
  Terminal,
} from "lucide-react";

export const TelemetryDashboard: React.FC = () => {
  const {
    latestLog,
    logsHistory,
    isStreaming,
    user,
    setUser,
    activeTab,
    setActiveTab,
    streamSpeed,
    setStreamSpeed,
    activeChaos,
  } = useTelemetryStore();

  const { startStream, stopStream, anomalies, systemHealth, movingCpu, clearAnomalies } = useEdgeTelemetry();

  const [theme, setTheme] = useState<"dark" | "high-contrast">("dark");
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotQuery, setCopilotQuery] = useState("");
  const [copilotResponses, setCopilotResponses] = useState<Array<{ sender: "user" | "ai"; text: string }>>([
    {
      sender: "ai",
      text: "Affirmative. System Telemetry SRE Agent initialized. Ready to run anomaly forensics or micro-architectural reviews on your live metrics stream.",
    },
  ]);
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);

  // Auto-start stream on first mount
  useEffect(() => {
    startStream();
    return () => stopStream();
  }, [startStream, stopStream]);

  // Accessibility theme toggle handler
  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "high-contrast" : "dark";
    setTheme(nextTheme);
    if (nextTheme === "high-contrast") {
      document.documentElement.classList.add("high-contrast-theme");
    } else {
      document.documentElement.classList.remove("high-contrast-theme");
    }
  };

  // Compute metrics averages to forward to Gemini API SRE Assistant
  const rollingMetricsAverages = useMemo(() => {
    if (logsHistory.length === 0) return { avgCpu: 20, avgTemp: 40, avgLatency: 50 };
    const cpuSum = logsHistory.reduce((acc, l) => acc + l.hardware.cpuUsage, 0);
    const tempSum = logsHistory.reduce((acc, l) => acc + l.hardware.temperature, 0);
    const latSum = logsHistory.reduce((acc, l) => acc + l.traffic.latency, 0);
    const netInSum = logsHistory.reduce((acc, l) => acc + l.hardware.networkIn, 0);
    const netOutSum = logsHistory.reduce((acc, l) => acc + l.hardware.networkOut, 0);

    // Find top active region
    const regionCounts: Record<string, number> = {};
    logsHistory.forEach((l) => {
      regionCounts[l.traffic.region] = (regionCounts[l.traffic.region] || 0) + 1;
    });
    const topRegion = Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "us-east";

    return {
      avgCpu: Math.round(cpuSum / logsHistory.length),
      avgTemp: Math.round(tempSum / logsHistory.length),
      avgLatency: Math.round(latSum / logsHistory.length),
      avgNetIn: Math.round(netInSum / logsHistory.length),
      avgNetOut: Math.round(netOutSum / logsHistory.length),
      anomalyCount: anomalies.length,
      topRegion,
    };
  }, [logsHistory, anomalies]);

  // Handle SRE Copilot response query
  const handleCopilotSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotQuery.trim() || isCopilotLoading) return;

    const userMessage = copilotQuery;
    setCopilotResponses((prev) => [...prev, { sender: "user", text: userMessage }]);
    setCopilotQuery("");
    setIsCopilotLoading(true);

    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          metricsHistory: {
            ...rollingMetricsAverages,
            activeChaos,
            streamSpeed,
          },
        }),
      });

      const data = await response.json();
      if (data.text) {
        setCopilotResponses((prev) => [...prev, { sender: "ai", text: data.text }]);
      } else {
        setCopilotResponses((prev) => [
          ...prev,
          { sender: "ai", text: "Error compiling analytics stream. Try repeating the command." },
        ]);
      }
    } catch (err) {
      setCopilotResponses((prev) => [
        ...prev,
        { sender: "ai", text: "Loss of SRE Copilot connection stream. Please confirm your GEMINI_API_KEY setting." },
      ]);
    } finally {
      setIsCopilotLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <main
      className={`min-h-screen transition-colors duration-300 ${
        theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900 border-slate-300"
      }`}
      aria-label="Nexus Telemetry Console Container"
    >
      {/* 1. Header Toolbar */}
      <header className="border-b border-slate-800/80 bg-slate-950 px-4 lg:px-8 py-4 flex flex-wrap gap-4 items-center justify-between select-none shadow-md z-20 sticky top-0">
        <div className="flex items-center gap-3">
          <Terminal className="w-6 h-6 text-teal-400 animate-pulse" />
          <div className="flex flex-col">
            <h1 className="text-base font-mono font-bold tracking-tight text-white flex items-center gap-2">
              NEXUS TELEMETRY
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-950 text-teal-400 font-extrabold border border-teal-500/30">
                PWA CONSOLE
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-wider">
              Edge-Computed Analytical Observability Pipeline
            </p>
          </div>
        </div>

        {/* Streaming & Metric Controls */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Dynamic Frequency rate select */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800" title="Adjust background SSE sampling speed">
            <span className="text-[9px] font-mono text-slate-500 px-1.5 uppercase font-bold">Hz RATE:</span>
            <button
              onClick={() => setStreamSpeed("low")}
              className={`px-2 py-1 text-[9px] font-mono rounded cursor-pointer transition ${streamSpeed === "low" ? "bg-teal-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"}`}
              title="Low Rate (1Hz)"
            >
              1Hz
            </button>
            <button
              onClick={() => setStreamSpeed("normal")}
              className={`px-2 py-1 text-[9px] font-mono rounded cursor-pointer transition ${streamSpeed === "normal" ? "bg-teal-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"}`}
              title="Normal Rate (2Hz)"
            >
              2Hz
            </button>
            <button
              onClick={() => setStreamSpeed("high")}
              className={`px-2 py-1 text-[9px] font-mono rounded cursor-pointer transition ${streamSpeed === "high" ? "bg-red-500 text-slate-950 font-bold animate-pulse" : "text-slate-400 hover:text-white"}`}
              title="High Frequency Burst (10Hz)"
            >
              10Hz
            </button>
          </div>

          {/* Realtime Stream control */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={startStream}
              disabled={isStreaming}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                isStreaming
                  ? "bg-slate-950 text-slate-600 cursor-not-allowed"
                  : "bg-slate-950 hover:bg-slate-800 text-teal-400 border border-teal-500/20"
              }`}
            >
              <Wifi className="w-3.5 h-3.5" /> Start
            </button>
            <button
              onClick={stopStream}
              disabled={!isStreaming}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                !isStreaming
                  ? "bg-slate-950 text-slate-600 cursor-not-allowed"
                  : "bg-slate-950 hover:bg-slate-800 text-red-400 border border-red-500/20"
              }`}
            >
              <WifiOff className="w-3.5 h-3.5" /> Stop
            </button>
          </div>

          {/* Theme custom accessibility toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors border border-slate-800 cursor-pointer shadow-sm"
            aria-label="Toggle High Contrast Accessible Color Theme"
            title="Toggle Accessibility High Contrast Theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>

          {/* User Log out */}
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-3.5 py-1 rounded-lg">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-mono font-bold text-slate-400">@{user?.username}</span>
              <span className="text-[8px] font-mono text-teal-400 uppercase tracking-widest">{user?.role}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
              aria-label="Logout operational system console"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Dashboard Layout Area */}
      <div className="px-4 lg:px-8 py-6 max-w-7xl mx-auto space-y-6">
        
        {/* Aesthetic Tab Navigation Menu */}
        <nav className="flex flex-wrap items-center gap-1.5 border-b border-slate-800/60 pb-3" aria-label="Operational Navigation Tabs">
          {[
            { id: "dashboard", label: "Dashboard", icon: <Cpu className="w-4 h-4" /> },
            { id: "security", label: "Threat Guard (IDS)", icon: <ShieldCheck className="w-4 h-4" /> },
            { id: "routing", label: "Traffic Routing", icon: <Compass className="w-4 h-4" /> },
            { id: "chaos", label: "Chaos Sandbox", icon: <AlertTriangle className="w-4 h-4" /> },
            { id: "greenops", label: "GreenOps (CO2)", icon: <Sparkles className="w-4 h-4" /> },
            { id: "kernel", label: "Kernel Settings", icon: <Terminal className="w-4 h-4" /> },
          ].map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-lg border transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? "bg-teal-500 text-slate-950 border-teal-400 font-extrabold shadow-lg shadow-teal-500/10"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Conditional Rendering of active tab screen */}
        <div className="space-y-6">
          {activeTab === "dashboard" && (
            <>
              {/* Dynamic Live Status Banner */}
              <section className="grid grid-cols-1 md:grid-cols-4 gap-4" aria-live="polite">
                {/* Health Index CARD */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-teal-950 text-teal-400 border border-teal-500/20">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">SRE System Health</span>
                      <span className="text-xl font-mono font-bold text-slate-100">{systemHealth}%</span>
                    </div>
                  </div>
                  {/* Dynamic Status Color indicator */}
                  <div className="flex flex-col items-end">
                    <span className={`w-3.5 h-3.5 rounded-full ${systemHealth > 85 ? "bg-emerald-500 animate-pulse" : systemHealth > 50 ? "bg-yellow-500" : "bg-red-500 animate-bounce"}`} />
                    <span className="text-[9px] font-mono text-slate-500 mt-1 uppercase">
                      {systemHealth > 85 ? "Stable" : "Deactivated"}
                    </span>
                  </div>
                </div>

                {/* Core Load CARD */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3 shadow-sm">
                  <div className="p-2.5 rounded-lg bg-indigo-950 text-indigo-400 border border-indigo-500/20">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Core CPU Workload</span>
                    <span className="text-xl font-mono font-bold text-slate-100">
                      {latestLog ? `${latestLog.hardware.cpuUsage}%` : "0.0%"}
                    </span>
                  </div>
                </div>

                {/* Core temperature CARD */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3 shadow-sm">
                  <div className="p-2.5 rounded-lg bg-amber-950 text-amber-500 border border-amber-500/20">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Silicon Thermal Matrix</span>
                    <span className="text-xl font-mono font-bold text-slate-100">
                      {latestLog ? `${latestLog.hardware.temperature}°C` : "0.0°C"}
                    </span>
                  </div>
                </div>

                {/* Connection telemetry speed CARD */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3 shadow-sm">
                  <div className="p-2.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Security Certificate</span>
                    <span className="text-sm font-mono font-semibold text-emerald-400">
                      AES-GCM-256
                    </span>
                  </div>
                </div>
              </section>

              {/* 3. High Performance WebGL Graphics Rendering & Recent Anomalies */}
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-2">
                  <WebGLCanvas latestLog={latestLog} />
                </div>

                {/* Incident response diagnostics log queue */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between h-[380px] lg:h-[450px] shadow-lg">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 animate-bounce" />
                      <h2 className="text-sm font-semibold text-slate-200">Edge Incident Forensic Queue</h2>
                    </div>
                    <button
                      onClick={clearAnomalies}
                      className="text-[10px] font-mono px-2 py-0.5 border border-slate-800 rounded bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
                    >
                      Clear Queue
                    </button>
                  </div>

                  {/* Scrolling Incident Queue entries */}
                  <div className="flex-1 overflow-y-auto font-mono text-xs py-3.5 space-y-2 w-full pr-1 scrollbar-thin scrollbar-track-slate-950 scrollbar-thumb-slate-800" id="incidents-board">
                    {anomalies.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                        <ShieldCheck className="w-8 h-8 text-slate-700 mb-1" />
                        <span className="text-center font-mono">Telemetry stream currently operating within nominal baseline</span>
                      </div>
                    ) : (
                      anomalies.map((an) => {
                        const isCrit = an.severity === "critical";
                        return (
                          <div
                            key={an.id}
                            className={`p-2.5 rounded border flex flex-col gap-1 transition-all duration-305 ${
                              isCrit
                                ? "bg-red-950/40 border-red-800/60 text-red-200"
                                : "bg-yellow-950/20 border-yellow-800/40 text-yellow-200"
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold uppercase tracking-wider">
                                {an.type}
                              </span>
                              <span className="text-[9px] text-slate-500">
                                {new Date(an.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-[11px] font-mono leading-relaxed">{an.message}</p>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-500 text-center uppercase tracking-widest">
                    High priority SRE diagnostic triggers
                  </div>
                </div>
              </section>

              {/* 4. Historical SVG Charts */}
              <section aria-label="Historical data charts">
                <HistoricalCharts logsHistory={logsHistory} />
              </section>

              {/* 5. Virtual scroll records grid */}
              <section aria-label="Real-time virtual telemetry data logger">
                <VirtualTable />
              </section>
            </>
          )}

          {activeTab === "security" && <SecurityTab />}
          {activeTab === "routing" && <RoutingTab />}
          {activeTab === "chaos" && <ChaosTab />}
          {activeTab === "greenops" && <GreenOpsTab />}
          {activeTab === "kernel" && <KernelTab />}
        </div>

      </div>

      {/* 6. Floatable SRE Gemini Assistant Drawer (The AI Telemetry Copilot) */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {copilotOpen && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-[350px] sm:w-[420px] h-[500px] flex flex-col justify-between overflow-hidden mb-3 border-teal-500/20 animate-slideIn">
            {/* Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400 animate-pulse" />
                <h3 className="text-xs font-mono font-bold text-white tracking-wider uppercase">
                  Nexus-AI SRE Operational Copilot
                </h3>
              </div>
              <button
                onClick={() => setCopilotOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-mono px-2 py-1 border border-slate-800 rounded bg-slate-900 cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs bg-slate-950/40">
              {copilotResponses.map((res, idx) => (
                <div
                  key={idx}
                  className={`flex ${res.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-xl border leading-relaxed ${
                      res.sender === "user"
                        ? "bg-slate-900 border-slate-800 text-slate-200"
                        : "bg-teal-950/20 border-teal-500/15 text-teal-300"
                    }`}
                  >
                    <span className="text-[9px] font-bold uppercase block text-slate-500 mb-1.5">
                      {res.sender === "user" ? "SRE Command Prompt" : "Nexus-AI Analyst"}
                    </span>
                    <p className="whitespace-pre-wrap">{res.text}</p>
                  </div>
                </div>
              ))}

              {isCopilotLoading && (
                <div className="flex justify-start">
                  <div className="bg-teal-950/10 border border-teal-500/10 text-teal-400 p-3 rounded-xl flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing operational stream...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Form Input */}
            <form onSubmit={handleCopilotSend} className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                placeholder="Ask about CPU, temperatures, or latency spikes..."
                value={copilotQuery}
                onChange={(e) => setCopilotQuery(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 focus:border-teal-500/50 rounded-lg text-xs font-mono outline-none text-slate-200 placeholder-slate-500"
              />
              <button
                type="submit"
                className="p-2 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-lg cursor-pointer transition-colors shadow-lg flex items-center justify-center"
                aria-label="Send query to Operational Copilot"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Floating Toggle button */}
        <button
          onClick={() => setCopilotOpen(!copilotOpen)}
          className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 hover:scale-105 px-4.5 py-3 rounded-full text-slate-950 font-mono text-xs font-extrabold shadow-2xl transition-all duration-250 cursor-pointer border border-teal-300/40"
        >
          <Sparkles className="w-4 h-4 animate-bounce" />
          {copilotOpen ? "Close Copilot" : "SRE Copilot AI"}
        </button>
      </div>
    </main>
  );
};
