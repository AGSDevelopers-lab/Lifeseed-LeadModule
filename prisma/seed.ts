/**
 * LifeSeed ART Bank — database seed
 * Source: LifeSeed_App_Specs/data_model.md + 06_billing_finance.md SKU catalogue
 *
 * Idempotent via upsert on unique business codes.
 * Run: npx prisma db seed
 */

import {
  ClinicLevel,
  DonorStatus,
  DonorType,
  FinancialModel,
  PackageTier,
  PrismaClient,
  SelectionMode,
  SiteCode,
  UserRole,
} from "@prisma/client";

import {
  bmiFrom,
  dobYearsAgo,
  hashSeedAadhaar,
  maskPan,
  money,
  seedEmail,
  seedPhone,
  utcDate,
} from "../src/lib/seed-helpers";

const prisma = new PrismaClient();

/** Full 17-SKU catalogue from 06_billing_finance.md (list prices / mid-range where ranged). */
const SKU_CATALOGUE = [
  {
    code: "SKU-SEM-VIAL",
    description: "Donor semen vial (0.5 mL)",
    type: "TXN",
    hsnSacCode: "999319",
    gstRatePct: money(18),
    revenueClass: "SEMEN_PRODUCT",
    defaultPrice: money(30000), // mid of ₹15,000–45,000 grade-tier
  },
  {
    code: "SKU-OOC-COORD",
    description: "Oocyte donor coordination (per cycle)",
    type: "TXN",
    hsnSacCode: "999319",
    gstRatePct: money(18),
    revenueClass: "OOCYTE_SERVICE",
    defaultPrice: money(90000), // mid of ₹60,000–1,20,000
  },
  {
    code: "SKU-PKG-BASIC",
    description: "Recipient package · Basic",
    type: "TXN",
    hsnSacCode: "999319",
    gstRatePct: money(18),
    revenueClass: "PACKAGE",
    defaultPrice: money(10000),
  },
  {
    code: "SKU-PKG-STD",
    description: "Recipient package · Standard",
    type: "TXN",
    hsnSacCode: "999319",
    gstRatePct: money(18),
    revenueClass: "PACKAGE",
    defaultPrice: money(25000),
  },
  {
    code: "SKU-PKG-PREM",
    description: "Recipient package · Premium",
    type: "TXN",
    hsnSacCode: "999319",
    gstRatePct: money(18),
    revenueClass: "PACKAGE",
    defaultPrice: money(50000),
  },
  {
    code: "SKU-ENG-FACE",
    description: "Face Match engine (per case)",
    type: "TXN",
    hsnSacCode: "998434",
    gstRatePct: money(18),
    revenueClass: "ENGINE",
    defaultPrice: money(5000),
  },
  {
    code: "SKU-ENG-GEN",
    description: "Genetic Compat engine (per case)",
    type: "TXN",
    hsnSacCode: "998434",
    gstRatePct: money(18),
    revenueClass: "ENGINE",
    defaultPrice: money(8000),
  },
  {
    code: "SKU-ENG-SUB",
    description: "Matching Engine Sub · Premium (annual)",
    type: "RECUR",
    hsnSacCode: "998434",
    gstRatePct: money(18),
    revenueClass: "ENGINE",
    defaultPrice: money(200000),
  },
  {
    code: "SKU-STOR-SEM",
    description: "Storage · Semen vial (per vial/month)",
    type: "RECUR",
    hsnSacCode: "996729",
    gstRatePct: money(18),
    revenueClass: "STORAGE",
    defaultPrice: money(200),
  },
  {
    code: "SKU-STOR-EMB",
    description: "Storage · Vitrified embryo (per unit/month)",
    type: "RECUR",
    hsnSacCode: "996729",
    gstRatePct: money(18),
    revenueClass: "STORAGE",
    defaultPrice: money(400),
  },
  {
    code: "SKU-STOR-OOC",
    description: "Storage · Vitrified oocyte (per unit/month)",
    type: "RECUR",
    hsnSacCode: "996729",
    gstRatePct: money(18),
    revenueClass: "STORAGE",
    defaultPrice: money(300),
  },
  {
    code: "SKU-MEM-CLIN",
    description: "Clinic annual membership",
    type: "RECUR",
    hsnSacCode: "999599",
    gstRatePct: money(18),
    revenueClass: "MEMBERSHIP",
    defaultPrice: money(100000),
  },
  {
    code: "SKU-TRF-DFI",
    description: "TRF · DFI test panel",
    type: "TXN",
    hsnSacCode: "999312",
    gstRatePct: money(18),
    revenueClass: "LAB_TEST",
    defaultPrice: money(3500),
  },
  {
    code: "SKU-TRF-MAR",
    description: "TRF · MAR test panel",
    type: "TXN",
    hsnSacCode: "999312",
    gstRatePct: money(18),
    revenueClass: "LAB_TEST",
    defaultPrice: money(2500),
  },
  {
    code: "SKU-TRF-KAR",
    description: "TRF · Karyotype panel",
    type: "TXN",
    hsnSacCode: "999312",
    gstRatePct: money(18),
    revenueClass: "LAB_TEST",
    defaultPrice: money(4500),
  },
  {
    code: "SKU-TRF-PGT",
    description: "TRF · PGT-A per embryo",
    type: "TXN",
    hsnSacCode: "999312",
    gstRatePct: money(18),
    revenueClass: "LAB_TEST",
    defaultPrice: money(25000),
  },
  {
    code: "SKU-TRAV-OOC",
    description: "Oocyte donor travel (pass-through + margin)",
    type: "TXN",
    hsnSacCode: "998554",
    gstRatePct: money(18),
    revenueClass: "TRAVEL",
    defaultPrice: money(15000), // base pass-through placeholder; margin applied at billing
  },
] as const;

