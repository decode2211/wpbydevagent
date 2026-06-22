import React, { useState } from "react";
import TenantSwitcher from "./components/TenantSwitcher";
import ChatMonitor from "./components/ChatMonitor";
import ChatThread from "./components/ChatThread";
import BroadcastDrawer from "./components/BroadcastDrawer";
import { Bot, Megaphone, HelpCircle } from "lucide-react";

export default function App() {
  const [activeTenantId, setActiveTenantId] = useState("");
  const [activeSessionId, setActiveSessionId] = useState("");
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);

  // When switching workspaces, reset the active session selection to avoid showing mismatched chats
  const handleTenantChange = (tenantId) => {
    setActiveTenantId(tenantId);
    setActiveSessionId("");
  };

  return (
    <div className="flex h-screen w-screen bg-[#020617] overflow-hidden text-slate-100 font-sans">
      
      {/* LEFT COLUMN: Sidebar (Tenant Switcher & Sessions Monitor) */}
      <aside className="w-80 border-r border-slate-800 bg-[#0b1329] flex flex-col justify-between select-none">
        <div className="flex-1 flex flex-col min-h-0">
          
          {/* Sidebar Header Brand */}
          <div className="flex items-center gap-2.5 px-6 py-5 border-b border-slate-800 bg-slate-900/10">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-950/50">
              <Bot className="w-4.5 h-4.5" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-slate-100 tracking-wider">Antigravity AI</h1>
              <p className="text-[10px] text-slate-500 font-medium tracking-wide">WhatsApp Support Portal</p>
            </div>
          </div>

          {/* Sidebar Section: Workspace Selector */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/15">
            <TenantSwitcher
              activeTenantId={activeTenantId}
              setActiveTenantId={handleTenantChange}
            />
          </div>

          {/* Sidebar Section: Chat Sessions Live Monitor */}
          <div className="flex-1 min-h-0">
            <ChatMonitor
              activeTenantId={activeTenantId}
              activeSessionId={activeSessionId}
              setActiveSessionId={setActiveSessionId}
            />
          </div>

        </div>

        {/* Sidebar Footer Details */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/15 flex items-center justify-between text-[10px] text-slate-500 font-medium">
          <span>Engine: LangGraph (v3.5)</span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            v1.0.0
          </span>
        </div>
      </aside>

      {/* RIGHT COLUMN: Viewport Area (Chat History Thread View) */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0f172a] h-full relative">
        {/* Navigation Bar / Toolbar */}
        <header className="px-6 py-4 border-b border-slate-800 bg-[#0b1329] flex items-center justify-between z-10">
          <div className="flex flex-col">
            <h2 className="text-sm font-bold text-slate-200 tracking-wider uppercase">
              {activeTenantId === "tenant_luxfurn" ? "LuxFurn Dashboard" : activeTenantId === "tenant_autocare" ? "AutoCare Dashboard" : "Sales & Support"}
            </h2>
            <p className="text-[10px] text-slate-400">
              Review conversation history logs or issue template broadcasts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTenantId && (
              <button
                onClick={() => setIsBroadcastOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs uppercase tracking-wider transition-all duration-300 shadow-md shadow-indigo-950/40"
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span>Broadcast</span>
              </button>
            )}
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors duration-200 cursor-pointer">
              <HelpCircle className="w-4.5 h-4.5" />
            </div>
          </div>
        </header>

        {/* Chat History Viewport */}
        <div className="flex-1 min-h-0">
          <ChatThread activeSessionId={activeSessionId} />
        </div>
      </main>

      {/* Broadcast Slide-out Panel */}
      <BroadcastDrawer
        isOpen={isBroadcastOpen}
        onClose={() => setIsBroadcastOpen(false)}
        activeTenantId={activeTenantId}
      />

    </div>
  );
}
