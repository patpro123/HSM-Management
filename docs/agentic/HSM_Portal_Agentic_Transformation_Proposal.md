# HSM Portal: Agentic Transformation Proposal

Oct 29, 2026 · Parthoprotim Mukherjee

> Converted from `HSM_Portal_Agentic_Transformation_Proposal.pdf` (8 pages). Two diagrams in the PDF (target architecture, approval flow) are described in text below. The proposal assumes a Supabase stack; the real stack differs, see `Stack differences` at the end.

## Summary

Turn the HSM portal into an agent-operated system where every button action becomes a typed tool, and an AI agent proposes actions that humans approve. The build is roughly 40–52 focused build days in total, with a usable in-portal MVP after 25–33 days. Model running cost is expected to stay low through tiered models and rules-first parsing.

Three ideas:

1. **One tool layer, two front ends.** Buttons and the agent call the same typed functions, so nothing is rebuilt.
2. **Propose, then approve.** The agent never writes directly. It creates pending proposals that the right human approves in one tap.
3. **Persona-scoped access.** Teacher, Head of School and Admin each get their own tools, data scope and approval authority, enforced in the database and not just in prompts.

## Goals and non-goals

The goal is for most routine portal work to be started by a message or a schedule, with a human approving anything that changes data.

**Goals**

- Let users act through chat, voice or WhatsApp instead of navigating screens.
- Keep a human in the loop for every write, with auto-execution only for proven low-risk actions.
- Add a Head of School role for operations and curriculum, while money stays with Admin.
- Keep fixed monthly cost near zero and model spend low.

**Non-goals (for now)**

- Replacing the existing UI. Buttons stay as the fallback and the audit-friendly path.
- Parent-facing agent. It fits the design but is a later phase.
- Fully autonomous actions on money or parent communication.

## Target architecture

Today the portal is a React/Vite front end on Supabase Postgres and Vercel, where each button calls its action directly. The change is to put a typed tool layer between the screens and the database, then add the agent as a second caller.

Both the buttons and the agent go through the tool layer, and the agent can only reach it through the proposal queue and a human approval.

*Diagram: target architecture, 4 channels, 1 gate, 1 tool layer.*

## Personas and permissions

Personas are permission scopes enforced in the tool layer and database, not prompt styles. The persona comes from the logged-in user or a verified WhatsApp number, never from what a message claims.

| | Teacher | Head of School | Admin |
|---|---|---|---|
| **Read scope** | Own students and classes | All students, teachers, classes, academic reports | Everything, including finance |

**Rules**

- Head of School owns operations and curriculum. Money matters need Admin approval. Any user with the existing admin role can approve on the owner's behalf. The audit log records the actual user, not just the role.
- Each persona session receives only its own tools and data. Fee data never enters a teacher's context.
- The agent has no separate super-admin mode. Anything it does for a user is bounded by what that user could do in the UI.
- A parent persona (read-mostly, can propose leave requests) can be added later using the same mechanism.

## Approval flow

The agent never writes directly. Every change becomes a pending proposal, and the action type decides who may approve it.

| | Teacher | Head of School | Admin |
|---|---|---|---|
| **Can propose** | Attendance, progress notes, reschedule and leave requests | Teacher assignments, class and batch changes, curriculum changes | Fee changes, refunds, parent communications, data corrections |
| **Can approve** | Nothing | Operational and curriculum actions | Everything, including money |
| **Blocked** | Fees, other teachers' data | Payments, bank and payout data | Nothing, but fully audited |

- Approval authority is checked again at execution time, so a Head of School approval of a money-flagged action fails even if the UI is bypassed. Money-flagged actions are never auto-promoted to run without approval.
- Other action types can earn auto-execution only after a track record, for example 50 approvals without edits, and every auto-executed action still lands in the audit log.

*Diagram: approval flow, 1 decision, 2 paths.*

## Input channels

All channels feed the same proposal queue, so approval and audit work identically whichever way a request arrives.

1. **WhatsApp.** Extend the existing pipeline so parsed messages from teachers become proposals instead of direct database calls.
2. **In-portal chat and voice.** Upgrade the planned Gemini Flash plus Web Speech assistant from answering questions to proposing actions, for example moving a class and drafting the parent notice.
3. **Scheduled agents.** Daily or twice-daily jobs that scan for overdue fees, attendance gaps, unmarked classes and expiring packages, and drop proposals into the queue.
4. **Document intake.** Payment screenshots and bank statement CSVs matched against pending fees, building on the payment reconciliation work.

**Agent interface.** The agent is one backend with two front ends, so the in-portal chat assistant and WhatsApp work side by side rather than one replacing the other. A proposal is created the same way from either channel, and the approver can act on it from the portal queue or, for low-risk items, from a WhatsApp reply. Money approvals stay in the portal so the approver sees the full amounts and context.

| | In-portal chat | WhatsApp |
|---|---|---|
| **Best for** | Admin and Head of School, approvals, anything with forms or lists | Teachers and later parents, quick everyday requests |
| **Strengths** | Rich approval cards, edit-before-approve, voice input, full context | Zero install, already in daily use, works on any phone |
| **Limits** | Needs login and an open portal | Plain text and simple buttons, weaker for review of long items |
| **Approvals** | All proposals, including money | Low-risk operational approvals by reply; money approvals open a portal link |

## Low-cost strategy

The design keeps model calls rare and cheap, and keeps fixed infrastructure close to zero.

