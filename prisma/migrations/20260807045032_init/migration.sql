-- CreateEnum
CREATE TYPE "SiteCode" AS ENUM ('WB', 'TG', 'BD');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('DONOR', 'RECIPIENT', 'CLINIC_DOCTOR', 'CLINIC_COORDINATOR', 'CLINIC_NURSE', 'CLINIC_ADMIN', 'BANK_DONOR_COORD', 'BANK_ANDROLOGY_TECH', 'BANK_SR_ANDROLOGIST', 'BANK_LAB_HEAD', 'BANK_WITNESS', 'BANK_CRYOBANK_TECH', 'BANK_MATCHING_OPS', 'BANK_CLINICAL_REVIEWER', 'BANK_FINANCE', 'BANK_CFO', 'BANK_SITE_HEAD', 'BANK_COMPLIANCE', 'BANK_DISPATCH_COORD', 'BANK_SITE_ADMIN', 'BANK_SUPER_ADMIN', 'L2_IVF_CLINICIAN', 'L2_EMBRYOLOGIST', 'L2_SR_EMBRYOLOGIST', 'L2_LAB_HEAD');

-- CreateEnum
CREATE TYPE "DonorType" AS ENUM ('SEMEN', 'OOCYTE');

-- CreateEnum
CREATE TYPE "DonorStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'DEFERRED', 'REJECTED', 'WITHDRAWN', 'RETIRED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SampleType" AS ENUM ('REGULAR', 'QUARANTINE');

-- CreateEnum
CREATE TYPE "SamplePriority" AS ENUM ('REGULAR', 'URGENT');

-- CreateEnum
CREATE TYPE "SampleGrade" AS ENUM ('A', 'B', 'C', 'REJECTED');

-- CreateEnum
CREATE TYPE "SampleCategory" AS ENUM ('PREMIUM', 'STANDARD', 'ECONOMY');

-- CreateEnum
CREATE TYPE "SampleState" AS ENUM ('DRAFT', 'ACCESSIONED', 'ANALYZED', 'PREP_DONE', 'VIAL_CREATED', 'CRYO_DONE', 'QC_A5_PASS', 'QC_A5_FAIL', 'IN_QUARANTINE', 'QUARANTINE_CLEARED', 'IN_INVENTORY', 'DISCARDED');

-- CreateEnum
CREATE TYPE "ClinicLevel" AS ENUM ('L1', 'L2');

