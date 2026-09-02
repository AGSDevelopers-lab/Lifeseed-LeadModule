# Data Model — Prisma Schema (source of truth)

Single canonical data model spanning all 6 modules. This is the **most important file for Cursor**. Every code-generation prompt should reference `@data_model.md`.

## Entity map (high-level)

```
Site (WB, Telangana, future)
├── User (multi-role · role_assignments[])
├── Donor
│   ├── DonorConsent (Consent Module library)
│   ├── LabTest (TRF-triggered)
│   ├── Sample (Andrology output)
│   │   └── Vial (Cryostorage inventory)
│   └── DonationRecord (Phase 4 MRD)
├── Clinic (L1 / L2 · ART Act registered)
│   └── ClinicContract (financial model, payment terms, rate card)
├── Recipient / CommissioningCouple
│   └── RecipientPackage (Basic/Standard/Premium)
├── DRF (Donor Requisition Form) — the pull mechanism
│   └── DispatchOrder (state machine · 10 states)
│       └── Challan → Invoice → Payment
├── EmbryoCohort (per DRF · L2 tracking)
│   └── Embryo (per oocyte · Gardner grade)
├── Subscription (recurring · storage / engines / membership)
└── AuditLog (immutable · every write action)
```

## Prisma schema (paste into `prisma/schema.prisma` and iterate)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ===== FOUNDATIONAL =====

enum SiteCode {
  WB
  TG   // Telangana
  BD   // Bangladesh (future)
}

model Site {
  id           String    @id @default(cuid())
  code         SiteCode  @unique
  name         String
  gstin        String?   @unique
  address      String
  panNumber    String?
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())

  users        User[]
  donors       Donor[]
  clinics      Clinic[]
  samples      Sample[]
  drfs         DRF[]
  dispatches   DispatchOrder[]
  challans     Challan[]
  invoices     Invoice[]
}

// ===== USERS + RBAC =====

enum UserRole {
  DONOR
  RECIPIENT
  CLINIC_DOCTOR
  CLINIC_COORDINATOR
  CLINIC_NURSE
  CLINIC_ADMIN
  BANK_DONOR_COORD
  BANK_ANDROLOGY_TECH
  BANK_SR_ANDROLOGIST
  BANK_LAB_HEAD
  BANK_WITNESS
  BANK_CRYOBANK_TECH
  BANK_MATCHING_OPS
  BANK_CLINICAL_REVIEWER
  BANK_FINANCE
  BANK_CFO
  BANK_SITE_HEAD
  BANK_COMPLIANCE
  BANK_DISPATCH_COORD
  BANK_SITE_ADMIN
  BANK_SUPER_ADMIN
  L2_IVF_CLINICIAN
  L2_EMBRYOLOGIST
  L2_SR_EMBRYOLOGIST
  L2_LAB_HEAD
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  phone         String    @unique
  passwordHash  String?
  isActive      Boolean   @default(true)
  mfaEnabled    Boolean   @default(false)

  siteId        String?
  site          Site?     @relation(fields: [siteId], references: [id])

  clinicId      String?
  clinic        Clinic?   @relation(fields: [clinicId], references: [id])

  roles         UserRoleAssignment[]  // multi-role support
  auditLogs     AuditLog[]

  createdAt     DateTime  @default(now())
  lastLoginAt   DateTime?
}

model UserRoleAssignment {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  role      UserRole
  scopeType String?  // 'site' | 'clinic' | 'global'
  scopeId   String?  // ID of the scope entity
  grantedAt DateTime @default(now())
  grantedBy String?

  @@unique([userId, role, scopeType, scopeId])
}

// ===== DONOR =====

enum DonorType { SEMEN OOCYTE }
enum DonorStatus { PROSPECT ELIGIBLE ACTIVE DEFERRED REJECTED WITHDRAWN RETIRED SUSPENDED }

enum DonorPhase {
  P0_INTAKE
  P1_SCREENING
  P2_ACTIVE
  P3_DRF
  P4_OUTCOME
}

enum RejectionCode {
  REG_AGE
  REG_MAR
  REG_CHILD
  OPS_KYC
  OPS_DUP
  OPS_GEO
  WDR_VOL
  MED_INF
  MED_PHY
  GEN_HX
  SEROLOGY_POSITIVE
}

