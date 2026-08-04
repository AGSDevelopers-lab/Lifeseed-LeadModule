# 06 · Billing & Finance

**Source:** `LifeSeed_ART_Billing_Finance.html v1`

Central billing engine. SetuAI-native in v1 with clean Zoho Books adapter interface (v1.1 integration deferred). Multi-GSTIN active day-1 (WB + Telangana). All revenue streams handled in one engine.

## 11 phases (B0–B10)

```
B0 · Master Data Setup          → GSTINs, CoA, Payment Terms, Advance Policy, Clinic Contracts
B1 · SKU Catalogue              → 17+ SKUs with HSN/SAC + tax rate + revenue class
B2 · Challan Lifecycle          → consumed from Dispatch (challan-first)
B3 · Invoice Lifecycle          → auto from Challan on Delivered · standalone service invoices · IRN e-invoicing
B4 · Payment Collection         → Razorpay + PayU + Bank direct · TDS + TCS
B5 · Bank Reconciliation        → 3-level auto-match (strict → soft → manual)
B6 · Refunds & Credit Notes     → Hybrid: 10 auto-refund rules + manual for exceptions
B7 · Recurring Subscriptions    → Storage + Engines + Membership
B8 · Dunning Workflow           → Payment-terms anchored (relative to Due Date, not fixed T+X from invoice)
B9 · GST Compliance             → GSTR-1 · GSTR-3B · IRN e-invoicing · TDS Form 26Q · TCS Form 27EQ
B10 · Financial Reports         → P&L multi-slice · AR aging · Collections · Forecast · Custom
```

## Payment models (Financial Model A/B/C) — per DRF, resolved from clinic contract

- **Model A** — Direct-to-Recipient · Bank invoices recipient
- **Model B** — Clinic-Markup Wholesale · Bank → Clinic (wholesale); Clinic → Recipient (markup)
- **Model C** — Hybrid Split · package/engines to recipient; donor material to clinic

## Advance payment policy (per contract, DRF-level override)

- **Pay-on-Invoice** (default for recipients) — 100% at Delivered state
- **Advance-Split** — X% at DRF creation + (100−X)% at Delivered (typical 40/60)
- **Package-Split** — package fee upfront at Phase 0 + dispatch fee at Delivered (2 invoices)

## SKU Catalogue (partial · see HTML for full 17-SKU list)

```
SKU-SEM-VIAL       Donor semen vial (0.5 mL)                       TXN     SAC 999319   18%   ₹15,000–45,000 (grade-tier)
SKU-OOC-COORD      Oocyte donor coordination (per cycle)           TXN     SAC 999319   18%   ₹60,000–1,20,000
SKU-PKG-BASIC      Recipient package · Basic                       TXN     SAC 999319   18%   ₹10,000
SKU-PKG-STD        Recipient package · Standard                    TXN     SAC 999319   18%   ₹25,000
SKU-PKG-PREM       Recipient package · Premium                     TXN     SAC 999319   18%   ₹50,000
SKU-ENG-FACE       Face Match engine (per case)                    TXN     SAC 998434   18%   ₹5,000
SKU-ENG-GEN        Genetic Compat engine (per case)                TXN     SAC 998434   18%   ₹8,000
SKU-ENG-SUB        Matching Engine Sub · Premium (annual)          RECUR   SAC 998434   18%   ₹2,00,000/yr
SKU-STOR-SEM       Storage · Semen vial (per vial/month)           RECUR   SAC 996729   18%   ₹200/vial/mo
SKU-STOR-EMB       Storage · Vitrified embryo (per unit/month)     RECUR   SAC 996729   18%   ₹400/unit/mo
SKU-STOR-OOC       Storage · Vitrified oocyte (per unit/month)     RECUR   SAC 996729   18%   ₹300/unit/mo
SKU-MEM-CLIN       Clinic annual membership                        RECUR   SAC 999599   18%   ₹1,00,000/yr
SKU-TRF-DFI        TRF · DFI test panel                            TXN     SAC 999312   18%   ₹3,500
SKU-TRF-MAR        TRF · MAR test panel                            TXN     SAC 999312   18%   ₹2,500
SKU-TRF-KAR        TRF · Karyotype panel                           TXN     SAC 999312   18%   ₹4,500
SKU-TRF-PGT        TRF · PGT-A per embryo                          TXN     SAC 999312   18%   ₹25,000/embryo
SKU-TRAV-OOC       Oocyte donor travel (pass-through + margin)     TXN     SAC 998554   18%   actual + margin
```

