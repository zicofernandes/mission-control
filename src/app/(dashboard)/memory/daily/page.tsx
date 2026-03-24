"use client";

import { useState, useEffect, useCallback } from "react";
import { Brain, ChevronDown, RefreshCw } from "lucide-react";
import { MarkdownPreview } from "@/components/MarkdownPreview";

interface DailyMemoryEntry {
  date: string;
  agent: string;
  agentEmoji: string;
  workspaceId: string;
  filePath: string;
  sizeBytes: number;
  preview: string;
}

type AgentFilter = "all" | "athena" | "elon";

const AGENT_OPTIONS: { value: AgentFilter; label: string }[] = [
  { value: "all", label: "All Agents" },
  { value: "athena", label: "Athena" },
  { value: "elon", label: "Elon" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function DailyMemoryPage() {
  const [agentFilter, setAgentFilter] = useState<AgentFilter>("all");
  const [entries, setEntries] = useState<DailyMemoryEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<DailyMemoryEntry | null>(null);
  const [content, setContent] = useState<string>("");
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const loadEntries = useCallback(async (filter: AgentFilter) => {
    setIsLoadingList(true);
    setError(null);
    try {
      const res = await fetch(`/api/memory/daily?agent=${filter}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setEntries(data.entries || []);
      // Auto-select first entry
      if (data.entries?.length > 0) {
        setSelectedEntry(data.entries[0]);
      } else {
        setSelectedEntry(null);
        setContent("");
      }
    } catch {
      setError("Failed to load memory entries");
      setEntries([]);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  const loadContent = useCallback(async (entry: DailyMemoryEntry) => {
    setIsLoadingContent(true);
    try {
      const res = await fetch(
        `/api/files?workspace=${encodeURIComponent(entry.workspaceId)}&path=${encodeURIComponent(entry.filePath)}`
      );
      if (!res.ok) throw new Error("Failed to load file");
      const data = await res.json();
      setContent(data.content || "");
    } catch {
      setContent("_Failed to load content._");
    } finally {
      setIsLoadingContent(false);
    }
  }, []);

  useEffect(() => {
    loadEntries(agentFilter);
  }, [agentFilter, loadEntries]);

  useEffect(() => {
    if (selectedEntry) loadContent(selectedEntry);
  }, [selectedEntry, loadContent]);

  // Group entries by date for display
  const grouped = entries.reduce<Record<string, DailyMemoryEntry[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = [];
    acc[e.date].push(e);
    return acc;
  }, {});

  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const selectedOption = AGENT_OPTIONS.find((o) => o.value === agentFilter)!;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div
        style={{
          padding: "24px 24px 16px",
          flexShrink: 0,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <div>
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
            Daily Memory
          </h1>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)" }}>
            Agent daily memory logs — newest first
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingBottom: "4px" }}>
          {/* Agent filter dropdown */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 12px",
                borderRadius: "8px",
                backgroundColor: "var(--surface, var(--card))",
                border: "1px solid var(--border)",
                cursor: "pointer",
                color: "var(--text-primary)",
                fontSize: "13px",
                fontWeight: 500,
                fontFamily: "var(--font-body)",
                transition: "border-color 120ms ease",
              }}
            >
              <span>{selectedOption.label}</span>
              <ChevronDown size={13} style={{ color: "var(--text-muted)" }} />
            </button>
            {dropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  right: 0,
                  minWidth: "150px",
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  overflow: "hidden",
                  zIndex: 50,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                }}
              >
                {AGENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setAgentFilter(opt.value);
                      setDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "9px 14px",
                      textAlign: "left",
                      background: agentFilter === opt.value ? "var(--accent-soft)" : "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: agentFilter === opt.value ? "var(--accent)" : "var(--text-primary)",
                      fontSize: "13px",
                      fontWeight: agentFilter === opt.value ? 600 : 400,
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Refresh */}
          <button
            onClick={() => loadEntries(agentFilter)}
            title="Refresh"
            style={{
              padding: "7px 9px",
              borderRadius: "8px",
              backgroundColor: "transparent",
              border: "1px solid var(--border)",
              cursor: "pointer",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Body: two-column */}
      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          borderTop: "1px solid var(--border)",
        }}
      >
        {/* LEFT: date list */}
        <aside
          style={{
            width: "260px",
            flexShrink: 0,
            borderRight: "1px solid var(--border)",
            overflowY: "auto",
            backgroundColor: "var(--surface, var(--card))",
          }}
        >
          {isLoadingList ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              Loading…
            </div>
          ) : error ? (
            <div style={{ padding: "24px", color: "var(--negative)", fontSize: "13px" }}>{error}</div>
          ) : dates.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              No daily memory files found.
            </div>
          ) : (
            <div style={{ paddingBottom: "16px" }}>
              {dates.map((date) => (
                <div key={date}>
                  {/* Date group header */}
                  <div
                    style={{
                      padding: "8px 16px 4px",
                      fontSize: "10px",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-heading)",
                      borderBottom: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{date}</span>
                    <span style={{ fontWeight: 400, opacity: 0.7 }}>{formatDate(date)}</span>
                  </div>

                  {/* Agent entries for this date */}
                  {grouped[date].map((entry) => {
                    const isSelected = selectedEntry?.date === entry.date && selectedEntry?.workspaceId === entry.workspaceId;
                    return (
                      <button
                        key={`${entry.workspaceId}-${entry.date}`}
                        onClick={() => setSelectedEntry(entry)}
                        style={{
                          width: "100%",
                          display: "block",
                          padding: "10px 16px",
                          background: isSelected ? "var(--accent-soft)" : "transparent",
                          border: "none",
                          borderLeft: isSelected ? "3px solid var(--accent)" : "3px solid transparent",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all 120ms ease",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = "var(--surface-hover, rgba(255,255,255,0.04))";
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = "transparent";
                        }}
                      >
                        {/* Agent badge + name */}
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "14px" }}>{entry.agentEmoji}</span>
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: 600,
                              color: isSelected ? "var(--accent)" : "var(--text-primary)",
                              fontFamily: "var(--font-heading)",
                            }}
                          >
                            {entry.agent}
                          </span>
                          <span
                            style={{
                              marginLeft: "auto",
                              fontSize: "10px",
                              color: "var(--text-muted)",
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            {formatBytes(entry.sizeBytes)}
                          </span>
                        </div>
                        {/* Preview line */}
                        {entry.preview && (
                          <p
                            style={{
                              fontSize: "11px",
                              color: "var(--text-muted)",
                              margin: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontFamily: "var(--font-body)",
                            }}
                          >
                            {entry.preview}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* RIGHT: content viewer */}
        <main
          style={{
            flex: 1,
            overflow: "auto",
            backgroundColor: "var(--bg)",
          }}
        >
          {isLoadingContent ? (
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: "13px" }}
            >
              Loading…
            </div>
          ) : selectedEntry ? (
            <div style={{ maxWidth: "800px", padding: "24px 32px" }}>
              {/* Entry header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "24px",
                  paddingBottom: "16px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span style={{ fontSize: "20px" }}>{selectedEntry.agentEmoji}</span>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "15px",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                    }}
                  >
                    {selectedEntry.agent} — {selectedEntry.date}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {selectedEntry.filePath} · {formatBytes(selectedEntry.sizeBytes)}
                  </div>
                </div>
              </div>
              <MarkdownPreview content={content} />
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--text-muted)",
              }}
            >
              <Brain style={{ width: "48px", height: "48px", opacity: 0.3, marginBottom: "12px" }} />
              <p style={{ fontSize: "13px" }}>Select a memory entry to view</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
