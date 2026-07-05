"use client";

import { useEffect, useState } from "react";
import { useTelemetryStore } from "@/store/telemetryStore";
import { TelemetryDashboard } from "@/components/TelemetryDashboard";
import { LoginForm } from "@/components/LoginForm";

export default function Home() {
  const { user } = useTelemetryStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-mono text-xs text-slate-500 gap-3">
        <div className="w-5 h-5 border-2 border-teal-500/30 border-t-teal-400 rounded-full animate-spin" />
        <span>Initializing Secure Console Connection...</span>
      </div>
    );
  }

  if (user && user.authenticated) {
    return <TelemetryDashboard />;
  }

  return <LoginForm />;
}