async function upsertRole(
  userId: string,
  role: UserRole,
  scopeType: string,
  scopeId: string | null,
) {
  const existing = await prisma.userRoleAssignment.findFirst({
    where: { userId, role, scopeType, scopeId },
  });
  if (existing) return existing;

  return prisma.userRoleAssignment.create({
    data: { userId, role, scopeType, scopeId },
  });
}

async function upsertUser(input: {
  email: string;
  phone: string;
  siteId?: string | null;
  clinicId?: string | null;
  roles: Array<{ role: UserRole; scopeType: string; scopeId: string | null }>;
}) {
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      phone: input.phone,
      siteId: input.siteId ?? null,
      clinicId: input.clinicId ?? null,
      isActive: true,
    },
    create: {
      email: input.email,
      phone: input.phone,
      siteId: input.siteId ?? null,
      clinicId: input.clinicId ?? null,
      isActive: true,
      mfaEnabled: false,
    },
  });

  for (const r of input.roles) {
    await upsertRole(user.id, r.role, r.scopeType, r.scopeId);
  }

  return user;
}

async function main() {
  console.log("Seeding LifeSeed ART Bank…");

  // ── Sites ──────────────────────────────────────────────────────────────
  const siteWb = await prisma.site.upsert({
    where: { code: SiteCode.WB },
    update: {
      name: "LifeSeed ART Bank — Kolkata",
      gstin: "19AABCL0001A1Z5",
      address: "Salt Lake Sector V, Kolkata, West Bengal 700091",
      panNumber: "AABCL0001A",
      isActive: true,
    },
    create: {
      code: SiteCode.WB,
      name: "LifeSeed ART Bank — Kolkata",
      gstin: "19AABCL0001A1Z5",
      address: "Salt Lake Sector V, Kolkata, West Bengal 700091",
      panNumber: "AABCL0001A",
      isActive: true,
    },
  });

  const siteTg = await prisma.site.upsert({
    where: { code: SiteCode.TG },
    update: {
      name: "LifeSeed ART Bank — Hyderabad",
      gstin: "36AABCL0002A1Z5",
      address: "HITEC City, Madhapur, Hyderabad, Telangana 500081",
      panNumber: "AABCL0002A",
      isActive: true,
    },
    create: {
      code: SiteCode.TG,
      name: "LifeSeed ART Bank — Hyderabad",
      gstin: "36AABCL0002A1Z5",
      address: "HITEC City, Madhapur, Hyderabad, Telangana 500081",
      panNumber: "AABCL0002A",
      isActive: true,
    },
  });

  console.log(`  Sites: ${siteWb.code}, ${siteTg.code}`);

  // ── SKUs (17) ──────────────────────────────────────────────────────────
  for (const sku of SKU_CATALOGUE) {
    await prisma.sKU.upsert({
      where: { code: sku.code },
      update: {
        description: sku.description,
        type: sku.type,
        hsnSacCode: sku.hsnSacCode,
        gstRatePct: sku.gstRatePct,
        revenueClass: sku.revenueClass,
        defaultPrice: sku.defaultPrice,
        isActive: true,
      },
      create: {
        code: sku.code,
        description: sku.description,
        type: sku.type,
        hsnSacCode: sku.hsnSacCode,
        gstRatePct: sku.gstRatePct,
        revenueClass: sku.revenueClass,
        defaultPrice: sku.defaultPrice,
        isActive: true,
      },
    });
  }
  console.log(`  SKUs: ${SKU_CATALOGUE.length}`);

  // ── Clinics + contracts ────────────────────────────────────────────────
  const clinicKolIvf = await prisma.clinic.upsert({
    where: { clinicCode: "CLIN-WB-L2-001" },
    update: {
      name: "Kolkata IVF Centre",
      level: ClinicLevel.L2,
      siteId: siteWb.id,
      artActRegistrationNumber: "ART-WB-2023-0042",
      artActRegistrationExpiryAt: utcDate(2027, 3, 31),
      gstin: "19AABCK1111A1Z5",
      panNumber: "AABCK1111A",
      addressLine: "EM Bypass, Kasba",
      city: "Kolkata",
      stateCode: "WB",
      pincode: "700107",
      primaryContact: "Dr. Ananya Banerjee",
      primaryPhone: seedPhone("clinic-kol-ivf"),
      primaryEmail: seedEmail("ops.kolkata-ivf"),
    },
    create: {
      clinicCode: "CLIN-WB-L2-001",
      name: "Kolkata IVF Centre",
      level: ClinicLevel.L2,
      siteId: siteWb.id,
      artActRegistrationNumber: "ART-WB-2023-0042",
      artActRegistrationExpiryAt: utcDate(2027, 3, 31),
      gstin: "19AABCK1111A1Z5",
      panNumber: "AABCK1111A",
      addressLine: "EM Bypass, Kasba",
      city: "Kolkata",
      stateCode: "WB",
      pincode: "700107",
      primaryContact: "Dr. Ananya Banerjee",
      primaryPhone: seedPhone("clinic-kol-ivf"),
      primaryEmail: seedEmail("ops.kolkata-ivf"),
    },
  });

  await prisma.clinicContract.upsert({
    where: { clinicId: clinicKolIvf.id },
    update: {
      financialModel: FinancialModel.B,
      paymentTerms: "NET_30",
      advancePolicy: "PAY_ON_INVOICE",
      markupCapPct: 20,
      creditLimit: money(500000),
      isActive: true,
      contractStartAt: utcDate(2025, 4, 1),
    },
    create: {
      clinicId: clinicKolIvf.id,
      financialModel: FinancialModel.B,
      paymentTerms: "NET_30",
      advancePolicy: "PAY_ON_INVOICE",
      markupCapPct: 20,
      creditLimit: money(500000),
      isActive: true,
      contractStartAt: utcDate(2025, 4, 1),
    },
  });

  const clinicHydFert = await prisma.clinic.upsert({
    where: { clinicCode: "CLIN-TG-L2-001" },
    update: {
      name: "Hyderabad Fertility",
      level: ClinicLevel.L2,
      siteId: siteTg.id,
      artActRegistrationNumber: "ART-TG-2024-0018",
      artActRegistrationExpiryAt: utcDate(2027, 6, 30),
      gstin: "36AABCH2222A1Z5",
      panNumber: "AABCH2222A",
      addressLine: "Road No. 36, Jubilee Hills",
      city: "Hyderabad",
      stateCode: "TG",
      pincode: "500033",
      primaryContact: "Dr. Sravani Reddy",
      primaryPhone: seedPhone("clinic-hyd-fert"),
      primaryEmail: seedEmail("ops.hyd-fertility"),
    },
    create: {
      clinicCode: "CLIN-TG-L2-001",
      name: "Hyderabad Fertility",
      level: ClinicLevel.L2,
      siteId: siteTg.id,
      artActRegistrationNumber: "ART-TG-2024-0018",
      artActRegistrationExpiryAt: utcDate(2027, 6, 30),
      gstin: "36AABCH2222A1Z5",
      panNumber: "AABCH2222A",
      addressLine: "Road No. 36, Jubilee Hills",
      city: "Hyderabad",
      stateCode: "TG",
      pincode: "500033",
      primaryContact: "Dr. Sravani Reddy",
      primaryPhone: seedPhone("clinic-hyd-fert"),
      primaryEmail: seedEmail("ops.hyd-fertility"),
    },
  });

  await prisma.clinicContract.upsert({
    where: { clinicId: clinicHydFert.id },
    update: {
      financialModel: FinancialModel.A,
      paymentTerms: "PREPAID",
      advancePolicy: "PACKAGE_SPLIT",
      advanceSplitPct: 40,
      creditLimit: money(0),
      isActive: true,
      contractStartAt: utcDate(2025, 4, 1),
    },
    create: {
      clinicId: clinicHydFert.id,
      financialModel: FinancialModel.A,
      paymentTerms: "PREPAID",
      advancePolicy: "PACKAGE_SPLIT",
      advanceSplitPct: 40,
      creditLimit: money(0),
      isActive: true,
      contractStartAt: utcDate(2025, 4, 1),
    },
  });

  const clinicKolPrimary = await prisma.clinic.upsert({
    where: { clinicCode: "CLIN-WB-L1-001" },
    update: {
      name: "Kolkata Primary Care",
      level: ClinicLevel.L1,
      siteId: siteWb.id,
      artActRegistrationNumber: "ART-WB-2022-0091",
      artActRegistrationExpiryAt: utcDate(2026, 12, 31),
      gstin: "19AABCP3333A1Z5",
      panNumber: "AABCP3333A",
      addressLine: "Gariahat Road, Ballygunge",
      city: "Kolkata",
      stateCode: "WB",
      pincode: "700019",
      primaryContact: "Dr. Ritwik Ghosh",
      primaryPhone: seedPhone("clinic-kol-primary"),
      primaryEmail: seedEmail("ops.kolkata-primary"),
    },
    create: {
      clinicCode: "CLIN-WB-L1-001",
      name: "Kolkata Primary Care",
      level: ClinicLevel.L1,
      siteId: siteWb.id,
      artActRegistrationNumber: "ART-WB-2022-0091",
      artActRegistrationExpiryAt: utcDate(2026, 12, 31),
      gstin: "19AABCP3333A1Z5",
      panNumber: "AABCP3333A",
      addressLine: "Gariahat Road, Ballygunge",
      city: "Kolkata",
      stateCode: "WB",
      pincode: "700019",
      primaryContact: "Dr. Ritwik Ghosh",
      primaryPhone: seedPhone("clinic-kol-primary"),
      primaryEmail: seedEmail("ops.kolkata-primary"),
    },
  });

  await prisma.clinicContract.upsert({
    where: { clinicId: clinicKolPrimary.id },
    update: {
      financialModel: FinancialModel.B,
      paymentTerms: "NET_15",
      advancePolicy: "PAY_ON_INVOICE",
      markupCapPct: 15,
      creditLimit: money(200000),
      isActive: true,
      contractStartAt: utcDate(2025, 4, 1),
    },
    create: {
      clinicId: clinicKolPrimary.id,
      financialModel: FinancialModel.B,
      paymentTerms: "NET_15",
      advancePolicy: "PAY_ON_INVOICE",
      markupCapPct: 15,
      creditLimit: money(200000),
      isActive: true,
      contractStartAt: utcDate(2025, 4, 1),
    },
  });

  console.log("  Clinics: Kolkata IVF Centre, Hyderabad Fertility, Kolkata Primary Care");

  // ── Users + RBAC ───────────────────────────────────────────────────────
  await upsertUser({
    email: seedEmail("superadmin"),
    phone: seedPhone("superadmin"),
    siteId: null,
    roles: [
      { role: UserRole.BANK_SUPER_ADMIN, scopeType: "global", scopeId: null },
    ],
  });

  await upsertUser({
    email: seedEmail("sr.andrologist.wb"),
    phone: seedPhone("sr-andro-wb"),
    siteId: siteWb.id,
    roles: [
      {
        role: UserRole.BANK_SR_ANDROLOGIST,
        scopeType: "site",
        scopeId: siteWb.id,
      },
    ],
  });

  await upsertUser({
    email: seedEmail("labhead.wb"),
    phone: seedPhone("labhead-wb"),
    siteId: siteWb.id,
    roles: [
      { role: UserRole.BANK_LAB_HEAD, scopeType: "site", scopeId: siteWb.id },
    ],
  });

  await upsertUser({
    email: seedEmail("sr.andrologist.tg"),
    phone: seedPhone("sr-andro-tg"),
    siteId: siteTg.id,
    roles: [
      {
        role: UserRole.BANK_SR_ANDROLOGIST,
        scopeType: "site",
        scopeId: siteTg.id,
      },
    ],
  });

  await upsertUser({
    email: seedEmail("labhead.tg"),
    phone: seedPhone("labhead-tg"),
    siteId: siteTg.id,
    roles: [
      { role: UserRole.BANK_LAB_HEAD, scopeType: "site", scopeId: siteTg.id },
    ],
  });

  // L2 clinic staff — Kolkata IVF
  await upsertUser({
    email: seedEmail("doctor.kolkata-ivf"),
    phone: seedPhone("doctor-kol-ivf"),
    siteId: siteWb.id,
    clinicId: clinicKolIvf.id,
    roles: [
      {
        role: UserRole.CLINIC_DOCTOR,
        scopeType: "clinic",
        scopeId: clinicKolIvf.id,
      },
    ],
  });

  await upsertUser({
    email: seedEmail("coord.kolkata-ivf"),
    phone: seedPhone("coord-kol-ivf"),
    siteId: siteWb.id,
    clinicId: clinicKolIvf.id,
    roles: [
      {
        role: UserRole.CLINIC_COORDINATOR,
        scopeType: "clinic",
        scopeId: clinicKolIvf.id,
      },
    ],
  });

  // L2 clinic staff — Hyderabad Fertility
  await upsertUser({
    email: seedEmail("doctor.hyd-fertility"),
    phone: seedPhone("doctor-hyd-fert"),
    siteId: siteTg.id,
    clinicId: clinicHydFert.id,
    roles: [
      {
        role: UserRole.CLINIC_DOCTOR,
        scopeType: "clinic",
        scopeId: clinicHydFert.id,
      },
    ],
  });

  await upsertUser({
    email: seedEmail("coord.hyd-fertility"),
    phone: seedPhone("coord-hyd-fert"),
    siteId: siteTg.id,
    clinicId: clinicHydFert.id,
    roles: [
      {
        role: UserRole.CLINIC_COORDINATOR,
        scopeType: "clinic",
        scopeId: clinicHydFert.id,
      },
    ],
  });

  console.log("  Users: 1 super admin + 4 bank + 4 clinic");

  // ── Donors (5) ─────────────────────────────────────────────────────────
  const donors = [
    {
      donorCode: "D-WB-00001",
      type: DonorType.SEMEN,
      siteId: siteWb.id,
      fullName: "Arijit Chatterjee",
      gender: "M",
      status: DonorStatus.ACTIVE,
      passportIssuedAt: utcDate(2025, 11, 12, 10, 30),
      city: "Kolkata",
      stateCode: "WB",
      pincode: "700019",
      bloodGroup: "B",
      rhFactor: "POSITIVE",
      height: 175,
      weight: 72,
      maritalStatus: "MARRIED",
      hasLivingChild: true,
      age: 32,
    },
    {
      donorCode: "D-WB-00002",
      type: DonorType.SEMEN,
      siteId: siteWb.id,
      fullName: "Sourav Mukherjee",
      gender: "M",
      status: DonorStatus.ACTIVE,
      passportIssuedAt: utcDate(2026, 1, 8, 9, 0),
      city: "Howrah",
      stateCode: "WB",
      pincode: "711101",
      bloodGroup: "O",
      rhFactor: "POSITIVE",
      height: 178,
      weight: 76,
      maritalStatus: "UNMARRIED",
      hasLivingChild: false,
      age: 28,
    },
    {
      donorCode: "D-TG-00001",
      type: DonorType.SEMEN,
      siteId: siteTg.id,
      fullName: "Venkatesh Rao",
      gender: "M",
      status: DonorStatus.ACTIVE,
      passportIssuedAt: utcDate(2025, 9, 20, 11, 15),
      city: "Hyderabad",
      stateCode: "TG",
      pincode: "500081",
      bloodGroup: "A",
      rhFactor: "POSITIVE",
      height: 172,
      weight: 68,
      maritalStatus: "MARRIED",
      hasLivingChild: true,
      age: 30,
    },
    {
      donorCode: "D-WB-00003",
      type: DonorType.OOCYTE,
      siteId: siteWb.id,
      fullName: "Priyanka Sen",
      gender: "F",
      status: DonorStatus.ACTIVE,
      passportIssuedAt: utcDate(2026, 2, 14, 14, 0),
      city: "Kolkata",
      stateCode: "WB",
      pincode: "700029",
      bloodGroup: "AB",
      rhFactor: "NEGATIVE",
      height: 162,
      weight: 58,
      maritalStatus: "MARRIED",
      hasLivingChild: true, // ART Act — required TRUE for oocyte donors
      age: 27,
    },
    {
      donorCode: "D-TG-00002",
      type: DonorType.OOCYTE,
      siteId: siteTg.id,
      fullName: "Lakshmi Narayana",
      gender: "F",
      status: DonorStatus.DEFERRED,
      passportIssuedAt: null as Date | null,
      city: "Secunderabad",
      stateCode: "TG",
      pincode: "500003",
      bloodGroup: "B",
      rhFactor: "POSITIVE",
      height: 158,
      weight: 55,
      maritalStatus: "MARRIED",
      hasLivingChild: true,
      age: 29,
      rejectionCode: null as string | null,
    },
  ];

  for (const d of donors) {
    await prisma.donor.upsert({
      where: { donorCode: d.donorCode },
      update: {
        type: d.type,
        siteId: d.siteId,
        fullName: d.fullName,
        dob: dobYearsAgo(d.age),
        gender: d.gender,
        aadhaarHash: hashSeedAadhaar(d.donorCode),
        panMasked: maskPan(d.donorCode),
        phone: seedPhone(d.donorCode),
        email: seedEmail(d.donorCode.toLowerCase()),
        addressLine: `${d.city} residence`,
        city: d.city,
        stateCode: d.stateCode,
        pincode: d.pincode,
        maritalStatus: d.maritalStatus,
        hasLivingChild: d.hasLivingChild,
        status: d.status,
        passportIssuedAt: d.passportIssuedAt,
        bloodGroup: d.bloodGroup,
        rhFactor: d.rhFactor,
        height: d.height,
        weight: d.weight,
        bmi: bmiFrom(d.height, d.weight),
        bankPolicyCap: d.type === DonorType.SEMEN ? 5 : 1,
      },
      create: {
        donorCode: d.donorCode,
        type: d.type,
        siteId: d.siteId,
        fullName: d.fullName,
        dob: dobYearsAgo(d.age),
        gender: d.gender,
        aadhaarHash: hashSeedAadhaar(d.donorCode),
        panMasked: maskPan(d.donorCode),
        phone: seedPhone(d.donorCode),
        email: seedEmail(d.donorCode.toLowerCase()),
        addressLine: `${d.city} residence`,
        city: d.city,
        stateCode: d.stateCode,
        pincode: d.pincode,
        maritalStatus: d.maritalStatus,
        hasLivingChild: d.hasLivingChild,
        status: d.status,
        passportIssuedAt: d.passportIssuedAt,
        bloodGroup: d.bloodGroup,
        rhFactor: d.rhFactor,
        height: d.height,
        weight: d.weight,
        bmi: bmiFrom(d.height, d.weight),
        bankPolicyCap: d.type === DonorType.SEMEN ? 5 : 1,
        cumulativePregnancies: 0,
      },
    });
  }

  console.log("  Donors: 3 semen ACTIVE + 1 oocyte ACTIVE + 1 oocyte DEFERRED");

  // ── Recipients (3) ─────────────────────────────────────────────────────
  const recipients = [
    {
      recipientCode: "R-WB-00001",
      fullName: "Meera Das",
      partnerName: "Arnab Das",
      clinicId: clinicKolIvf.id,
      packageTier: PackageTier.BASIC,
      selectionMode: SelectionMode.ANONYMOUS,
      city: "Kolkata",
      stateCode: "WB",
      pincode: "700017",
      age: 34,
    },
    {
      recipientCode: "R-TG-00001",
      fullName: "Anusha Reddy",
      partnerName: "Karthik Reddy",
      clinicId: clinicHydFert.id,
      packageTier: PackageTier.STANDARD,
      selectionMode: SelectionMode.PROFILE_SELECT,
      city: "Hyderabad",
      stateCode: "TG",
      pincode: "500034",
      age: 31,
      engineSubs: ["SKU-ENG-FACE"],
    },
    {
      recipientCode: "R-WB-00002",
      fullName: "Shreya Bose",
      partnerName: "Debanjan Bose",
      clinicId: clinicKolPrimary.id,
      packageTier: PackageTier.PREMIUM,
      selectionMode: SelectionMode.PROFILE_SELECT,
      city: "Kolkata",
      stateCode: "WB",
      pincode: "700025",
      age: 36,
      engineSubs: ["SKU-ENG-FACE", "SKU-ENG-GEN"],
    },
  ];

  for (const r of recipients) {
    await prisma.recipient.upsert({
      where: { recipientCode: r.recipientCode },
      update: {
        fullName: r.fullName,
        partnerName: r.partnerName,
        dob: dobYearsAgo(r.age),
        aadhaarHash: hashSeedAadhaar(r.recipientCode),
        phone: seedPhone(r.recipientCode),
        email: seedEmail(r.recipientCode.toLowerCase()),
        addressLine: `${r.city} residence`,
        city: r.city,
        stateCode: r.stateCode,
        pincode: r.pincode,
        clinicId: r.clinicId,
        packageTier: r.packageTier,
        selectionMode: r.selectionMode,
        engineSubs: r.engineSubs ?? [],
      },
      create: {
        recipientCode: r.recipientCode,
        fullName: r.fullName,
        partnerName: r.partnerName,
        dob: dobYearsAgo(r.age),
        aadhaarHash: hashSeedAadhaar(r.recipientCode),
        phone: seedPhone(r.recipientCode),
        email: seedEmail(r.recipientCode.toLowerCase()),
        addressLine: `${r.city} residence`,
        city: r.city,
        stateCode: r.stateCode,
        pincode: r.pincode,
        clinicId: r.clinicId,
        packageTier: r.packageTier,
        selectionMode: r.selectionMode,
        engineSubs: r.engineSubs ?? [],
      },
    });
  }

  console.log("  Recipients: Basic / Standard / Premium");
  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
