import "server-only";

import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export type FormMSemenDonorData = {
  donorCode: string;
  fullName: string;
  dob: string;
  bloodGroup?: string;
  heightCm?: number | null;
  weightKg?: number | null;
  maritalStatus?: string | null;
  address?: string | null;
  phone?: string;
  latestVolumeMl?: number | null;
  latestConcentration?: number | null;
  latestProgressiveMotilityPct?: number | null;
  serologySummary?: string;
  clinicName?: string;
  date?: string;
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 13, textAlign: "center", marginBottom: 12, fontFamily: "Helvetica-Bold" },
  section: { marginTop: 10, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  row: { marginBottom: 4 },
  grid: { flexDirection: "row", marginBottom: 4 },
  cell: { flex: 1 },
});

function FormMDoc({ data }: { data: FormMSemenDonorData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>FORM M — SEMEN DONOR INFORMATION</Text>
        <Text style={styles.section}>1. Identity</Text>
        <View style={styles.grid}>
          <Text style={styles.cell}>Donor Code: {data.donorCode}</Text>
          <Text style={styles.cell}>Name: {data.fullName}</Text>
        </View>
        <View style={styles.grid}>
          <Text style={styles.cell}>DOB: {data.dob}</Text>
          <Text style={styles.cell}>Blood group: {data.bloodGroup ?? "—"}</Text>
        </View>
        <Text style={styles.row}>
          Height: {data.heightCm ?? "—"} cm · Weight: {data.weightKg ?? "—"} kg · Marital:{" "}
          {data.maritalStatus ?? "—"}
        </Text>
        <Text style={styles.row}>Address: {data.address ?? "—"}</Text>
        <Text style={styles.row}>Phone: {data.phone ?? "—"}</Text>

        <Text style={styles.section}>2. Latest semen analysis (WHO 6th)</Text>
        <Text style={styles.row}>Volume (mL): {data.latestVolumeMl ?? "—"}</Text>
        <Text style={styles.row}>Concentration (M/mL): {data.latestConcentration ?? "—"}</Text>
        <Text style={styles.row}>
          Progressive motility %: {data.latestProgressiveMotilityPct ?? "—"}
        </Text>

        <Text style={styles.section}>3. Serology summary</Text>
        <Text style={styles.row}>{data.serologySummary ?? "See attached lab panel"}</Text>

        <Text style={styles.section}>4. Intended clinic</Text>
        <Text style={styles.row}>{data.clinicName ?? "—"}</Text>
        <Text style={styles.row}>Date: {data.date ?? new Date().toISOString().slice(0, 10)}</Text>
      </Page>
    </Document>
  );
}

export async function generate(data: FormMSemenDonorData): Promise<Buffer> {
  const buf = await renderToBuffer(
    <FormMDoc data={data} />,
  );
  return Buffer.from(buf);
}

export const FormMSemenDonorTemplate = FormMDoc;