enum SampleType { REGULAR QUARANTINE }
enum SamplePriority { REGULAR URGENT }

model Donor {
  id              String        @id @default(cuid())
  donorCode       String        @unique  // D-{Site}-NNNNN
  type            DonorType
  siteId          String
  site            Site          @relation(fields: [siteId], references: [id])

  // Identity
  fullName        String
  dob             DateTime
  gender          String
  aadhaarHash     String?       @unique
  panMasked       String?
  phone           String
  email           String?
  addressLine     String?
  city            String?
  stateCode       String?
  pincode         String?

  // Marital + ART Act
  maritalStatus   String?
  hasLivingChild  Boolean?      // required TRUE for oocyte donors
  marriageCertUrl String?
  childCertUrl    String?

  // Status + tracking
  status          DonorStatus   @default(PROSPECT)
  phase           DonorPhase    @default(P0_INTAKE)
  rejectionCode   RejectionCode?
  passportIssuedAt DateTime?    // Donor Passport (post-eligibility)
  registryEntryId String?       // ART Act national registry ID
  cumulativePregnancies Int @default(0)  // ART Act §29 tracking
  bankPolicyCap   Int?          // e.g., 5 pregnancies
  deferredUntil   DateTime?
  outcomeNotes    String?

  // Screening
  bloodGroup      String?
  rhFactor        String?
  height          Int?
  weight          Int?
  bmi             Float?

  // Consent + audit
  consents        DonorConsent[]
  labTests        LabTest[]
  samples         Sample[]      @relation("SampleDonor")
  donations       DonationRecord[]
  auditLogs       AuditLog[]    @relation("AuditLogDonor")

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([status])
  @@index([type])
}

model DonorConsent {
  id            String   @id @default(cuid())
  donorId       String
  donor         Donor    @relation(fields: [donorId], references: [id])
  consentType   String   // REGISTRATION, PROCEDURE, GENETIC_COUNSELLING, DATA_SHARING, WITHDRAWAL, SPECIAL_*
  version       String   // versioned template
  contentHash   String   // hash of the consent document at time of signing
  signedAt      DateTime
  signedIp      String?
  videoUrl      String?  // video-witnessed consent
  witnesses     String[] // witness user IDs (2)
  revokedAt     DateTime?
}

model LabTest {
  id            String   @id @default(cuid())
  donorId       String
  donor         Donor    @relation(fields: [donorId], references: [id])
  testCode      String   // HIV_I_II, HBSAG, HCV, VDRL, HTLV, CMV_IGM, KARYOTYPE, DFI, MAR, DSDNA, SEMEN_CULTURE, ...
  requisitionSource String  // CLINIC | DOCTOR | RECIPIENT | AUTO_MANDATORY
  requisitionedBy String?
  result        String?  // NEG, POS, NORMAL, ABNORMAL, or numeric
  resultValue   Float?
  unit          String?
  reportUrl     String?
  performedAt   DateTime?
  createdAt     DateTime @default(now())
}

// ===== SAMPLE + VIAL (Andrology) =====

enum SampleGrade { A B C REJECTED }
enum SampleCategory { PREMIUM STANDARD ECONOMY }
enum SampleState {
  DRAFT
  ACCESSIONED
  ANALYZED
  PREP_DONE
  VIAL_CREATED
  CRYO_DONE
  QC_A5_PASS
  QC_A5_FAIL
  IN_QUARANTINE
  QUARANTINE_CLEARED
  IN_INVENTORY
  DISCARDED
}

