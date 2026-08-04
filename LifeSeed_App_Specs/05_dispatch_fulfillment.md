# 05 · Dispatch & Fulfillment

**Source:** `LifeSeed_ART_Dispatch_Fulfillment.html v1.1`

Handles all outbound + return movements. Semen vials (cold-chain LN2 dry-shipper) and Oocyte donors (passenger travel with Bank-arranged logistics). **Challan-first workflow** — mirrors LifeSeed's current Zoho Books practice.

## 6 dispatch types + 10-state machine

### Types

| Type | Direction | Trigger |
|---|---|---|
| SEMEN_TAGGED | Bank → Clinic | DRF Allocated |
| SEMEN_UNTAGGED | Bank → Clinic (bulk stock) | Clinic bulk-stock order |
| SEMEN_RETURN | Clinic → Bank | Unused / cancelled |
| OOCYTE_DONOR_UNSTIM | Bank → L2 (donor travels) | DRF Allocated |
| OOCYTE_DONOR_STIM | Bank → L1 → L2 (multi-leg donor travel) | R-2 cleared + selection at L1 |
| OOCYTE_DONOR_RETURN | L2 → Home | Post-OPU discharge |

### State machine

```
Draft → Booked → Picked → Packed → In-Transit → Delivered → Received →
   (Untagged only) Tagged → Used → Closed

Terminal branches: Cancelled · Exception · Returning
```

**State transition guarantees:**
- `Draft → Booked` — courier confirmed + pickup slot booked
- `Packed → In-Transit` — Delivery Challan raised in Zoho Books (`challan.raised` event)
- `Delivered` — Challan auto-converts to Tax Invoice (`invoice.raised` event) · payment link activates
- `Delivered → Received` — clinic staff scan + confirm quality
- `Tagged` (untagged only) — clinic assigns recipient via QR link
- `Used → Closed` — consumption event from clinic (or R-S6 in Pathway)

## 5-QR pack per vial (Tagged dispatch)

| # | Content | Auth |
|---|---|---|
| QR-1 | Donor details (non-identifying, respects photo config) | Recipient 2FA |
| QR-2 | Vial details · thaw instructions | Public |
| QR-3 | Pre + post-thaw video | Recipient + Clinic dual auth |
| QR-4 | Payment link (tokenized · activates on invoice) | Tokenized · optional 2FA |
| QR-5 | Recipient details (clinic cross-check only) | Clinic auth only |

**Untagged dispatch:** single "Tag Recipient" QR replaces the 5-pack. On scan, clinic uploads recipient data → reverse-tagging → 5-pack retroactively generated.

## Semen Tagged flow (ST-1 → ST-11)

```
ST-1  DRF Allocated + Dispatched (from Pathway)
ST-2  Book cold-chain courier (Vendor from clinic contract, override permitted, live tracking webhook subscribed)
ST-3  Vial retrieval from LN2 (2-witness, barcode scan)
ST-4  Pack in LN2 dry-shipper + temp datalogger armed + tamper seal + Zoho Inv outbound-transfer event
ST-5  Generate Top Sheet + 5-QR pack per vial
ST-6  Delivery Challan raised (payment routing pre-computed per Model A/B/C, but link INACTIVE)
ST-7  Handoff to courier + State: In-Transit (2-witness)
ST-8  Delivery + Portal-side receipt scan
ST-8b Auto-convert Challan → Tax Invoice · payment link ACTIVE
ST-9  Clinic Receipt confirmation + Bank sync (DRF → In-Cycle)
ST-10 Vial used in cycle (consumption event pushed to Bank)
ST-11 Dispatch Closed · outcome loop feeds Phase 4
```

## Semen Untagged flow (SU-1 → SU-7) · bulk stock

```
SU-1  Clinic Bulk Stock Order received
SU-2  Bank picks vials (matching engine against clinic filters; Sibling Check skipped until reverse-tagging)
SU-3  Pack + Top Sheet (basic donor summary only, no recipient details)
SU-4  Wholesale Delivery Challan (Model B default)
SU-5  Handoff to courier
SU-6  Clinic receives + stores in own dewar (Zoho Inv location update)
      → SU-6b at Delivered: Challan → Invoice (wholesale)
      → Later: case arrives at clinic → clinic scans "Tag Recipient" QR
        → Reverse-tagging: Bank creates retro-DRF with clinic+recipient linkage
        → Sibling Check runs · Bidirectional tag written
        → Recipient invoice raised per contracted financial model
SU-7  Vial state → Tagged → Used → Closed
```