- **Rules before LLM.** Keyword and pattern matching handles common messages such as absent, paid and reschedule at no cost. Only ambiguous messages reach a model.
- **Tiered models.** A cheap fast model (Gemini Flash or a Haiku-class model) does intent classification and extraction. A larger model is used only on low confidence or multi-step planning.
- **Small context.** Send a compact schema plus only the relevant student or class rows, and cache the static system prompt and schema.
- **Batched proactive jobs.** Run scheduled scans once or twice a day instead of on every event.
- **Existing hosting.** Supabase Edge Functions, pg_cron and Vercel serverless cover orchestration on the current stack.
- **WhatsApp hosting.** whatsapp-web.js needs an always-on process, which means a small VPS or spare machine. The official WhatsApp Cloud API avoids that and should be compared in Phase 5.

Running cost is expected to be small, roughly a few dollars to low tens of dollars a month for models at this scale, plus the optional VPS. This is an approximate figure from memory, to be replaced with measured token counts during Phase 3.

## Safety, audit and testing

Safety is enforced by the database and tool layer, so a manipulated prompt cannot exceed a user's rights.

- **Row-level security and scoped service roles** limit what the agent can read and write per persona.
- **Execution-time checks.** The approve endpoint verifies the approver's role against the action type's allowed approvers, so bypassing the UI does not help.
- **Append-only audit log** of every proposal, approval, rejection and execution, with the real user ID.
- **Idempotency keys** so a retried action never double-charges or double-messages.
- **Undo** for approved actions wherever the action allows it.
- **Red-team test set before launch:** a teacher claiming to be admin, a forwarded message carrying instructions, a teacher asking about another teacher's students, and attempts to trigger money actions through operational requests.

## Phased plan and effort estimate

The in-portal MVP (Phases 0–4) takes 25–33 focused build days; the full scope (Phases 0–7) takes 40–52. A focused build day means one person working a full day with AI coding assistance.

| Phase | Scope | Effort (days) | Depends on |
|---|---|---|---|
| 0. Roles and permissions | Add head_of_school role, action-type permission map, RLS updates | 3–4 | None |
| 1. Tool layer | Wrap existing UI actions (assumed 15–20) as typed, validated functions | 6–8 | Phase 0 |
| 2. Proposal queue | Pending-action table, approval UI, audit log, idempotency, money-impact splitting | 6–8 | Phases 0, 1 |
| 3. Agent core | Persona-scoped tool filtering, orchestration in Edge Functions, model tiering, confidence routing | 6–8 | Phases 1, 2 |
| 4. In-portal chat and voice | Upgrade existing assistant to propose actions, with approval cards in chat | 4–5 | Phase 3 |
| 5. WhatsApp channel | Route parsed messages into the proposal queue, verified-number persona mapping | 5–7 | Phase 3 |
| 6. Proactive agents | Fee follow-ups and attendance gaps first, about 2 days for each further agent | 5–6 | Phase 3 |
| 7. Testing and rollout | Red-team set, pilot with Head of School and one teacher, tuning, auto-promotion rules | 5–6 | All |
| **Total** | | **40–52** | |

**Milestones**

- After Phase 2: approvals work for manually created proposals, and Head of School can be onboarded.
- After Phase 4 (MVP): admin and Head of School can run the school through chat with approvals.
- After Phase 7: teachers can use WhatsApp and scheduled agents run daily.

**Calendar time.** At about 2 focused days a week alongside other commitments, the MVP lands in roughly 13–17 weeks and the full scope in 20–26 weeks. At 4 days a week, halve those.

**Assumptions.** These estimates assume the current codebase is reasonably modular and has 15–20 distinct user actions. Phase 1 is the biggest unknown and should be re-estimated after a short code audit.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Tool-layer refactor is larger than assumed | Schedule slips in Phase 1 | Short code audit first, then migrate actions in order of usage |
| Approval fatigue | Approvers rubber-stamp or ignore the queue | Batch low-risk items, auto-promote proven action types, never auto-promote money |
| Mis-parsed WhatsApp message | Wrong proposal reaches the queue | Confidence threshold, show the source message on every proposal, rules before LLM |
| whatsapp-web.js is unofficial | Possible number ban or breakage | Evaluate the official WhatsApp Cloud API before Phase 5 |
| Prompt injection via forwarded messages | Attempts to trigger unauthorized actions | Persona from verified identity, tool filtering, execution-time role checks |
| Model cost creep | Higher monthly spend | Per-persona token budgets, usage dashboard, cheap-model default |

## Open questions

1. Who are the day-one users of the agent: admin and Head of School only, or teachers too?
2. Which operation takes the most time today? That should be the first proactive agent.
3. Should admins be blocked from approving their own money proposals, or is a single-admin setup fine?
4. WhatsApp: keep whatsapp-web.js with a small VPS, or move to the official Cloud API?
5. Which approval actions, if any, may auto-execute after a track record, and what threshold?
6. Is a short code audit acceptable before committing to the Phase 1 estimate?

## Stack differences and decisions (added by Claude, not part of the PDF)

- **Real stack:** Express backend on Render, Neon Postgres, Vercel frontend, JWT with role checks in `backend-enroll/auth/rbacMiddleware.js`, `node-cron` schedulers, and the official Meta WhatsApp Cloud API webhook. There is no Supabase, Edge Functions, pg_cron or RLS, so "RLS" becomes the tool-layer and execution-time checks.
- **Open question 1, answered:** day-one users are admin, Head of School and teachers (teachers for attendance only, today only).
- **Open question 2, answered:** first scheduled agents are overdue-payment tracking and daily attendance-entry gaps.
- **Head of School** sees fee status but not revenue, finance or payouts.
- **Open question 3, current default:** self-approval is allowed but flagged; `PROPOSAL_BLOCK_SELF_APPROVAL=true` blocks it.
- **Progress** is tracked in the project memory file `hsm-agentic-layer-plan.md`, not here.
