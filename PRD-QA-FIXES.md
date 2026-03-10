# PRD: Mission Control QA Fixes

Fix all bugs from QA testing. Keep existing UI intact — surgical fixes only.

## Environment
- macOS (not Linux)
- Two OpenClaw instances: Athena (`~/.openclaw`) and Elon (`~/.openclaw-elon`)
- Next.js app at `/Users/zico/repos/mission-control`

## Tasks

- [ ] Fix /api/agents workspace path in `src/app/api/agents/route.ts` — code expects `agent.workspace` but OpenClaw stores it in `agents.defaults.workspace`. Get defaultWorkspace from `config.agents?.defaults?.workspace` and use `agent.workspace || defaultWorkspace` when mapping agents.

- [ ] Add multi-agent directory support in `src/app/api/agents/route.ts` — read OPENCLAW_DIRS env var (comma-separated), loop through each dir, read its openclaw.json, merge all agents into one list. Fallback to OPENCLAW_DIR if OPENCLAW_DIRS not set.

- [ ] Fix macOS disk stats parsing in `src/app/api/system/stats/route.ts` — detect `process.platform === 'darwin'` and use `df -g /` instead of `df -BG /`. Parse macOS output format correctly.

- [ ] Fix "Organigrama" text in `src/app/(dashboard)/agents/page.tsx` — find "Organigrama" string and replace with "Org Chart".

- [ ] Fix "TenacitOS" branding — search all files for "TenacitOS" string and replace with `process.env.NEXT_PUBLIC_APP_TITLE || 'Mission Control'`. Check layout files, header components, and page titles.

- [ ] Fix "Carlos" user profile — search all files for hardcoded "Carlos" name and replace with `process.env.NEXT_PUBLIC_OWNER_USERNAME || 'Admin'`. Check header/navbar components.

- [ ] Fix Tenacitas references — search all files for "Tenacitas" and replace with appropriate text. In dashboard page.tsx, change "Tenacitas agent activity" to "Limitless Era agent activity".

- [ ] Fix Spanish text in workflows page `src/app/(dashboard)/workflows/page.tsx` — translate all Spanish strings to English. Examples: "Tenacitas carga el skill" → "Loads the skill", "Comprueba si hay cambios" → "Checks for changes".

- [ ] Search entire codebase for any remaining Spanish text and translate to English.

## Verification

After completing all tasks, run `npm run build` to verify no TypeScript errors.

## Do NOT Change
- Overall UI design/layout
- Color scheme  
- Package dependencies
- Working features