## Semen Return flow (RM-1 → RM-6)

```
RM-1  Return trigger (cycle cancel, excess inventory, quality concern, Bank recall)
RM-2  Bank approves return + books reverse cold-chain
RM-3  Clinic-side retrieval + pack in LN2 dry-shipper (Bank supplies)
RM-4  Reverse transit (same tracking + temp SOP as outbound)
RM-5  Bank receipt + Quality inspection (accept back, quarantine for review, OR destroy)
RM-6  Restock OR Destroy · Zoho Inv + Books updated · Credit note if invoice paid
```

## Oocyte Donor Unstimulated flow (OU-1 → OU-8)

```
OU-1  DRF Allocated for direct-L2 model
OU-2  Bank books travel (train/flight per policy) + accommodation (2-3 nights) + escort (if clinical) · Zoho Books logs costs
OU-3  Generate Donor Dispatch Challan + KYC packet (full 15-field default)
OU-4  Donor exit from Bank · 2-witness handoff (identity via Aadhaar face-match)
OU-5  Donor in transit · Bank monitors via app + travel tracking
OU-6  L2 arrival · receipt handoff (named clinic clinician + coordinator, KYC verified, 2-witness both ends)
OU-7  Donor under L2 clinical care (Embryology E1-E2)
OU-8  Post-OPU discharge → triggers Return Leg
```

## Oocyte Donor Stimulated (multi-leg) flow

```
LEG 1: Bank → L1
  OS1-1  Donor Dispatch (unstimulated) to L1 · same SOP as OU-2 through OU-6
  OS1-2  L1 does final selection + Stimulation start · Pathway R-O5 fires at Day 5

Handoff decision: post-R-O6 (default) OR Day 6 (case-specific · admin-configurable)

LEG 2: L1 → L2
  OS2-1  Bank orchestrates urgent travel (same-day or next-morning) + adjusted accommodation
  OS2-2  L1 Clinical Handoff Packet (scans + hormonal + drug schedule + planned trigger timing)
  OS2-3  L2 receipt · continues Stim → Trigger → OPU (Embryology E1 → E2 → E3-E5 → E8)
  OS2-4  Post-OPU discharge → triggers Return Leg
```

## Donor Return Leg (DR-1 → DR-5)

```
DR-1  L2 discharge criteria met + notify Bank (OHSS-clear, discharge instructions delivered, F/U plan set)
DR-2  Bank medical review + escort decision (medical escort if OHSS-risk or clinical concern)
DR-3  Book return travel · Zoho Books logs
DR-4  Donor travels home · Bank monitors via app
DR-5  Donor home confirmation + F/U scheduled · triggers Phase 4 MRD + Quarterly Health Check
```

## Vendor management (admin-editable)

| Vendor | Type | Notes |
|---|---|---|
| Blue Dart Temperature Controlled | COLD-CHAIN | Metro preferred |
| Delhivery Special (Cold) | COLD-CHAIN | Tier-2/3 coverage |
| SpotOn Logistics | COLD-CHAIN | ART-experienced with LN2 |
| Vahan Air Express | COLD-CHAIN | Emergency same-day |
| IRCTC | TRAVEL | <500km train default |
| IndiGo / Air India via MMT API | TRAVEL | >500km flight default |
| Uber / Ola Enterprise | TRAVEL | Ground legs |
| Oyo / Treebo Corporate | TRAVEL | Accommodation near L2 |
| Twilio / Gupshup WhatsApp | COMMS | Notifications |

## Zoho hook events (all emitter-ready v1)

```
challan.raised                → Zoho Books · at ST-6 / SU-4
invoice.raised                → Zoho Books · at ST-8b (auto-conversion at Delivered)
payment.collected             → Zoho Books · from Razorpay webhook
credit_note.raised            → Zoho Books · at RM-6 or Cancelled-pre-Delivered

inventory.outbound_transfer   → Zoho Inventory · at ST-4 (Packed)
inventory.location_update     → Zoho Inventory · at ST-9 / SU-6 (Received)
inventory.consumed            → Zoho Inventory · at ST-10 (Used)
inventory.returned            → Zoho Inventory · at RM-6

crm.dispatch_created          → Zoho CRM · at ST-1
crm.state_transition          → Zoho CRM · every state change
crm.notification_sent         → Zoho CRM · every SMS/WhatsApp/Email

tracking.update               → Internal · every courier / travel update
```

