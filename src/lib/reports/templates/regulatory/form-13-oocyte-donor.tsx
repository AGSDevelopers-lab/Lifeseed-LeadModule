import "server-only";

import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

/** Form 13 — Oocyte donor (layout aligned to Form_13.pdf reference). */
export type Form13OocyteDonorData = {
  donorCode: string;
  donorName: string;
  age: number;
  spouseName?: string;
  address?: string;
  aadhaarMasked?: string;
  clinicName?: string;
  doctorName?: string;
  indication?: string;
  date?: string;
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 13, textAlign: "center", marginBottom: 8, fontFamily: "Helvetica-Bold" },
  subtitle: { textAlign: "center", marginBottom: 14, fontSize: 10 },
  section: { marginTop: 8, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  row: { marginBottom: 4 },
  box: { borderWidth: 1, borderColor: "#333", padding: 8, marginTop: 8 },
});

function Form13Doc({ data }: { data: Form13OocyteDonorData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>FORM 13</Text>
        <Text style={styles.subtitle}>Information / declaration relating to oocyte donor</Text>
        <Text style={styles.section}>A. Donor particulars</Text>
        <Text style={styles.row}>Donor Code: {data.donorCode}</Text>
        <Text style={styles.row}>Name: {data.donorName}</Text>
        <Text style={styles.row}>Age: {data.age}</Text>
        <Text style={styles.row}>Spouse: {data.spouseName ?? "—"}</Text>
        <Text style={styles.row}>Address: {data.address ?? "—"}</Text>
        <Text style={styles.row}>Aadhaar (masked): {data.aadhaarMasked ?? "—"}</Text>
        <Text style={styles.section}>B. Clinic / indication</Text>
        <Text style={styles.row}>Clinic: {data.clinicName ?? "—"}</Text>
        <Text style={styles.row}>Doctor: {data.doctorName ?? "—"}</Text>
        <Text style={styles.row}>Indication: {data.indication ?? "—"}</Text>
        <View style={styles.box}>
          <Text>
            Certified that the oocyte donor has been screened, counselled, and consents under ART Act
            2021. Documents form part of the donor passport packet.
          </Text>
        </View>
        <Text style={styles.row}>Date: {data.date ?? new Date().toISOString().slice(0, 10)}</Text>
      </Page>
    </Document>
  );
}

export async function generate(data: Form13OocyteDonorData): Promise<Buffer> {
  const buf = await renderToBuffer(
    <Form13Doc data={data} />,
  );
  return Buffer.from(buf);
}

export const Form13OocyteDonorTemplate = Form13Doc;