**HSN/SAC codes are indicative — require CA validation before go-live.**

## Numbering conventions

```
Challan     LIF/{Site}/CHL/{FY}/{seq}     e.g., LIF/WB/CHL/2526/000142
Invoice     LIF/{Site}/INV/{FY}/{seq}
Credit Note LIF/{Site}/CN/{FY}/{seq}
Payment     LIF/{Site}/PAY/{FY}/{seq}
Per-GSTIN sequential · reset annually (April 1)
```

## Refund rule library (hybrid — auto + manual)

```
Cycle cancel · pre-DRF-accept                    100%
Cycle cancel · pre-dispatch                       90%  (10% processing charge, site-config)
Cycle cancel · pre-stim                           80%
Cycle cancel · mid-stim                           50%
Cycle cancel · post-OPU pre-transfer              20%
Cycle cancel · post-transfer                       0%
Return material (unused vials)                    pro-rata (net of processing)
Quality issue (temp excursion) · pre-use         100%
Recipient withdrawal · post-selection pre-DRF     70%  (engine subs non-refundable)
Donor withdrawal · post-allocation               100%  (Bank at-fault)
```

Manual path for: quality disputes · donor-clinic-recipient conflicts · goodwill · legal-driven · anything outside rule library.

## Approval matrix (invoices · credit notes · refunds · write-offs)

```
Auto                    up to ₹1,00,000
Finance Manager         ₹1L – ₹5L
CFO / Site Head         ₹5L – ₹25L
Board / Two-person      > ₹25L

Special rules:
- Credit notes always require one tier higher than equivalent invoice
- Refunds > ₹5L auto-flag to CFO
- Write-offs > ₹1L always Board
```

## Dunning workflow (payment-terms anchored · relative to Due Date)

```
Due − 3 days      → Advance Reminder (WhatsApp + email)
Due Day           → Due-Today reminder (WhatsApp + email)
Due + 7 days      → Firm Reminder (CC to Finance + late-fee warning)
Due + 15 days     → Final Notice + Dispatch hold triggered (no new DRF fulfillment)
Due + 30 days    → Escalation to CFO + collections + contract review
Due + 60-90 days  → Bad Debt Provision candidate
```

**Timing + templates + escalation contacts all editable per site AND per clinic contract.**

## Bank reconciliation · 3-level auto-match

```
Level 1 · Strict    Invoice # in payment narration + amount exact → auto-reconcile
Level 2 · Soft      Amount exact + payer name fuzzy (Levenshtein >0.85) → 1-click confirm
Level 3 · Unmatched Manual assignment via reconciliation UI · reason coded
```

Payment gateway webhooks (Razorpay/PayU) + bank statement CSV/MT940 imports feed the match engine.

## Zoho Books Adapter Interface (v1.1 activation)

8 events all emitter-ready in v1:

```
challan.raised          → Zoho Books · Delivery Challan
invoice.raised          → Zoho Books · Invoice (with parent challan reference)
payment.collected       → Zoho Books · Customer Payment
credit_note.raised      → Zoho Books · Credit Note
subscription.created    → Zoho Subscriptions · Recurring Invoice
sku.created / updated   → Zoho Books · Item
customer.created        → Zoho Books · Contact
tds.deducted            → Zoho Books · TDS entry (via journal)
```

**Migration to Zoho (v1.1 activation):**
1. Bulk export SetuAI records → Zoho via API
2. Dual-write mode (SetuAI + Zoho both receive writes)
3. Reconciliation phase 30–60 days
4. Cutover · Zoho becomes system-of-record

Same adapter architecture supports Tally, QuickBooks, Xero as alternatives.

## Key API endpoints