## Incident response tree

| Code | Trigger | Response |
|---|---|---|
| TEMP-EXC | Cold-chain temp excursion | Vials quarantined on delivery pending investigation · QC-A7 in Dispatch triggered · Vendor SLA claim |
| COURIER-FAIL | Delayed / lost | Vendor escalation · backup courier booked · >72hr = presumed damaged, destroy + credit note + AE flag |
| DONOR-NOSHOW | Donor missed travel | Bank contacts · reschedules · if withdrawal → DRF cancel + recipient rematch |
| DONOR-DISTRESS | Distress button in transit | Bank 24/7 line engages · local medical assistance · Return-to-Bank leg replaces onward |
| CLINIC-REJECT | Clinic rejects on receipt | Vials return-to-Bank · investigation · recipient rematch if DRF-tagged |
| L1-L2-DELAY | L1→L2 handoff delayed | Time-critical · emergency travel + medical escort · L1 continues stim · >24hr = cycle cancel considered |
| RETURN-QC-FAIL | Return material fails Bank QC | Full credit note · provenance investigation |
| PAYMENT-FAIL | Payment fails / disputed | Zoho tracks · follow-up per contract · dispatch cannot progress past Delivered until cleared |

## Key API endpoints

```
POST   /api/dispatches                        → create Draft (from DRF Allocated OR bulk order)
POST   /api/dispatches/:id/book               → Draft → Booked (courier confirmed)
POST   /api/dispatches/:id/pick               → Booked → Picked (vial retrieval)
POST   /api/dispatches/:id/pack               → Picked → Packed (emit challan.raised)
POST   /api/dispatches/:id/handoff            → Packed → In-Transit
POST   /api/dispatches/:id/delivered          → In-Transit → Delivered (emit invoice.raised)
POST   /api/dispatches/:id/received           → Delivered → Received (clinic scan)
POST   /api/dispatches/:id/tag                → Untagged only: reverse-tag recipient
POST   /api/dispatches/:id/use                → Vial used in cycle
POST   /api/dispatches/:id/close              → Used → Closed
POST   /api/dispatches/:id/cancel             → Cancel from pre-Dispatched
POST   /api/dispatches/:id/exception          → Exception state (incident)
POST   /api/dispatches/:id/return-request     → Trigger Return Material flow

POST   /api/webhooks/couriers/bluedart        → tracking updates
POST   /api/webhooks/couriers/delhivery       → tracking updates
```

## Acceptance criteria

- [ ] Delivery Challan raised at ST-6 / SU-4 (state = Packed) · payment link inactive
- [ ] Challan auto-converts to Tax Invoice on Delivered state · payment link activates
- [ ] 5-QR pack generated per vial for Tagged dispatch
- [ ] Reverse-tagging works for Untagged bulk stock (retro-DRF + Sibling Check + retroactive 5-QR)
- [ ] Cold-chain temp datalogger tracked via courier webhook
- [ ] Oocyte donor logistics: Bank books travel + accommodation + escort (if clinical)
- [ ] Return leg auto-triggered on post-OPU discharge notification
- [ ] Return Material handling: reverse cold-chain + Bank QC inspection + restock/destroy
- [ ] Incident tree logs coded incidents with escalation contacts
- [ ] All state transitions emit events to `EventEmission` table

## Cursor prompts (paste-ready)

```
1. Generate DispatchOrder + Challan + Invoice + Payment Prisma models per @data_model.md.

2. Build src/lib/dispatch/stateMachine.ts — state transition service enforcing
   legal transitions per @05_dispatch_fulfillment.md · emits events.

3. Build src/lib/challan-to-invoice.ts — auto-conversion service:
   on DispatchState → Delivered, converts Challan to Invoice + activates payment link.

4. Build src/app/(portals)/admin/dispatch/page.tsx — Dispatch Queue Kanban
   grouped by state, filter by type.

5. Build src/app/(portals)/admin/dispatch/new/page.tsx — New Dispatch form
   with type selector, vial picker (semen) or donor picker (oocyte), courier selector.

6. Build src/app/(portals)/admin/dispatch/[id]/page.tsx — Dispatch detail with
   state timeline, action buttons per state, chain-of-custody log, tracking widget.

7. Build /api/webhooks/couriers/[vendor]/route.ts — courier tracking webhook consumer
   with HMAC signature verification.

8. Build QR pack generation service — 5 QRs per vial with tokenized URLs +
   auth requirements per activity.
```
