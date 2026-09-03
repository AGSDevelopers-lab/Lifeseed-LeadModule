import "server-only";

import React from "react";
import { Document, Page, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

/** Form M1 — Oocyte donor medical / screening form (aligned to Form_M1_Oocyte.pdf). */
export type FormM1OocyteData = {
  donorCode: string;
  donorName: string;
  dob: string;
  bloodGroup?: string;
  heightCm?: number | null;
  weightKg?: number | null;
  hasLivingChild?: boolean | null;
  maritalStatus?: string | null;
  serologySummary?: string;
  amh?: string;
  antralFollicleCount?: string;
  clinicName?: string;
  date?: string;
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 13, textAlign: "center", marginBottom: 12, fontFamily: "Helvetica-Bold" },
  section: { marginTop: 10, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  row: { marginBottom: 4 },
});

function FormM1Doc({ data }: { data: FormM1OocyteData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>FORM M1 — OOCYTE DONOR</Text>
        <Text style={styles.section}>1. Identity & demographics</Text>
        <Text style={styles.row}>Donor Code: {data.donorCode}</Text>
        <Text style={styles.row}>Name: {data.donorName}</Text>
        <Text style={styles.row}>DOB: {data.dob}</Text>
        <Text style={styles.row}>Blood group: {data.bloodGroup ?? "—"}</Text>
        <Text style={styles.row}>
          Height/Weight: {data.heightCm ?? "—"} cm / {data.weightKg ?? "—"} kg
        </Text>
        <Text style={styles.row}>Marital status: {data.maritalStatus ?? "—"}</Text>
        <Text style={styles.row}>
          Has living child:{" "}
          {data.hasLivingChild === null || data.hasLivingChild === undefined
            ? "—"
            : data.hasLivingChild
              ? "Yes"
              : "No"}
        </Text>

        <Text style={styles.section}>2. Screening</Text>
        <Text style={styles.row}>AMH: {data.amh ?? "—"}</Text>
        <Text style={styles.row}>AFC: {data.antralFollicleCount ?? "—"}</Text>
        <Text style={styles.row}>Serology: {data.serologySummary ?? "See attached panel"}</Text>

        <Text style={styles.section}>3. Clinic</Text>
        <Text style={styles.row}>{data.clinicName ?? "—"}</Text>
        <Text style={styles.row}>Date: {data.date ?? new Date().toISOString().slice(0, 10)}</Text>
      </Page>
    </Document>
  );
}

export async function generate(data: FormM1OocyteData): Promise<Buffer> {
  const buf = await renderToBuffer(
    <FormM1Doc data={data} />,
  );
  return Buffer.from(buf);
}

export const FormM1OocyteTemplate = FormM1Doc;
