# TypeScript 6.0 Migration Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade from TypeScript 5.6.3 to 6.0.3 (major version bump from Dependabot PR #486).

**Architecture:** Static analysis suggests the codebase is already compatible — all imports use `.js` extensions, no import assertions, no deprecated APIs. The main risk is stricter type checking and module resolution changes. Close the dependabot PR and do a clean upgrade.

**Tech Stack:** TypeScript 6.0.3, Node 24, ES modules

---

## Pre-flight Assessment

The codebase appears **already compatible** with TS 6.0 because:
- All imports use explicit `.js` extensions (required by `nodenext`)
- No `import ... assert` syntax
- No decorator metadata usage
- All type narrowing patterns are correct
- Single `@ts-ignore` in `search.ts:108` (pre-existing, not TS6-related)

## Task 1: Upgrade TypeScript

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json` (potentially)

- [ ] **Step 1: Close Dependabot PR #486**

The dependabot PR may have stale lockfile. Do a clean upgrade instead.

```bash
gh pr close 486 --comment "Doing a clean upgrade in a dedicated branch instead."
```

- [ ] **Step 2: Create branch and upgrade**

```bash
git checkout -b chore/typescript-6 main
pnpm add -D typescript@^6.0.3
```

- [ ] **Step 3: Try building**

```bash
pnpm build
```

If it succeeds, skip to Step 5. If not, catalog every error.

- [ ] **Step 4: Fix compilation errors (if any)**

Likely candidates based on TS 6.0 changes:
- **`moduleResolution`**: If TS 6.0 warns about `"node"`, switch to `"node16"` or `"nodenext"`
- **`module`**: If `"esnext"` causes issues, try `"node16"` or `"nodenext"`
- **Stricter type narrowing**: Fix any new type errors from improved control flow analysis
- **The `@ts-ignore` in search.ts:108**: May need to become `@ts-expect-error` with a specific error code

For each error: note file, line, error code, fix.

- [ ] **Step 5: Update tsconfig.json if needed**

If module resolution changes were needed, update:
```json
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext"
  }
}
```

- [ ] **Step 6: Run tests**

```bash
pnpm test
```

All existing tests must pass.

- [ ] **Step 7: Verify @types/node compatibility**

Current: `@types/node@^22.9.0`. May need to bump to `@types/node@^24` for Node 24 LTS type definitions.

```bash
pnpm add -D @types/node@^24
```

If `@types/node@24` doesn't exist yet, stay on 22.x (types lag behind releases).

- [ ] **Step 8: Commit**

```bash
git commit -m "chore: upgrade TypeScript from 5.6.3 to 6.0.3"
```

## Task 2: Verify CI

- [ ] **Step 1: Push and check CI**

Ensure the test workflow passes with TS 6.0.3. The `continue-on-error: true` on the build step in `.github/workflows/test.yml` should be reviewed — if TS 6.0 fixes the pre-existing Express 5 type errors, we can remove it.

- [ ] **Step 2: Create PR**

```bash
gh pr create --title "chore: upgrade TypeScript to 6.0" --body "..."
```
