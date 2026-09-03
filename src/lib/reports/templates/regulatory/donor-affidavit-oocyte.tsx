import "server-only";

import React from "react";
import { Document, Page, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export type DonorAffidavitOocyteData = {
  donorName: string;
  spouseName: string;
  address: string;
  aadhaar: string;
  age: number;
  doctorName: string;
  counsellorName: string;
  date?: string;
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", lineHeight: 1.45 },
  title: { fontSize: 14, textAlign: "center", marginBottom: 16, fontFamily: "Helvetica-Bold" },
  para: { marginBottom: 10, textAlign: "justify" },
  row: { marginBottom: 6 },
});

function AffidavitDoc({ data }: { data: DonorAffidavitOocyteData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>DONOR&apos;S AFFIDAVIT (OOCYTE)</Text>
        <Text style={styles.para}>
          I, {data.donorName}, aged {data.age} years, residing at {data.address}, Aadhaar (masked){" "}
          {data.aadhaar}, wife of {data.spouseName || "N/A"}, do hereby solemnly affirm:
        </Text>
        <Text style={styles.para}>
          1. I am donating oocytes voluntarily under the ART Act 2021 without coercion.
        </Text>
        <Text style={styles.para}>
          2. I have been counselled by {data.counsellorName} and examined by Dr. {data.doctorName}.
        </Text>
        <Text style={styles.para}>
          3. I understand the medical risks and that I shall not claim parenthood of resulting offspring.
        </Text>
        <Text style={styles.row}>Date: {data.date ?? new Date().toISOString().slice(0, 10)}</Text>
        <Text style={styles.row}>Deponent: ______________________</Text>
        <Text style={styles.row}>Witness / Counsellor: {data.counsellorName}</Text>
      </Page>
    </Document>
  );
}

export async function generate(data: DonorAffidavitOocyteData): Promise<Buffer> {
  const buf = await renderToBuffer(
    <AffidavitDoc data={data} />,
  );
  return Buffer.from(buf);
}

export const DonorAffidavitOocyteTemplate = AffidavitDoc;
