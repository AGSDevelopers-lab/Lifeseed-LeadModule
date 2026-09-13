# Lead v2.1 · B12 Implementation Report

**Date:** 2026-09-13  
**Scope:** Mock-only real notification adapters, delivery webhooks, template seed structure, management UI/APIs  
**Status:** IMPLEMENTED + TESTED (lead unit suite) · live vendor **DEFERRED**

## Start

- Branch: `main`
- HEAD: `25b14ccf4d75050b648a44ae8cd363a784a1453a`

## Ending

Recorded in git after this report is committed (see `git log -1`).

## Classification

| Item | Status |
|---|---|
| NotificationPort + DNC-before-adapter | IMPLEMENTED / TESTED / VERIFIED (unit) |
| SMS-Magic / Resend / Meta adapters | IMPLEMENTED (mock HTTP) / TESTED |
| SMS-Magic official send URL | **DEFERRED / UNLOCKED** — official REST doc not retrievable without account; no URL locked; `SMS_MAGIC_SEND_URL` unset → no network |
| Delivery webhooks + signatures | IMPLEMENTED / TESTED (fixtures) |
| Per-channel flags default OFF | IMPLEMENTED / TESTED |
| Structural template seed | IMPLEMENTED (script + unit) · not applied to a live DB in this pass |
| Template + delivery-log APIs/UI | IMPLEMENTED / TESTED (API + RBAC unit) · UI not browser-verified (no auth session in this pass) |
| Live vendor calls / credentials / flag ON / sandbox / O-01 | **NOT AUTHORIZED / DEFERRED** |
| Idempotency-Key store | **NOT IMPLEMENTED** (out of scope) |
| Schema / new perms / new roles / lifecycle | **NOT IMPLEMENTED** (none required) |
| Push | **NOT AUTHORIZED** |

## Mock isolation

Adapter tests use `vi.fn` fetch and `*.test.invalid` / official URL **construction only**. Webhooks use fixture bodies. No SMS-Magic, Resend, or Meta network.
