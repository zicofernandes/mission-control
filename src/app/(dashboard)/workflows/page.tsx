"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Clock, Zap, TrendingUp, Shield, Brain, DollarSign, Users, GitBranch, BarChart3, Play, AlertCircle } from "lucide-react";

interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: { kind: string; expr?: string; everyMs?: number; tz?: string };
  state: { lastRunStatus?: string; lastDurationMs?: number; nextRunAtMs?: number; consecutiveErrors?: number };
  payload: { kind: string; timeoutSeconds?: number };
  agentId: string;
}

interface Workflow {
  id: string;
  emoji: string;
  name: string;
  description: string;
  schedule: string;
  category: "infrastructure" | "revenue" | "intelligence" | "delivery";
  status: "active" | "proposed" | "inactive";
  owner: "elon" | "athena" | "both";
  cronId?: string;
  priority?: number;
}

const PROPOSED_WORKFLOWS: Workflow[] = [
  // ── Revenue ──────────────────────────────────────────────────────────────
  {
    id: "lead-radar",
    emoji: "🎯",
    name: "Lead Radar",
    description: "Scans Twitter/LinkedIn/Reddit for people asking for AI automation help. Surfaces warm leads to Zico daily with context on their pain point.",
    schedule: "Daily 9 AM CST",
    category: "revenue",
    status: "proposed",
    owner: "elon",
    priority: 1,
  },
  {
    id: "pipeline-monitor",
    emoji: "📊",
    name: "Pipeline Monitor",
    description: "Tracks active client conversations in the CRM. Flags any prospect that's gone cold (no activity >3 days) and drafts a follow-up message for Zico's review.",
    schedule: "Daily 8 AM CST",
    category: "revenue",
    status: "proposed",
    owner: "elon",
    priority: 1,
  },
  {
    id: "proposal-generator",
    emoji: "📝",
    name: "Proposal Generator",
    description: "When Zico identifies a prospect, auto-drafts a custom proposal based on their industry + pain point. Sends draft to MC review queue before any client-facing send.",
    schedule: "On demand",
    category: "revenue",
    status: "proposed",
    owner: "elon",
    priority: 2,
  },
  // ── Infrastructure ────────────────────────────────────────────────────────
  {
    id: "workspace-git-backup",
    emoji: "💾",
    name: "Workspace Git Backup",
    description: "Auto-commits and pushes workspace changes every 6h. Prevents drift and ensures work survives Mac mini restarts.",
    schedule: "Every 6h",
    category: "infrastructure",
    status: "proposed",
    owner: "elon",
    priority: 1,
  },
  {
    id: "nightly-evolution",
    emoji: "🔧",
    name: "Nightly Evolution",
    description: "After nightly reflection, picks the single highest-leverage improvement and ships it autonomously (within defined scope). Reflection without action is wasted cycles.",
    schedule: "3 AM CST (after reflection)",
    category: "infrastructure",
    status: "proposed",
    owner: "both",
    priority: 1,
  },
  {
    id: "client-delivery-monitor",
    emoji: "🚀",
    name: "Client Delivery Monitor",
    description: "After any build ships, runs smoke tests and notifies client automatically. Tracks SLA — flags if 48h pass with no commit or update on an active engagement.",
    schedule: "Every 2h during active builds",
    category: "delivery",
    status: "proposed",
    owner: "elon",
    priority: 2,
  },
  // ── Intelligence ──────────────────────────────────────────────────────────
  {
    id: "advisory-board",
    emoji: "🏛️",
    name: "Advisory Board",
    description: "On-demand CFO/CMO/CTO/Growth/Legal/Coach personas consulted on business decisions. Structured prompt library routed through Athena. High leverage for Zico decisions.",
    schedule: "On demand",
    category: "intelligence",
    status: "proposed",
    owner: "athena",
    priority: 2,
  },
  {
    id: "social-radar",
    emoji: "📡",
    name: "Social Radar",
    description: "Monitors LinkedIn/Twitter/Reddit for ICP signals, competitor moves, and content opportunities relevant to Limitless Era.",
    schedule: "Daily 9 AM CST",
    category: "intelligence",
    status: "proposed",
    owner: "athena",
    priority: 3,
  },
  {
    id: "competitive-intel",
    emoji: "🔭",
    name: "Competitive Intel",
    description: "Weekly scan of what other AI automation agencies are shipping and pricing. Surfaces positioning gaps and opportunities.",
    schedule: "Weekly Monday 8 AM",
    category: "intelligence",
    status: "proposed",
    owner: "athena",
    priority: 3,
  },
  {
    id: "weekly-business-brief",
    emoji: "📈",
    name: "Weekly Business Brief",
    description: "Every Monday: revenue, pipeline state, active builds, what moved the needle last week, and the top priority for this week.",
    schedule: "Weekly Monday 7 AM",
    category: "intelligence",
    status: "proposed",
    owner: "both",
    priority: 2,
  },
];