model Sample {
  id              String        @id @default(cuid())
  sampleCode      String        @unique  // SMP-{PRM|STD|ECN}-YYMM-NNNNN
  donorId         String
  donor           Donor         @relation("SampleDonor", fields: [donorId], references: [id])
  siteId          String
  site            Site          @relation(fields: [siteId], references: [id])

  // Case flags (orthogonal)
  sampleType      SampleType    @default(QUARANTINE) // Regular vs Quarantine (release timing)
  priority        SamplePriority @default(REGULAR)   // Regular vs Urgent (SLA)

  // Accessioning
  collectionDate  DateTime
  collectionTime  String        // HH:MM
  abstinenceDays  Int
  collectionMethod String       @default("MASTURBATION")  // per WHO 6th
  collectionLocation String?
  notes           String?

  // Macroscopic
  appearance      String?
  liquefactionTimeMin Int?
  viscosity       String?
  volumeML        Float?
  ph              Float?
  colour          String?
  semenFructose   Float?
  odour           String?

  // Microscopic (WHO 6th)
  concentrationMPerML Float?
  totalSpermsMillion Float?      // auto = vol × conc
  progressiveMotilityPct Float?
  nonProgressiveMotilityPct Float?
  totalMotilityPct Float?        // auto = PR + NP
  immotilePct     Float?         // auto = 100 - Total
  rapidPRPct      Float?         // optional sub-category (WHO 5th continuity)
  slowPRPct       Float?         // optional
  totalMotileSpermsMillion Float? // auto = total × totalMotility/100
  totalRapidMotileSpermsMillion Float? // auto = total × rapidPR/100
  morphologyNormalPct Float?
  vitalityPct     Float?
  roundCellsPerML Int?
  agglutinationGrade String?
  aggregationGrade String?
  rbcPresent      Boolean?

  // Advanced tests
  dfiPct          Float?
  marTestPct      Float?
  dsDnaBreakPct   Float?
  semenCultureResult String?  // NEG | POS(organism, CFU)

  // Preparation
  prepMethod      String?      // DGC | SWIM_UP | DIRECT_WASH
  preppedAt       DateTime?
  postPrepMotilityPct Float?

  // Cryopreservation
  cryomedia       String?      // TYB_GLYCEROL | HSPM | SFM
  cryoProtocol    String?      // SLOW_LN2_VAPOR | PROGRAMMABLE_FREEZER
  cryoDate        DateTime?

  // Grading + Category
  grade           SampleGrade?
  category        SampleCategory?  // PREMIUM | STANDARD | ECONOMY

  // Video + QR
  analysisVideoUrl String?
  postThawVideoUrl String?
  qrPackUrl       String?

  // State machine
  state           SampleState   @default(DRAFT)
  quarantineStartDate DateTime?
  quarantineEndDate DateTime?
  postQuarantineSerologyPass Boolean?

  vials           Vial[]
  auditLogs       AuditLog[]    @relation("AuditLogSample")

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([state])
  @@index([donorId])
  @@index([sampleType, priority])
}

model Vial {
  id            String   @id @default(cuid())
  vialCode      String   @unique  // VIAL-{sampleCode}-NN
  sampleId      String
  sample        Sample   @relation(fields: [sampleId], references: [id])

  volumeML      Float    @default(0.5)

  // Storage location
  tankId        String
  tank          CryoTank @relation(fields: [tankId], references: [id])
  canisterCode  String
  rackCode      String
  positionCode  String?

  // State
  isReleased    Boolean  @default(false)  // released to allocation inventory
  releasedAt    DateTime?
  isDispensed   Boolean  @default(false)
  dispensedAt   DateTime?
  dispensedToDispatchId String?
  isDiscarded   Boolean  @default(false)
  discardedAt   DateTime?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([sampleId])
  @@index([tankId])
  @@index([isReleased, isDispensed])
}

model CryoTank {
  id            String    @id @default(cuid())
  tankCode      String    @unique  // TNK-{Site}-NN
  name          String    // Main-Dewar-A, Premium-Dewar-A, Quarantine-Dewar, ...
  location      String
  capacityCanisters Int
  temperatureC  Float     @default(-196)
  category      SampleCategory?  // optional tank-level category
  isQuarantine  Boolean   @default(false)

  vials         Vial[]
  createdAt     DateTime  @default(now())
}

// ===== CLINIC + CONTRACT =====

enum ClinicLevel { L1 L2 }
enum FinancialModel { A B C }  // A = recipient-direct, B = clinic-wholesale, C = hybrid

model Clinic {
  id              String    @id @default(cuid())
  clinicCode      String    @unique
  name            String
  level           ClinicLevel
  siteId          String
  site            Site      @relation(fields: [siteId], references: [id])
  artActRegistrationNumber String?
  artActRegistrationExpiryAt DateTime?
  gstin           String?
  panNumber       String?
  addressLine     String
  city            String
  stateCode       String
  pincode         String
  primaryContact  String
  primaryPhone    String
  primaryEmail    String

  contract        ClinicContract?
  users           User[]
  recipients      Recipient[]
  drfs            DRF[]
  dispatches      DispatchOrder[]

  createdAt       DateTime  @default(now())
}