-- CreateEnum
CREATE TYPE "FinancialModel" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "PackageTier" AS ENUM ('BASIC', 'STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "SelectionMode" AS ENUM ('ANONYMOUS', 'PROFILE_SELECT');

-- CreateEnum
CREATE TYPE "DrfState" AS ENUM ('DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'MATCHING', 'MATCH_READY', 'AWAITING_RECIPIENT_SELECTION', 'ALLOCATED', 'DISPATCHED', 'IN_CYCLE', 'CLOSED_OUTCOME', 'CLOSED_NO_OUTCOME', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DispatchType" AS ENUM ('SEMEN_TAGGED', 'SEMEN_UNTAGGED', 'SEMEN_RETURN', 'OOCYTE_DONOR_UNSTIM', 'OOCYTE_DONOR_STIM', 'OOCYTE_DONOR_RETURN');

-- CreateEnum
CREATE TYPE "DispatchState" AS ENUM ('DRAFT', 'BOOKED', 'PICKED', 'PACKED', 'IN_TRANSIT', 'DELIVERED', 'RECEIVED', 'TAGGED', 'USED', 'CLOSED', 'CANCELLED', 'EXCEPTION', 'RETURNING');

-- CreateEnum
CREATE TYPE "DocumentState" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED', 'CONVERTED_TO_INVOICE');

-- CreateEnum
CREATE TYPE "InvoiceState" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WRITTEN_OFF', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('UPI', 'CARD', 'NETBANKING', 'WALLET', 'EMI', 'NEFT', 'RTGS', 'IMPS', 'CASH', 'CHEQUE');

-- CreateEnum
CREATE TYPE "SubscriptionType" AS ENUM ('STORAGE_SEMEN', 'STORAGE_EMBRYO', 'STORAGE_OOCYTE', 'ENGINE_PREMIUM', 'CLINIC_MEMBERSHIP');

-- CreateEnum
CREATE TYPE "SubscriptionState" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "OocyteMaturity" AS ENUM ('MII', 'MI', 'GV');

-- CreateEnum
CREATE TYPE "EmbryoDisposition" AS ENUM ('CULTURE', 'VITRIFIED', 'TRANSFERRED', 'DISCARDED_ABNORMAL', 'DISCARDED_ARREST');

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "code" "SiteCode" NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "address" TEXT NOT NULL,
    "panNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "siteId" TEXT,
    "clinicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "scopeType" TEXT,
    "scopeId" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT,

    CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donor" (
    "id" TEXT NOT NULL,
    "donorCode" TEXT NOT NULL,
    "type" "DonorType" NOT NULL,
    "siteId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "aadhaarHash" TEXT,
    "panMasked" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "stateCode" TEXT,
    "pincode" TEXT,
    "maritalStatus" TEXT,
    "hasLivingChild" BOOLEAN,
    "marriageCertUrl" TEXT,
    "childCertUrl" TEXT,
    "status" "DonorStatus" NOT NULL DEFAULT 'PROSPECT',
    "rejectionCode" TEXT,
    "passportIssuedAt" TIMESTAMP(3),
    "registryEntryId" TEXT,
    "cumulativePregnancies" INTEGER NOT NULL DEFAULT 0,
    "bankPolicyCap" INTEGER,
    "bloodGroup" TEXT,
    "rhFactor" TEXT,
    "height" INTEGER,
    "weight" INTEGER,
    "bmi" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonorConsent" (
    "id" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "signedIp" TEXT,
    "videoUrl" TEXT,
    "witnesses" TEXT[],
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "DonorConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabTest" (
    "id" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "testCode" TEXT NOT NULL,
    "requisitionSource" TEXT NOT NULL,
    "requisitionedBy" TEXT,
    "result" TEXT,
    "resultValue" DOUBLE PRECISION,
    "unit" TEXT,
    "reportUrl" TEXT,
    "performedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sample" (
    "id" TEXT NOT NULL,
    "sampleCode" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "sampleType" "SampleType" NOT NULL DEFAULT 'QUARANTINE',
    "priority" "SamplePriority" NOT NULL DEFAULT 'REGULAR',
    "collectionDate" TIMESTAMP(3) NOT NULL,
    "collectionTime" TEXT NOT NULL,
    "abstinenceDays" INTEGER NOT NULL,
    "collectionMethod" TEXT NOT NULL DEFAULT 'MASTURBATION',
    "collectionLocation" TEXT,
    "notes" TEXT,
    "appearance" TEXT,
    "liquefactionTimeMin" INTEGER,
    "viscosity" TEXT,
    "volumeML" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "colour" TEXT,
    "semenFructose" DOUBLE PRECISION,
    "odour" TEXT,
    "concentrationMPerML" DOUBLE PRECISION,
    "totalSpermsMillion" DOUBLE PRECISION,
    "progressiveMotilityPct" DOUBLE PRECISION,
    "nonProgressiveMotilityPct" DOUBLE PRECISION,
    "totalMotilityPct" DOUBLE PRECISION,
    "immotilePct" DOUBLE PRECISION,
    "rapidPRPct" DOUBLE PRECISION,
    "slowPRPct" DOUBLE PRECISION,
    "totalMotileSpermsMillion" DOUBLE PRECISION,
    "totalRapidMotileSpermsMillion" DOUBLE PRECISION,
    "morphologyNormalPct" DOUBLE PRECISION,
    "vitalityPct" DOUBLE PRECISION,
    "roundCellsPerML" INTEGER,
    "agglutinationGrade" TEXT,
    "aggregationGrade" TEXT,
    "rbcPresent" BOOLEAN,
    "dfiPct" DOUBLE PRECISION,
    "marTestPct" DOUBLE PRECISION,
    "dsDnaBreakPct" DOUBLE PRECISION,
    "semenCultureResult" TEXT,
    "prepMethod" TEXT,
    "preppedAt" TIMESTAMP(3),
    "postPrepMotilityPct" DOUBLE PRECISION,
    "cryomedia" TEXT,
    "cryoProtocol" TEXT,
    "cryoDate" TIMESTAMP(3),
    "grade" "SampleGrade",
    "category" "SampleCategory",
    "analysisVideoUrl" TEXT,
    "postThawVideoUrl" TEXT,
    "qrPackUrl" TEXT,
    "state" "SampleState" NOT NULL DEFAULT 'DRAFT',
    "quarantineStartDate" TIMESTAMP(3),
    "quarantineEndDate" TIMESTAMP(3),
    "postQuarantineSerologyPass" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vial" (
    "id" TEXT NOT NULL,
    "vialCode" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "volumeML" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "tankId" TEXT NOT NULL,
    "canisterCode" TEXT NOT NULL,
    "rackCode" TEXT NOT NULL,
    "positionCode" TEXT,
    "isReleased" BOOLEAN NOT NULL DEFAULT false,
    "releasedAt" TIMESTAMP(3),
    "isDispensed" BOOLEAN NOT NULL DEFAULT false,
    "dispensedAt" TIMESTAMP(3),
    "dispensedToDispatchId" TEXT,
    "isDiscarded" BOOLEAN NOT NULL DEFAULT false,
    "discardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CryoTank" (
    "id" TEXT NOT NULL,
    "tankCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "capacityCanisters" INTEGER NOT NULL,
    "temperatureC" DOUBLE PRECISION NOT NULL DEFAULT -196,
    "category" "SampleCategory",
    "isQuarantine" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CryoTank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clinic" (
    "id" TEXT NOT NULL,
    "clinicCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "ClinicLevel" NOT NULL,
    "siteId" TEXT NOT NULL,
    "artActRegistrationNumber" TEXT,
    "artActRegistrationExpiryAt" TIMESTAMP(3),
    "gstin" TEXT,
    "panNumber" TEXT,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "primaryContact" TEXT NOT NULL,
    "primaryPhone" TEXT NOT NULL,
    "primaryEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicContract" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "financialModel" "FinancialModel" NOT NULL DEFAULT 'B',
    "paymentTerms" TEXT NOT NULL DEFAULT 'NET_30',
    "advancePolicy" TEXT NOT NULL DEFAULT 'PAY_ON_INVOICE',
    "advanceSplitPct" INTEGER,
    "markupCapPct" INTEGER,
    "creditLimit" DECIMAL(19,4),
    "badDebtThreshold" DECIMAL(19,4),
    "escalationEmail" TEXT,
    "courierVendor" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "contractStartAt" TIMESTAMP(3) NOT NULL,
    "contractEndAt" TIMESTAMP(3),

    CONSTRAINT "ClinicContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipient" (
    "id" TEXT NOT NULL,
    "recipientCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "partnerName" TEXT,
    "dob" TIMESTAMP(3),
    "aadhaarHash" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "addressLine" TEXT,
    "city" TEXT,
    "stateCode" TEXT,
    "pincode" TEXT,
    "clinicId" TEXT NOT NULL,
    "packageTier" "PackageTier" NOT NULL DEFAULT 'BASIC',
    "selectionMode" "SelectionMode" NOT NULL DEFAULT 'ANONYMOUS',
    "engineSubs" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DRF" (
    "id" TEXT NOT NULL,
    "drfNumber" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "donorType" "DonorType" NOT NULL,
    "packageTier" "PackageTier" NOT NULL,
    "selectionMode" "SelectionMode" NOT NULL,
    "engineSubs" TEXT[],
    "clinicalIndication" TEXT,
    "doctorUserId" TEXT,
    "doctorArtActRegNumber" TEXT,
    "doctorSignedAt" TIMESTAMP(3),
    "financialModelApplied" "FinancialModel" NOT NULL,
    "state" "DrfState" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "allocatedDonorId" TEXT,
    "allocatedAt" TIMESTAMP(3),
    "bidirectionalTagWrittenAt" TIMESTAMP(3),
    "outcomeType" TEXT,
    "outcomeReportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DRF_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchOrder" (
    "id" TEXT NOT NULL,
    "dispatchNumber" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "drfId" TEXT,
    "clinicId" TEXT NOT NULL,
    "type" "DispatchType" NOT NULL,
    "state" "DispatchState" NOT NULL DEFAULT 'DRAFT',
    "vialIds" TEXT[],
    "donorId" TEXT,
    "courierVendor" TEXT,
    "courierTrackingId" TEXT,
    "temperatureLogUrl" TEXT,
    "podUrl" TEXT,
    "travelMode" TEXT,
    "travelBookingRef" TEXT,
    "accommodationRef" TEXT,
    "escortUserId" TEXT,
    "packedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispatchOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SKU" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "hsnSacCode" TEXT NOT NULL,
    "gstRatePct" DECIMAL(19,4) NOT NULL DEFAULT 18,
    "revenueClass" TEXT NOT NULL,
    "defaultPrice" DECIMAL(19,4) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SKU_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challan" (
    "id" TEXT NOT NULL,
    "challanNumber" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "gstin" TEXT NOT NULL,
    "buyerType" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "totalValue" DECIMAL(19,4) NOT NULL,
    "taxableValue" DECIMAL(19,4) NOT NULL,
    "totalGst" DECIMAL(19,4) NOT NULL,
    "totalWithGst" DECIMAL(19,4) NOT NULL,
    "state" "DocumentState" NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "convertedToInvoiceAt" TIMESTAMP(3),

    CONSTRAINT "Challan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallanLineItem" (
    "id" TEXT NOT NULL,
    "challanId" TEXT NOT NULL,
    "skuCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unitPrice" DECIMAL(19,4) NOT NULL,
    "discount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "taxableValue" DECIMAL(19,4) NOT NULL,
    "gstRatePct" DECIMAL(19,4) NOT NULL,
    "igst" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "cgst" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "sgst" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "ChallanLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "parentChallanId" TEXT,
    "drfId" TEXT,
    "dispatchId" TEXT,
    "gstin" TEXT NOT NULL,
    "buyerType" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "placeOfSupplyStateCode" TEXT NOT NULL,
    "totalValue" DECIMAL(19,4) NOT NULL,
    "taxableValue" DECIMAL(19,4) NOT NULL,
    "totalGst" DECIMAL(19,4) NOT NULL,
    "totalWithGst" DECIMAL(19,4) NOT NULL,
    "tdsAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tcsAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "netPayable" DECIMAL(19,4) NOT NULL,
    "paymentTerms" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "irn" TEXT,
    "qrCodeUrl" TEXT,
    "state" "InvoiceState" NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "skuCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unitPrice" DECIMAL(19,4) NOT NULL,
    "discount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "taxableValue" DECIMAL(19,4) NOT NULL,
    "gstRatePct" DECIMAL(19,4) NOT NULL,
    "igst" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "cgst" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "sgst" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "gateway" TEXT,
    "gatewayTxnId" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "reconciledAt" TIMESTAMP(3),
    "reconciliationLevel" TEXT,
    "bankRef" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "creditNoteNumber" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "reasonNote" TEXT,
    "approvedBy" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refundInitiatedAt" TIMESTAMP(3),
    "refundCompletedAt" TIMESTAMP(3),

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "type" "SubscriptionType" NOT NULL,
    "frequency" "BillingFrequency" NOT NULL,
    "skuCode" TEXT NOT NULL,
    "subscriberType" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "state" "SubscriptionState" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextBillDate" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "autoPayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoPayMandateId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitAmount" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmbryoCohort" (
    "id" TEXT NOT NULL,
    "drfId" TEXT NOT NULL,
    "opuAt" TIMESTAMP(3),
    "totalOocytesRetrieved" INTEGER,
    "mIICount" INTEGER,
    "clinicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbryoCohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Embryo" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "oocyteId" TEXT NOT NULL,
    "maturity" "OocyteMaturity",
    "day1TwoPN" BOOLEAN,
    "day3CellCount" INTEGER,
    "day3FragPct" INTEGER,
    "day3Grade" TEXT,
    "day5Gardner" TEXT,
    "pgtTriggered" BOOLEAN NOT NULL DEFAULT false,
    "pgtResult" TEXT,
    "disposition" "EmbryoDisposition",
    "vitrificationLoc" TEXT,
    "transferAt" TIMESTAMP(3),

    CONSTRAINT "Embryo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationRecord" (
    "id" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "sampleId" TEXT,
    "drfId" TEXT,
    "outcomeType" TEXT,
    "outcomeReportedAt" TIMESTAMP(3),
    "registrySync" BOOLEAN NOT NULL DEFAULT false,
    "registrySyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hashChain" TEXT,
    "donorRelId" TEXT,
    "sampleRelId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventEmission" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "targetSystem" TEXT,
    "emittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),
    "consumerStatus" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EventEmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Site_code_key" ON "Site"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Site_gstin_key" ON "Site"("gstin");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "UserRoleAssignment_userId_role_scopeType_scopeId_key" ON "UserRoleAssignment"("userId", "role", "scopeType", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "Donor_donorCode_key" ON "Donor"("donorCode");

-- CreateIndex
CREATE UNIQUE INDEX "Donor_aadhaarHash_key" ON "Donor"("aadhaarHash");

-- CreateIndex
CREATE INDEX "Donor_status_idx" ON "Donor"("status");

-- CreateIndex
CREATE INDEX "Donor_type_idx" ON "Donor"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_sampleCode_key" ON "Sample"("sampleCode");

-- CreateIndex
CREATE INDEX "Sample_state_idx" ON "Sample"("state");

-- CreateIndex
CREATE INDEX "Sample_donorId_idx" ON "Sample"("donorId");

-- CreateIndex
CREATE INDEX "Sample_sampleType_priority_idx" ON "Sample"("sampleType", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "Vial_vialCode_key" ON "Vial"("vialCode");

-- CreateIndex
CREATE INDEX "Vial_sampleId_idx" ON "Vial"("sampleId");

-- CreateIndex
CREATE INDEX "Vial_tankId_idx" ON "Vial"("tankId");

-- CreateIndex
CREATE INDEX "Vial_isReleased_isDispensed_idx" ON "Vial"("isReleased", "isDispensed");

-- CreateIndex
CREATE UNIQUE INDEX "CryoTank_tankCode_key" ON "CryoTank"("tankCode");

-- CreateIndex
CREATE UNIQUE INDEX "Clinic_clinicCode_key" ON "Clinic"("clinicCode");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicContract_clinicId_key" ON "ClinicContract"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipient_recipientCode_key" ON "Recipient"("recipientCode");

-- CreateIndex
CREATE UNIQUE INDEX "DRF_drfNumber_key" ON "DRF"("drfNumber");

-- CreateIndex
CREATE INDEX "DRF_state_idx" ON "DRF"("state");

-- CreateIndex
CREATE INDEX "DRF_clinicId_idx" ON "DRF"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "DispatchOrder_dispatchNumber_key" ON "DispatchOrder"("dispatchNumber");

-- CreateIndex
CREATE INDEX "DispatchOrder_state_idx" ON "DispatchOrder"("state");

-- CreateIndex
CREATE INDEX "DispatchOrder_drfId_idx" ON "DispatchOrder"("drfId");

-- CreateIndex
CREATE UNIQUE INDEX "SKU_code_key" ON "SKU"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Challan_challanNumber_key" ON "Challan"("challanNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_parentChallanId_key" ON "Invoice"("parentChallanId");

-- CreateIndex
CREATE INDEX "Invoice_state_idx" ON "Invoice"("state");

-- CreateIndex
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentNumber_key" ON "Payment"("paymentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_creditNoteNumber_key" ON "CreditNote"("creditNoteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EmbryoCohort_drfId_key" ON "EmbryoCohort"("drfId");

-- CreateIndex
CREATE UNIQUE INDEX "Embryo_oocyteId_key" ON "Embryo"("oocyteId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "EventEmission_eventName_idx" ON "EventEmission"("eventName");

-- CreateIndex
CREATE INDEX "EventEmission_consumerStatus_idx" ON "EventEmission"("consumerStatus");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donor" ADD CONSTRAINT "Donor_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorConsent" ADD CONSTRAINT "DonorConsent_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTest" ADD CONSTRAINT "LabTest_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vial" ADD CONSTRAINT "Vial_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vial" ADD CONSTRAINT "Vial_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "CryoTank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clinic" ADD CONSTRAINT "Clinic_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicContract" ADD CONSTRAINT "ClinicContract_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipient" ADD CONSTRAINT "Recipient_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DRF" ADD CONSTRAINT "DRF_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DRF" ADD CONSTRAINT "DRF_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DRF" ADD CONSTRAINT "DRF_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchOrder" ADD CONSTRAINT "DispatchOrder_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchOrder" ADD CONSTRAINT "DispatchOrder_drfId_fkey" FOREIGN KEY ("drfId") REFERENCES "DRF"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchOrder" ADD CONSTRAINT "DispatchOrder_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challan" ADD CONSTRAINT "Challan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challan" ADD CONSTRAINT "Challan_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "DispatchOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallanLineItem" ADD CONSTRAINT "ChallanLineItem_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "Challan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_parentChallanId_fkey" FOREIGN KEY ("parentChallanId") REFERENCES "Challan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_drfId_fkey" FOREIGN KEY ("drfId") REFERENCES "DRF"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "DispatchOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmbryoCohort" ADD CONSTRAINT "EmbryoCohort_drfId_fkey" FOREIGN KEY ("drfId") REFERENCES "DRF"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Embryo" ADD CONSTRAINT "Embryo_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "EmbryoCohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationRecord" ADD CONSTRAINT "DonationRecord_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_donorRelId_fkey" FOREIGN KEY ("donorRelId") REFERENCES "Donor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_sampleRelId_fkey" FOREIGN KEY ("sampleRelId") REFERENCES "Sample"("id") ON DELETE SET NULL ON UPDATE CASCADE;
