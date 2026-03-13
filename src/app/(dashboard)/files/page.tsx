"use client";

import { useState, useEffect } from "react";
import { List, Grid3X3, Layers, BookOpen, Settings } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { FileBrowser } from "@/components/FileBrowser";

interface Workspace {
  id: string;
  name: string;
  emoji: string;
  path: string;
  agentName?: string;
  kind: "workspace" | "vault" | "system";
}

type TabId = "workspaces" | "vault" | "system";

const TABS: { id: TabId; label: string; icon: typeof Layers }[] = [
  { id: "workspaces", label: "Workspaces", icon: Layers },
  { id: "vault",      label: "Vault",       icon: BookOpen },
  { id: "system",     label: "System",      icon: Settings },
];

export default function FilesPage() {
  const [activeTab, setActiveTab] = useState<TabId>("workspaces");
  const [allRoots, setAllRoots] = useState<{ workspaces: Workspace[]; vaults: Workspace[]; system: Workspace[] }>({
    workspaces: [],
    vaults: [],
    system: [],
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  useEffect(() => {
    fetch("/api/files/roots")
      .then((r) => r.json())
      .then((data) => {
        setAllRoots(data);
        // Auto-select first workspace
        if (data.workspaces?.length > 0) setSelectedId(data.workspaces[0].id);
      })
      .catch(() => {});
  }, []);

  // Items visible in the current tab's sidebar
  const sidebarItems: Workspace[] = {
    workspaces: allRoots.workspaces,
    vault:      allRoots.vaults,
    system:     allRoots.system,
  }[activeTab];

  const selectedItem = [...allRoots.workspaces, ...allRoots.vaults, ...allRoots.system].find(
    (w) => w.id === selectedId
  );

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setCurrentPath("");
    // Auto-select first item in tab
    const items = tab === "workspaces" ? allRoots.workspaces : tab === "vault" ? allRoots.vaults : allRoots.system;
    setSelectedId(items[0]?.id ?? null);
  };

  const handleSidebarSelect = (id: string) => {
    setSelectedId(id);
    setCurrentPath("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>
      {/* Page header */}
      <div style={{ padding: "24px 24px 0 24px" }}>
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "24px",
            fontWeight: 700,
            letterSpacing: "-1px",
            color: "var(--text-primary)",
            marginBottom: "4px",
          }}
        >
          File Browser
        </h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
          Browse agent workspaces, vault notes, and system files
        </p>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: active ? 600 : 400,
                  color: active ? "var(--accent)" : "var(--text-secondary)",
                  background: "none",
                  border: "none",
                  borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                  marginBottom: "-1px",
                  cursor: "pointer",
                  transition: "all 120ms ease",
                }}
              >
                <Icon size={14} />
                {label}
                {id !== "workspaces" && (
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "1px 5px",
                      borderRadius: "9999px",
                      background: "var(--accent-soft, rgba(139,92,246,0.15))",
                      color: "var(--accent)",
                      fontWeight: 600,
                    }}
                  >
                    {id === "vault" ? allRoots.vaults.length : allRoots.system.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", borderTop: "1px solid var(--border)" }}>
        {/* Sidebar */}
        <aside
          style={{
            width: "220px",
            flexShrink: 0,
            borderRight: "1px solid var(--border)",
            overflowY: "auto",
            padding: "16px 0",
            backgroundColor: "var(--surface, var(--card))",
          }}
        >
          <p
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "var(--text-muted)",
              padding: "0 16px 8px",
              textTransform: "uppercase",
            }}
          >
            {activeTab === "workspaces" ? "Agent Workspaces" : activeTab === "vault" ? "Vault" : "System Roots"}
          </p>

          {sidebarItems.length === 0 && (
            <p style={{ padding: "8px 16px", fontSize: "12px", color: "var(--text-muted)" }}>
              Nothing found
            </p>
          )}

          {sidebarItems.map((item) => {
            const isSelected = selectedId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSidebarSelect(item.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "9px 16px",
                  background: isSelected ? "var(--accent-soft)" : "transparent",
                  border: "none",
                  borderLeft: isSelected ? "3px solid var(--accent)" : "3px solid transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 120ms ease",
                }}
              >
                <span style={{ fontSize: "18px", lineHeight: 1, flexShrink: 0 }}>{item.emoji}</span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "13px",
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? "var(--accent)" : "var(--text-primary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.name}
                  </div>
                  {item.agentName && item.agentName !== item.name && (
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.agentName}
                    </div>
                  )}
                  {activeTab === "system" && (
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.path.replace(process.env.HOME || "", "~")}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </aside>

        {/* Main panel */}
        <main style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {selectedId && selectedItem ? (
            <>
              {/* Breadcrumb + view toggle */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 16px",
                  borderBottom: "1px solid var(--border)",
                  backgroundColor: "var(--surface, var(--card))",
                  flexShrink: 0,
                  gap: "12px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Breadcrumbs
                    path={currentPath}
                    onNavigate={setCurrentPath}
                    prefix={selectedItem.name}
                  />
                </div>
                <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                  {(["list", "grid"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      title={mode === "list" ? "List view" : "Grid view"}
                      style={{
                        padding: "5px 7px",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: viewMode === mode ? "var(--accent)" : "transparent",
                        color: viewMode === mode ? "var(--bg, #111)" : "var(--text-muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 120ms ease",
                      }}
                    >
                      {mode === "list" ? <List size={15} /> : <Grid3X3 size={15} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* File browser */}
              <div style={{ flex: 1, padding: 0 }}>
                <FileBrowser
                  workspace={selectedId}
                  path={currentPath}
                  onNavigate={setCurrentPath}
                  viewMode={viewMode}
                />
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "14px" }}>
              Select an item to browse its files
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