model ClinicContract {
  id              String          @id @default(cuid())
  clinicId        String          @unique
  clinic          Clinic          @relation(fields: [clinicId], references: [id])
  financialModel  FinancialModel  @default(B)
  paymentTerms    String          @default("NET_30")  // PREPAID, NET_7, NET_15, NET_30, NET_45, NET_60, NET_90
  advancePolicy   String          @default("PAY_ON_INVOICE")  // PAY_ON_INVOICE, ADVANCE_SPLIT, PACKAGE_SPLIT
  advanceSplitPct Int?            // e.g. 40
  markupCapPct    Int?            // for Model B/C
  creditLimit     Decimal?  @db.Decimal(19, 4)
  badDebtThreshold Decimal? @db.Decimal(19, 4)
  escalationEmail String?
  courierVendor   String?
  isActive        Boolean         @default(true)
  contractStartAt DateTime
  contractEndAt   DateTime?
}

// ===== RECIPIENT =====

enum PackageTier { BASIC STANDARD PREMIUM }
enum SelectionMode { ANONYMOUS PROFILE_SELECT }

model Recipient {
  id              String    @id @default(cuid())
  recipientCode   String    @unique
  fullName        String
  partnerName     String?
  dob             DateTime?
  aadhaarHash     String?
  phone           String
  email           String
  addressLine     String?
  city            String?
  stateCode       String?
  pincode         String?

  clinicId        String
  clinic          Clinic    @relation(fields: [clinicId], references: [id])

  packageTier     PackageTier @default(BASIC)
  selectionMode   SelectionMode @default(ANONYMOUS)
  engineSubs      String[]  // array of engine SKU codes subscribed

  drfs            DRF[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

// ===== DRF (Donor Requisition Form) =====

enum DrfState {
  DRAFT
  SUBMITTED
  ACCEPTED
  REJECTED
  MATCHING
  MATCH_READY
  AWAITING_RECIPIENT_SELECTION
  ALLOCATED
  DISPATCHED
  IN_CYCLE
  CLOSED_OUTCOME
  CLOSED_NO_OUTCOME
  CANCELLED
}

model DRF {
  id              String    @id @default(cuid())
  drfNumber       String    @unique  // LIF-{ClinicCode}-DRF-YYMMDD-NNNN
  siteId          String
  site            Site      @relation(fields: [siteId], references: [id])
  clinicId        String
  clinic          Clinic    @relation(fields: [clinicId], references: [id])
  recipientId     String
  recipient       Recipient @relation(fields: [recipientId], references: [id])

  donorType       DonorType
  packageTier     PackageTier
  selectionMode   SelectionMode
  engineSubs      String[]
  clinicalIndication String?

  // Doctor sign
  doctorUserId    String?
  doctorArtActRegNumber String?
  doctorSignedAt  DateTime?

  // Financial model applied (from clinic contract at time of DRF)
  financialModelApplied FinancialModel

  state           DrfState  @default(DRAFT)
  submittedAt     DateTime?
  acceptedAt      DateTime?
  rejectedReason  String?

  // Allocation
  allocatedDonorId String?
  allocatedAt     DateTime?
  bidirectionalTagWrittenAt DateTime?

  // Cycle outcome
  outcomeType     String?   // BETA_HCG_POS, CLINICAL_PREGNANCY, LIVE_BIRTH, FAIL, LOSS
  outcomeReportedAt DateTime?

  dispatches      DispatchOrder[]
  cohort          EmbryoCohort?
  invoices        Invoice[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([state])
  @@index([clinicId])
}

// ===== DISPATCH =====

enum DispatchType {
  SEMEN_TAGGED
  SEMEN_UNTAGGED
  SEMEN_RETURN
  OOCYTE_DONOR_UNSTIM
  OOCYTE_DONOR_STIM
  OOCYTE_DONOR_RETURN
}

enum DispatchState {
  DRAFT
  BOOKED
  PICKED
  PACKED
  IN_TRANSIT
  DELIVERED
  RECEIVED
  TAGGED           // untagged only
  USED
  CLOSED
  CANCELLED
  EXCEPTION
  RETURNING
}

model DispatchOrder {
  id              String        @id @default(cuid())
  dispatchNumber  String        @unique  // LIF-{Site}-DSP-YYMMDD-NNNN
  siteId          String
  site            Site          @relation(fields: [siteId], references: [id])
  drfId           String?
  drf             DRF?          @relation(fields: [drfId], references: [id])
  clinicId        String
  clinic          Clinic        @relation(fields: [clinicId], references: [id])

  type            DispatchType
  state           DispatchState @default(DRAFT)

  vialIds         String[]      // for semen dispatch — vials included
  donorId         String?       // for oocyte donor dispatch

  courierVendor   String?
  courierTrackingId String?
  temperatureLogUrl String?
  podUrl          String?

  // For oocyte donor logistics
  travelMode      String?
  travelBookingRef String?
  accommodationRef String?
  escortUserId    String?

  packedAt        DateTime?
  dispatchedAt   DateTime?
  deliveredAt    DateTime?
  receivedAt     DateTime?

  challans        Challan[]
  invoices        Invoice[]

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([state])
  @@index([drfId])
}

// ===== BILLING (Challan → Invoice → Payment) =====

model SKU {
  id            String   @id @default(cuid())
  code          String   @unique  // SKU-SEM-VIAL, SKU-PKG-BASIC, etc.
  description   String
  type          String   // TXN | RECUR
  hsnSacCode    String
  gstRatePct    Decimal  @default(18) @db.Decimal(19, 4)
  revenueClass  String
  defaultPrice  Decimal  @db.Decimal(19, 4)
  isActive      Boolean  @default(true)
}

enum DocumentState { DRAFT ISSUED CANCELLED CONVERTED_TO_INVOICE }
enum InvoiceState { DRAFT ISSUED PARTIALLY_PAID PAID OVERDUE WRITTEN_OFF CANCELLED }
enum PaymentMode { UPI CARD NETBANKING WALLET EMI NEFT RTGS IMPS CASH CHEQUE }

model Challan {
  id            String        @id @default(cuid())
  challanNumber String        @unique  // LIF/{Site}/CHL/{FY}/{seq}
  siteId        String
  site          Site          @relation(fields: [siteId], references: [id])
  dispatchId    String
  dispatch      DispatchOrder @relation(fields: [dispatchId], references: [id])

  gstin         String        // seller GSTIN
  buyerType     String        // CLINIC | RECIPIENT
  buyerId       String

  totalValue    Decimal  @db.Decimal(19, 4)
  taxableValue  Decimal  @db.Decimal(19, 4)
  totalGst      Decimal  @db.Decimal(19, 4)
  totalWithGst  Decimal  @db.Decimal(19, 4)

  state         DocumentState @default(ISSUED)
  issuedAt      DateTime      @default(now())
  convertedToInvoiceAt DateTime?

  invoice       Invoice?      @relation("ChallanInvoice")

  lineItems     ChallanLineItem[]
}

model ChallanLineItem {
  id            String   @id @default(cuid())
  challanId     String
  challan       Challan  @relation(fields: [challanId], references: [id])
  skuCode       String
  description   String
  quantity      Decimal  @db.Decimal(19, 4)
  unitPrice     Decimal  @db.Decimal(19, 4)
  discount      Decimal  @default(0) @db.Decimal(19, 4)
  taxableValue  Decimal  @db.Decimal(19, 4)
  gstRatePct    Decimal  @db.Decimal(19, 4)
  igst          Decimal  @default(0) @db.Decimal(19, 4)
  cgst          Decimal  @default(0) @db.Decimal(19, 4)
  sgst          Decimal  @default(0) @db.Decimal(19, 4)
  lineTotal     Decimal  @db.Decimal(19, 4)
}

model Invoice {
  id            String        @id @default(cuid())
  invoiceNumber String        @unique  // LIF/{Site}/INV/{FY}/{seq}
  siteId        String
  site          Site          @relation(fields: [siteId], references: [id])
  parentChallanId String?     @unique
  parentChallan Challan?      @relation("ChallanInvoice", fields: [parentChallanId], references: [id])

  drfId         String?
  drf           DRF?          @relation(fields: [drfId], references: [id])
  dispatchId    String?
  dispatch      DispatchOrder? @relation(fields: [dispatchId], references: [id])

  gstin         String
  buyerType     String
  buyerId       String
  placeOfSupplyStateCode String

  totalValue    Decimal  @db.Decimal(19, 4)
  taxableValue  Decimal  @db.Decimal(19, 4)
  totalGst      Decimal  @db.Decimal(19, 4)
  totalWithGst  Decimal  @db.Decimal(19, 4)
  tdsAmount     Decimal  @default(0) @db.Decimal(19, 4)
  tcsAmount     Decimal  @default(0) @db.Decimal(19, 4)
  netPayable    Decimal  @db.Decimal(19, 4)

  paymentTerms  String
  dueDate       DateTime

  irn           String?  // e-invoicing IRN
  qrCodeUrl     String?

  state         InvoiceState  @default(ISSUED)
  issuedAt      DateTime      @default(now())
  paidAt        DateTime?

  lineItems     InvoiceLineItem[]
  payments      Payment[]
  creditNotes   CreditNote[]

  @@index([state])
  @@index([dueDate])
}

model InvoiceLineItem {
  id            String   @id @default(cuid())
  invoiceId     String
  invoice       Invoice  @relation(fields: [invoiceId], references: [id])
  skuCode       String
  description   String
  quantity      Decimal  @db.Decimal(19, 4)
  unitPrice     Decimal  @db.Decimal(19, 4)
  discount      Decimal  @default(0) @db.Decimal(19, 4)
  taxableValue  Decimal  @db.Decimal(19, 4)
  gstRatePct    Decimal  @db.Decimal(19, 4)
  igst          Decimal  @default(0) @db.Decimal(19, 4)
  cgst          Decimal  @default(0) @db.Decimal(19, 4)
  sgst          Decimal  @default(0) @db.Decimal(19, 4)
  lineTotal     Decimal  @db.Decimal(19, 4)
}

model Payment {
  id            String      @id @default(cuid())
  paymentNumber String      @unique
  invoiceId     String
  invoice       Invoice     @relation(fields: [invoiceId], references: [id])
  amount        Decimal     @db.Decimal(19, 4)
  mode          PaymentMode
  gateway       String?     // RAZORPAY | PAYU | BANK_DIRECT
  gatewayTxnId  String?
  paidAt        DateTime
  reconciledAt  DateTime?
  reconciliationLevel String? // L1_STRICT | L2_SOFT | L3_MANUAL
  bankRef       String?
}

model CreditNote {
  id            String   @id @default(cuid())
  creditNoteNumber String @unique  // LIF/{Site}/CN/{FY}/{seq}
  invoiceId     String
  invoice       Invoice  @relation(fields: [invoiceId], references: [id])
  amount        Decimal  @db.Decimal(19, 4)
  reasonCode    String   // AUTO_RULE_XXX | MANUAL_XXX
  reasonNote    String?
  approvedBy    String?  // user id if manual
  issuedAt      DateTime @default(now())
  refundInitiatedAt DateTime?
  refundCompletedAt DateTime?
}

// ===== SUBSCRIPTIONS =====

enum SubscriptionType { STORAGE_SEMEN STORAGE_EMBRYO STORAGE_OOCYTE ENGINE_PREMIUM CLINIC_MEMBERSHIP }
enum SubscriptionState { ACTIVE PAUSED CANCELLED }
enum BillingFrequency { MONTHLY QUARTERLY ANNUAL }

model Subscription {
  id            String            @id @default(cuid())
  type          SubscriptionType
  frequency     BillingFrequency
  skuCode       String
  subscriberType String           // CLINIC | RECIPIENT
  subscriberId  String
  state         SubscriptionState @default(ACTIVE)
  startedAt     DateTime          @default(now())
  nextBillDate  DateTime
  endedAt       DateTime?
  autoPayEnabled Boolean          @default(false)
  autoPayMandateId String?
  quantity      Int               @default(1)   // e.g., number of vials for storage
  unitAmount    Decimal           @db.Decimal(19, 4)
}

// ===== EMBRYOLOGY =====

enum OocyteMaturity { MII MI GV }
enum EmbryoDisposition { CULTURE VITRIFIED TRANSFERRED DISCARDED_ABNORMAL DISCARDED_ARREST }

model EmbryoCohort {
  id            String    @id @default(cuid())
  drfId         String    @unique
  drf           DRF       @relation(fields: [drfId], references: [id])
  opuAt         DateTime?
  totalOocytesRetrieved Int?
  mIICount      Int?
  clinicId      String
  embryos       Embryo[]
  createdAt     DateTime  @default(now())
}

model Embryo {
  id            String    @id @default(cuid())
  cohortId      String
  cohort        EmbryoCohort @relation(fields: [cohortId], references: [id])
  oocyteId      String    @unique  // OCT-YYMM-CCC-NN
  maturity      OocyteMaturity?
  day1TwoPN     Boolean?  // fertilization check
  day3CellCount Int?
  day3FragPct   Int?
  day3Grade     String?
  day5Gardner   String?   // e.g., 4AA
  pgtTriggered  Boolean   @default(false)
  pgtResult     String?   // EUPLOID | ANEUPLOID | MOSAIC
  disposition   EmbryoDisposition?
  vitrificationLoc String?
  transferAt    DateTime?
}

// ===== DONATION RECORD (Phase 4 MRD) =====

model DonationRecord {
  id            String   @id @default(cuid())
  donorId       String
  donor         Donor    @relation(fields: [donorId], references: [id])
  sampleId      String?
  drfId         String?
  outcomeType   String?  // LIVE_BIRTH, CLINICAL_PREGNANCY, FAIL, UNREPORTED
  outcomeReportedAt DateTime?
  registrySync  Boolean  @default(false)
  registrySyncedAt DateTime?
  createdAt     DateTime @default(now())
}

// ===== AUDIT + EVENTS =====

model AuditLog {
  id            String   @id @default(cuid())
  actorUserId   String?
  actor         User?    @relation(fields: [actorUserId], references: [id])
  action        String   // CREATE | READ_SENSITIVE | UPDATE | DELETE | STATE_TRANSITION | APPROVE
  entityType    String   // Donor, DRF, Sample, Invoice, etc.
  entityId      String
  beforeJson    Json?
  afterJson     Json?
  ipAddress     String?
  userAgent     String?
  timestamp     DateTime @default(now())
  hashChain     String?  // cryptographic chain for immutability

  donor         Donor?   @relation("AuditLogDonor", fields: [donorRelId], references: [id])
  donorRelId    String?
  sample        Sample?  @relation("AuditLogSample", fields: [sampleRelId], references: [id])
  sampleRelId   String?

  @@index([entityType, entityId])
  @@index([timestamp])
  @@index([actorUserId])
}

model EventEmission {
  id            String   @id @default(cuid())
  eventName     String   // challan.raised, invoice.raised, payment.collected, etc.
  payload       Json
  targetSystem  String?  // ZOHO_BOOKS, ZOHO_INVENTORY, ZOHO_CRM, INTERNAL
  emittedAt     DateTime @default(now())
  consumedAt    DateTime?
  consumerStatus String? // PENDING | SUCCESS | FAILED
  retryCount    Int      @default(0)

  @@index([eventName])
  @@index([consumerStatus])
}
```

## Key model conventions

1. **All IDs are cuid** (Prisma default `cuid()`) — Postgres-friendly, URL-safe, no auto-increment leakage.
2. **All timestamps are UTC** — display in local TZ at UI layer only.
3. **All money in Decimal** (`@db.Decimal(19, 4)` → Postgres `NUMERIC(19,4)`) — required for GST 3-way splits (IGST/CGST/SGST) + TDS/TCS. Never use Float for money. Lab/scientific measurements remain `Float`.
4. **All state fields are enums** — Prisma-typed, PostgreSQL enum-backed. Add new states via Prisma migration.
5. **Multi-tenancy via `siteId`** — every top-level record scoped to a Site. Enforce at middleware level via `session.siteId` filter.
6. **Audit trail** — every write action creates an AuditLog entry via a Prisma middleware. `hashChain` builds a Merkle chain per site for tamper-evidence.
7. **Events** — emitted to `EventEmission` table (internal event bus). Zoho consumer polls or webhook-listens at v1.1.
8. **PII hashing** — Aadhaar stored as hash + last-4 masked. Never store raw Aadhaar in DB.

## Cursor prompt to bootstrap the schema

```
Using @data_model.md, generate the initial prisma/schema.prisma file
+ generate migration + seed script with:
  - 2 Sites (WB, TG)
  - 3 example Clinics (2 L2, 1 L1)
  - 5 example Donors (3 semen, 2 oocyte)
  - 3 example Recipients
  - Full SKU catalogue from @06_billing_finance.md
```

Cursor will produce a working schema in ~30 seconds. Iterate from there.
