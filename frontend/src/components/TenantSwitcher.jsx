import React, { useEffect, useState } from "react";
import apiClient from "../api/client";
import { Sofa, ShieldAlert, Cpu } from "lucide-react";

/**
 * TenantSwitcher Component
 * Fetches all active tenants and displays them as buttons to switch views.
 * 
 * Props:
 * - activeTenantId: string (current active tenant ID)
 * - setActiveTenantId: function (setter for active tenant ID)
 */
export default function TenantSwitcher({ activeTenantId, setActiveTenantId }) {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchTenants() {
      try {
        setLoading(true);
        const response = await apiClient.get("/api/tenants");
        setTenants(response.data);
        // Default to the first tenant if none is selected
        if (response.data.length > 0 && !activeTenantId) {
          setActiveTenantId(response.data[0].tenant_id);
        }
        setError(null);
      } catch (err) {
        console.error("Error fetching tenants:", err);
        setError("Failed to load tenants");
        // Fallback static tenants for local design mockup preview
        const staticTenants = [
          { tenant_id: "tenant_luxfurn", name: "LuxFurn" },
          { tenant_id: "tenant_autocare", name: "AutoCare" },
        ];
        setTenants(staticTenants);
        if (!activeTenantId) setActiveTenantId(staticTenants[0].tenant_id);
      } finally {
        setLoading(false);
      }
    }

    fetchTenants();
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-3 py-1">
        <Cpu className="w-5 h-5 text-indigo-400" />
        <span className="text-sm font-semibold tracking-wider uppercase text-slate-400">Workspaces</span>
      </div>

      {loading && tenants.length === 0 ? (
        <div className="px-3 py-2 text-xs text-slate-500">Loading workspaces...</div>
      ) : (
        <div className="flex flex-col gap-2">
          {tenants.map((tenant) => {
            const isActive = tenant.tenant_id === activeTenantId;
            const isLux = tenant.tenant_id === "tenant_luxfurn";

            return (
              <button
                key={tenant.tenant_id}
                onClick={() => setActiveTenantId(tenant.tenant_id)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-left transition-all duration-300 ${
                  isActive
                    ? "bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-950/40"
                    : "bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isActive ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-400"}`}>
                    {isLux ? <Sofa className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{tenant.name}</div>
                    <div className="text-xs opacity-75">{isLux ? "Premium Sales" : "Service & Support"}</div>
                  </div>
                </div>
                {isActive && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="mt-2 p-3 bg-red-950/20 border border-red-900/40 rounded-lg text-xs text-red-400 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
          Offline preview active
        </div>
      )}
    </div>
  );
}