```
POST   /api/challans                       → create (from Dispatch event)
POST   /api/invoices                       → create standalone service invoice
POST   /api/invoices/from-challan/:id      → convert Challan → Invoice (auto at Delivered)
POST   /api/payments                       → record payment
POST   /api/payments/webhook/razorpay      → Razorpay webhook consumer
POST   /api/payments/webhook/payu          → PayU webhook consumer
POST   /api/credit-notes                   → raise credit note (auto rule OR manual)
POST   /api/credit-notes/:id/approve       → approval matrix workflow
POST   /api/refunds/:id/initiate           → refund disbursement (via Razorpay/bank)

POST   /api/subscriptions                  → create recurring subscription
GET    /api/subscriptions/due-today        → daily cron for auto-billing

POST   /api/reconciliation/ingest          → daily bank statement ingest
GET    /api/reconciliation/pending         → Level 2/3 queue

GET    /api/reports/revenue                → P&L multi-slice
GET    /api/reports/ar-aging               → aged receivables buckets
GET    /api/reports/collections            → daily collections dashboard
GET    /api/reports/forecast               → pipeline-based revenue forecast

POST   /api/gst/gstr-1/compile             → monthly GSTR-1
POST   /api/gst/gstr-3b/compile            → monthly GSTR-3B
POST   /api/gst/tds/26q/compile            → quarterly Form 26Q
POST   /api/gst/tcs/27eq/compile           → quarterly Form 27EQ
POST   /api/gst/einvoice/generate          → IRN generation (when enabled)
```

## Acceptance criteria

- [ ] Multi-GSTIN active day-1: WB (state=WB) + Telangana (state=TG) with per-GSTIN invoice numbering
- [ ] Place-of-supply logic: intra-state = CGST+SGST · inter-state = IGST
- [ ] Challan auto-converts to Invoice on Dispatch Delivered state
- [ ] Payment link (Razorpay) INACTIVE on challan, ACTIVATES on invoice generation
- [ ] Refund rules editable per site + per clinic contract override
- [ ] Approval matrix enforced with role-scoped signatures
- [ ] Dunning timing anchored to Due Date (computed from Payment Terms), not fixed T+X
- [ ] Dispatch hold triggered at Due+15 days (blocks new DRF fulfillment for that clinic/recipient)
- [ ] Bank reconciliation: >90% auto-match target (Level 1 or Level 2)
- [ ] Recurring subscriptions auto-invoice on billing date (storage · engines · membership)
- [ ] Razorpay Subscriptions auto-pay via UPI AutoPay / card tokenization
- [ ] TDS auto-deducted on vendor payments (194J/I/C thresholds)
- [ ] TCS auto-added to invoice line once buyer crosses ₹50L in FY
- [ ] All events emitted to Zoho adapter (emitter ready, consumer OFF in v1)
- [ ] e-Invoicing IRN toggleable per site (activate when >₹5cr aggregate turnover)

## Cursor prompts (paste-ready)

```
1. Generate SKU · Challan · Invoice · Payment · CreditNote · Subscription · InvoiceLineItem
   Prisma models per @data_model.md.

2. Seed the SKU catalogue with the 17 SKUs from this spec.

3. Build src/lib/billing/gst.ts — GST computation service:
   - place-of-supply logic (state code from buyer)
   - CGST+SGST vs IGST split
   - HSN/SAC + rate lookup per SKU
   - line total + total invoice value

4. Build src/lib/billing/challan-to-invoice.ts — auto-conversion service.
   Called on DispatchState → Delivered event.
   Creates Invoice referencing parent Challan · activates payment link.

5. Build /api/payments/webhook/razorpay/route.ts — HMAC-verified webhook consumer.
   Creates Payment record · triggers reconciliation match.

6. Build src/lib/billing/reconciliation.ts — 3-level auto-match engine.

7. Build src/lib/billing/refund-rules.ts — rule engine with editable rule library.
   Manual credit note path with approval matrix routing.

8. Build src/lib/billing/dunning.ts — payment-terms-anchored reminder scheduler.
   Daily cron computes upcoming Due-3, Due-day, Due+7, Due+15 etc. per invoice.

9. Build src/lib/billing/subscriptions.ts — daily scheduler for recurring invoicing.
   Prorated first bills · auto-pay via Razorpay Subscriptions API.

10. Build src/app/(portals)/admin/billing/dashboard/page.tsx — Collections Dashboard
    with today's collections, MTD, DSO trend, reconciliation health, aged receivables.

11. Build src/app/(portals)/admin/billing/invoices/page.tsx — Invoice list
    with state filter, aging, action buttons (view, download PDF, remind, cancel).

12. Build src/app/(portals)/admin/config/skus/page.tsx — SKU editor.

13. Build src/app/(portals)/admin/config/dunning/page.tsx — Dunning timing editor per site + per clinic.

14. Build src/app/(portals)/admin/config/refund-rules/page.tsx — Refund rule library editor.
```
