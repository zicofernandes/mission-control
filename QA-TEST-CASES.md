# Mission Control — QA Test Cases

**Generated:** 2026-03-10  
**Target:** All 20+ pages, all languages English, all data populated

---

## Critical Priority

### TC-C001: All UI text is English
- Navigate to every page
- Verify NO Spanish text anywhere
- Check: buttons, labels, descriptions, placeholders, error messages, tooltips

### TC-C002: Dashboard loads with data
- Login → Dashboard
- Verify: weather widget (Flower Mound TX), activity feed, system stats, quick links

### TC-C003: Agents page shows both agents
- Navigate to /agents
- Verify: Elon AND Athena appear
- Verify: Org chart shows both agents
- Config fix needed: OPENCLAW_DIR only reads Athena

### TC-C004: Office tab loads without error
- Navigate to /office
- Verify: 3D office renders
- Verify: No React errors in console
- Current: FAILING

---

## High Priority

### TC-H001: Activities page shows data
- Navigate to /activity
- Verify: Activity feed populated
- Verify: Heatmap renders

### TC-H002: Costs page shows data
- Navigate to /costs
- Verify: Token usage displayed
- Verify: Cost breakdown by agent/model
- May need: usage-tracking.db populated

### TC-H003: Skills page shows data
- Navigate to /skills
- Verify: Skills list populated from workspace

### TC-H004: Memory page shows BOTH agents
- Navigate to /memory
- Verify: Can switch between Elon and Athena
- Verify: Each agent's memory files visible

### TC-H005: Sessions page shows data
- Navigate to /sessions
- Verify: Session history from OpenClaw

### TC-H006: Cron page shows jobs
- Navigate to /cron
- Verify: Cron jobs listed
- Verify: Run history visible

### TC-H007: Files page works
- Navigate to /files
- Verify: Workspace files browsable
- Verify: Can view/edit files

---

## Medium Priority

### TC-M001: System page services accurate
- Navigate to /system
- Verify: Elon gateway shows active
- Verify: Athena gateway shows active
- Verify: qmd shows active
- Verify: Mission Control shows active
- Verify: Restart/Stop/Logs buttons work

### TC-M002: Settings page loads
- Navigate to /settings
- Verify: Settings form renders
- Verify: Save works

### TC-M003: Search works
- Navigate to /search
- Enter query
- Verify: Results returned

### TC-M004: Terminal page works
- Navigate to /terminal
- Verify: Terminal renders
- Verify: Shows output

### TC-M005: Analytics page loads
- Navigate to /analytics
- Verify: Charts render

### TC-M006: Calendar page loads
- Navigate to /calendar
- Verify: Calendar renders

### TC-M007: Reports page loads
- Navigate to /reports
- Verify: Reports list

### TC-M008: Git page loads
- Navigate to /git
- Verify: Git info displayed

### TC-M009: Workflows page loads
- Navigate to /workflows
- Verify: Workflows displayed
- Check for Spanish text

### TC-M010: Navigation sidebar works
- Click each nav item
- Verify: Correct page loads
- Verify: Active state shown

### TC-M011: Logout works
- Click logout
- Verify: Redirected to login
- Verify: Session cleared

---

## Known Issues to Fix

1. **Spanish text** — Multiple pages have Spanish (from Carlos's original)
2. **OPENCLAW_DIR** — Only reads `~/.openclaw` (Athena), needs multi-agent support for Elon at `~/.openclaw-elon`
3. **Office tab error** — React error, needs debugging
4. **Empty data** — Activities, Costs, Skills, Sessions need data sources wired
5. **usage-tracking.db** — May need to run collection script

---

## Config Requirements

For multi-agent support:
```env
OPENCLAW_DIR=/Users/zico/.openclaw
OPENCLAW_ELON_DIR=/Users/zico/.openclaw-elon
```

Or: App needs to scan both directories for agents.