const CATEGORY_META: Record<Workflow["category"], { label: string; color: string; icon: React.ReactNode }> = {
  revenue: { label: "Revenue", color: "#34d399", icon: <DollarSign size={14} /> },
  infrastructure: { label: "Infrastructure", color: "#60a5fa", icon: <Shield size={14} /> },
  intelligence: { label: "Intelligence", color: "#a78bfa", icon: <Brain size={14} /> },
  delivery: { label: "Delivery", color: "#f59e0b", icon: <Zap size={14} /> },
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatCronExpr(job: CronJob): string {
  if (job.schedule.kind === "cron" && job.schedule.expr) {
    return job.schedule.expr + (job.schedule.tz ? ` (${job.schedule.tz})` : "");
  }
  if (job.schedule.kind === "every" && job.schedule.everyMs) {
    const min = job.schedule.everyMs / 60000;
    if (min < 60) return `Every ${min}m`;
    return `Every ${min / 60}h`;
  }
  return job.schedule.kind;
}

export default function WorkflowsPage() {
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "proposed">("active");

  useEffect(() => {
    fetch("/api/cron")
      .then((r) => r.json())
      .then((data) => {
        setCronJobs(Array.isArray(data) ? data : data.jobs ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const activeWorkflows = cronJobs.filter((j) => j.enabled);
  const proposedByPriority = [...PROPOSED_WORKFLOWS].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));

  return (
    <div style={{ color: "var(--text-primary)", maxWidth: 1100 }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-heading)", letterSpacing: "-1px" }}>
          ⚙️ Workflows
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          Active automations running across Elon + Athena · {activeWorkflows.length} live · {PROPOSED_WORKFLOWS.length} proposed
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["active", "proposed"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 rounded text-sm font-medium transition-colors"
            style={{
              backgroundColor: activeTab === tab ? "var(--accent)" : "var(--card)",
              color: activeTab === tab ? "#fff" : "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            {tab === "active" ? `✅ Active (${activeWorkflows.length})` : `💡 Proposed (${PROPOSED_WORKFLOWS.length})`}
          </button>
        ))}
      </div>

      {/* Active Crons */}
      {activeTab === "active" && (
        <div>
          {loading ? (
            <p style={{ color: "var(--text-muted)" }}>Loading cron jobs…</p>
          ) : activeWorkflows.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No active cron jobs found.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {activeWorkflows.map((job) => {
                const hasError = (job.state.consecutiveErrors ?? 0) > 0;
                const lastStatus = job.state.lastRunStatus;
                return (
                  <div
                    key={job.id}
                    className="rounded-lg p-4"
                    style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                            {job.name}
                          </span>
                          <span
                            className="text-xs px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: job.agentId === "elon" ? "rgba(96,165,250,0.12)" : "rgba(167,139,250,0.12)",
                              color: job.agentId === "elon" ? "#60a5fa" : "#a78bfa",
                              border: `1px solid ${job.agentId === "elon" ? "rgba(96,165,250,0.3)" : "rgba(167,139,250,0.3)"}`,
                            }}
                          >
                            {job.agentId === "elon" ? "⚙️ Elon" : "🏛️ Athena"}
                          </span>
                          {hasError && (
                            <span className="text-xs px-2 py-0.5 rounded flex items-center gap-1" style={{ backgroundColor: "var(--error-bg)", color: "var(--error)" }}>
                              <AlertCircle size={10} /> {job.state.consecutiveErrors} error{(job.state.consecutiveErrors ?? 0) > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                            <Clock size={10} className="inline mr-1" />{formatCronExpr(job)}
                          </span>
                          {job.payload.timeoutSeconds && (
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                              timeout: {job.payload.timeoutSeconds}s
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {lastStatus && (
                          <span
                            className="text-xs px-2 py-1 rounded"
                            style={{
                              backgroundColor: lastStatus === "ok" ? "var(--success-bg)" : lastStatus === "error" ? "var(--error-bg)" : "var(--card-elevated)",
                              color: lastStatus === "ok" ? "var(--success)" : lastStatus === "error" ? "var(--error)" : "var(--text-muted)",
                            }}
                          >
                            {lastStatus === "ok" ? "✓ ok" : lastStatus === "error" ? "✗ error" : lastStatus}
                            {job.state.lastDurationMs ? ` · ${formatMs(job.state.lastDurationMs)}` : ""}
                          </span>
                        )}
                        {job.state.nextRunAtMs && (
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            next: {new Date(job.state.nextRunAtMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Proposed Workflows */}
      {activeTab === "proposed" && (
        <div>
          <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <p className="text-sm" style={{ color: "#f59e0b" }}>
              💡 These workflows are designed around the $1M revenue goal. P1 items directly drive pipeline. P2 items protect delivery quality and leverage intelligence. P3 items activate once first clients close.
            </p>
          </div>

          {/* Group by category */}
          {(["revenue", "infrastructure", "delivery", "intelligence"] as const).map((cat) => {
            const items = proposedByPriority.filter((w) => w.category === cat);
            if (items.length === 0) return null;
            const meta = CATEGORY_META[cat];
            return (
              <div key={cat} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ color: meta.color }}>{meta.icon}</span>
                  <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: meta.color }}>
                    {meta.label}
                  </h2>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((wf) => (
                    <div
                      key={wf.id}
                      className="rounded-lg p-4"
                      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-sm">{wf.emoji} {wf.name}</span>
                            <span
                              className="text-xs px-1.5 py-0.5 rounded font-mono"
                              style={{ backgroundColor: "var(--card-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                            >
                              P{wf.priority}
                            </span>
                            <span
                              className="text-xs px-2 py-0.5 rounded"
                              style={{
                                backgroundColor: wf.owner === "elon" ? "rgba(96,165,250,0.12)" : wf.owner === "athena" ? "rgba(167,139,250,0.12)" : "rgba(52,211,153,0.12)",
                                color: wf.owner === "elon" ? "#60a5fa" : wf.owner === "athena" ? "#a78bfa" : "#34d399",
                              }}
                            >
                              {wf.owner === "elon" ? "⚙️ Elon" : wf.owner === "athena" ? "🏛️ Athena" : "⚙️🏛️ Both"}
                            </span>
                          </div>
                          <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>{wf.description}</p>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            <Clock size={10} className="inline mr-1" />{wf.schedule}
                          </span>
                        </div>
                        <span
                          className="text-xs px-2 py-1 rounded flex-shrink-0"
                          style={{ backgroundColor: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}
                        >
                          Proposed
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
