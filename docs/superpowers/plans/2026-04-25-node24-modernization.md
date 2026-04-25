# Node 24 Modernization Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace remaining legacy patterns with Node 24 native APIs.

**Architecture:** The codebase already migrated to Node 24 (PR #481). This plan covers the remaining opportunities: `Promise.withResolvers()` in 3 call sites, and `URL.parse()` which was already done in this session.

**Tech Stack:** Node 24 LTS, TypeScript, ES modules

---

## Summary

The codebase is **already well-modernized**. A thorough scan found:

| API | Status |
|-----|--------|
| `URL.parse()` | Already using (migrated this session) |
| `import.meta.dirname` | Already using (PR #481) |
| Native `fetch` | Already using (PR #481) |
| `--env-file` | PR #493 (draft) |
| `structuredClone()` | Not needed (no deep clone patterns) |
| `Map.groupBy()` | Used in ReSpec PR; not needed server-side |
| `Array.fromAsync()` | Not needed (`for await` is preferred) |
| `Promise.withResolvers()` | 3 call sites to modernize |

### Task 1: Promise.withResolvers() in background-task-queue.ts

**Files:**
- Modify: `utils/background-task-queue.ts:189` and `utils/background-task-queue.ts:227`

- [ ] **Step 1: Refactor worker message listener (line 189)**

Replace:
```typescript
return await new Promise<RetType>((resolve, reject) => {
  const listener = (response: Response) => { ... resolve/reject ... };
  this.worker.addListener("message", listener);
});
```
With:
```typescript
const { promise, resolve, reject } = Promise.withResolvers<RetType>();
const listener = (response: Response) => { ... resolve/reject ... };
this.worker.addListener("message", listener);
return promise;
```

- [ ] **Step 2: Refactor module registration (line 227)**

Same pattern — extract resolve/reject from the Promise constructor.

- [ ] **Step 3: Refactor sh.ts:34**

Same pattern in the `exec` wrapper.

- [ ] **Step 4: Build and test**

Run: `pnpm build && pnpm test`

- [ ] **Step 5: Commit**

```
git commit -m "refactor: use Promise.withResolvers() (Node 22+)"
```
