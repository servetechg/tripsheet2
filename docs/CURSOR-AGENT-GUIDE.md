# Cursor agent guide — TripSheet

How to use Cursor agents efficiently in this repo so **fewer tokens** are spent per task, while getting **better, repeatable** results.

**Repo setup:** `AGENTS.md` · `.cursor/rules/` · `.cursor/skills/` (commit these with the project).

---

## 1. Benefits of agentic work

| Benefit | What it means for you |
|---------|------------------------|
| **Persistent context** | Rules + `AGENTS.md` load project facts without re-explaining the monorepo every chat. |
| **Scoped execution** | Agent edits files, runs tests, and fixes errors — you stay at the intent level. |
| **Repeatable quality** | Chapter test scripts (`test:rbac`, `test:drivers`, …) act as acceptance gates the agent runs after changes. |
| **Less copy-paste** | Agent reads the right service file directly instead of you pasting stacks into chat. |
| **Parallel exploration** | Agent can grep/read several files in one step; humans do that slowly. |
| **Skills = playbooks** | “Fix invite in incognito” follows `tripsheet-scoped-fix` instead of rediscovering tenant routing. |
| **Lower cost over time** | First task pays setup cost; later tasks reuse rules/skills → **much smaller** prompts and tool use. |

**Tradeoff:** Broad prompts (“improve the app”) burn tokens. Narrow prompts (“fix pending invite URL in `DriversTab.tsx`”) with `@` references are cheap and fast.

---

## 2. Cursor modes — when to use which

| Mode | Use for | Token impact |
|------|---------|--------------|
| **Ask** | “How does invite by-token work?” | Low — read-only |
| **Plan** | Large feature with trade-offs (new service, migration strategy) | Medium — design before code |
| **Agent** | Implement fix, add endpoint, update UI | Higher — use with scope |
| **Debug** | Reproduce with logs/stack traces | Medium — focused |

**Practice:** Ask first if unsure → Plan if multi-day → Agent for the actual diff.

---

## 3. Practices that save tokens

### 3.1 Prompt with anchors

**Bad (expensive):**
> Look at the whole backend and fix authentication.

**Good (cheap):**
> @backend/services/driver-service/src/invites/invites.service.ts Public GET by-token returns 404 for MKX pending invites. Tenant routing is on. Minimal fix + run test:auth:live or test:drivers.

Always attach:
- **@file** — exact file(s)
- **@folder** — e.g. `@backend/gateway/src/rbac` only when needed
- **@docs/AUTH-TESTING-GUIDE.md** — when testing auth, not all docs

### 3.2 One task per chat (or per agent turn)

Split:
1. “Add API endpoint” → new chat when done  
2. “Wire frontend” → separate prompt with `@frontend/...`

Avoid: design + implement + write docs + full regression in one message unless you need it.

### 3.3 Name the chapter or skill

Examples:
- “Use **tripsheet-chapter-work** for MDM broker picker bug”
- “**tripsheet-scoped-fix** — incognito invite 404”
- “Run **tripsheet-verify** after the change”

Project skills live in `.cursor/skills/` (team-shared).

### 3.4 Let rules do the repeating

`.cursor/rules/agent-efficiency.mdc` is **always on** — it tells the agent not to read `dist/`, not to explore the whole tree, and which **one** test command to run.

File-specific rules load only when you edit matching files:
- `backend-nest.mdc` → `backend/**/*.ts`
- `frontend-react.mdc` → `frontend/**/*.tsx`
- `testing-docs.mdc` → docs and test scripts

### 3.5 Prefer npm scripts over long manual test scripts

Point the agent at `docs/TESTING-GUIDES-INDEX.md` instead of retyping PowerShell.

### 3.6 Don’t paste huge logs

Paste **10–20 lines** around the error, or `@terminals/1.txt` if the agent can read the terminal file.

### 3.7 Commit rules with the repo

Teammates get the same efficient behavior without retraining the model in chat.

---

## 4. What we added to this project

```
tripsheet/
├── AGENTS.md                          # Agent entry map (ports, chapters, workflow)
├── docs/CURSOR-AGENT-GUIDE.md         # This file (for humans)
└── .cursor/
    ├── rules/
    │   ├── agent-efficiency.mdc       # Always apply — token discipline
    │   ├── backend-nest.mdc           # Backend patterns
    │   ├── frontend-react.mdc         # Frontend patterns
    │   └── testing-docs.mdc           # Tests & docs
    └── skills/
        ├── tripsheet-chapter-work/    # RBAC/auth/tenant/MDM/drivers
        ├── tripsheet-verify/          # Smallest test command
        └── tripsheet-scoped-fix/      # Single-bug workflow
```

---

## 5. Prompt templates (copy-paste)

### Fix a bug
```
@<file-with-bug>
Error: <exact message or 404/403>
Expected: <one sentence>
Use tripsheet-scoped-fix. Smallest diff. Run the one verify command from AGENTS.md.
```

### Add feature in a chapter
```
Chapter 6 drivers: add <feature> to @backend/services/driver-service/src/...
Follow patterns in @<similar-file>.tsx
Use tripsheet-chapter-work. Run npm run test:drivers only.
```

### Test only
```
Stack is up. Verify last change with tripsheet-verify — do not change code unless test fails.
```

### Review without coding
```
Ask mode: explain how @backend/gateway/src/tenant/tenant-resolver.middleware.ts
handles public /api/invites/by-token. No code changes.
```

---

## 6. What still costs tokens (avoid)

- “Read entire codebase and summarize”
- Multiple live test suites in one run (`test:rbac:all` + `test:drivers:all` + `test:auth:all`)
- Asking agent to write new long docs every session (point at existing TESTING-GUIDE)
- Leaving **`npm run start:dev`** running and also starting individual services on same ports
- Attaching 10 screenshots without saying which screen/URL failed

---

## 7. Suggested daily workflow

1. **Small fix:** Agent + `@file` + `tripsheet-scoped-fix` → one verify command  
2. **Feature slice:** Plan mode (optional) → Agent with `@folder` + chapter skill  
3. **Before PR:** You run one chapter test; CI runs broader checks  
4. **New teammate:** Read this guide + `AGENTS.md` + `docs/TESTING-GUIDES-INDEX.md`

---

## 8. Optional: personal skills

Built-in Cursor skills in `~/.cursor/skills-cursor/` (create-rule, create-skill, babysit, split-to-prs) are for **your machine**.  

Project skills in `.cursor/skills/` are for **TripSheet-specific** workflows and should stay in git.

---

**Related:** [TESTING-GUIDES-INDEX.md](./TESTING-GUIDES-INDEX.md) · [AGENTS.md](../AGENTS.md)
