# Codex Stall Prevention — Implementation Plan

**Date:** 2026-03-11
**Owner:** Elon
**Status:** In Progress

---

## Problem Statement

Codex stalls when PRDs lack specificity. Two incidents this week:
- Mar 10: 71+ min on QA fixes (0 commits)
- Mar 11: 765+ min on multi-agent Task 2 (0 commits)

Root cause: Vague task descriptions like "in `scanAllSkills()` and related functions" — Codex can't locate exact code.

---

## Implementation Plan

### 1. Prevention — PRD Template

**Location:** `/Users/zico/.openclaw-elon/workspace/TOOLS.md` (section: "Codex PRD Scoping Rules")

**Enforcement:** Pre-flight checklist before spawning Codex:

```bash
# MANDATORY before writing any Codex PRD task:

# 1. Find exact function location
grep -rn "function <name>" src/

# 2. Read 20 lines of context
sed -n '<start>,<end>p' <file>

# 3. Include in PRD:
#    - Exact file: src/lib/skill-parser.ts
#    - Exact function: export function scanAllSkills() (line 248)
#    - Before: [paste current 5-10 lines]
#    - After: [paste target 5-10 lines]
#    - Do NOT change: [list protected files]
```

**Timeline:** ✅ DONE (added to TOOLS.md 2026-03-11 16:07)

---

### 2. Detection — 30-Minute Rule

**Location:** `/Users/zico/.openclaw-elon/workspace/HEARTBEAT.md` (section: "Coding Session Completion")

**Check method:**
```bash
# In tmux session monitoring:
git log --oneline -1 --format="%ci"  # Get last commit timestamp
# If > 30 min ago AND session still running → STALLED
```

**Enforcement:** Every heartbeat checks active tmux coding sessions.

**Timeline:** ✅ DONE (already in HEARTBEAT.md)

---

### 3. Intervention — Kill + Rewrite

**Trigger:** Session running 30+ min with 0 new commits

**Action sequence:**
1. Kill tmux session: `tmux -S ~/.tmux/sock kill-session -t <name>`
2. Check git status: `git log --oneline -3 && git diff --stat`
3. Analyze what task was stuck on
4. Rewrite PRD with exact file/function/line/code
5. Restart session with improved PRD

**Automation:** Manual for now. Automated script would require:
- Cron job checking commit timestamps
- Auto-kill logic
- Slack/Discord notification

**Timeline:** 
- Manual intervention: ✅ DONE (documented in MEMORY.md)
- Automated script: P2 (not blocking, manual process works)

---

## Tracking

| Item | Status | Location |
|------|--------|----------|
| PRD template | ✅ Done | TOOLS.md |
| Detection rule | ✅ Done | HEARTBEAT.md |
| Manual intervention | ✅ Done | MEMORY.md |
| Automated intervention | 🔜 P2 | Future sprint |

---

## Success Metrics

- Zero Codex stalls lasting >30 min
- All PRDs include exact file/function/line references
- Intervention happens within 1 heartbeat cycle (15 min) of detection
