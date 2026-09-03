import "server-only";

import React from "react";
import { Document, Page, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export type Form15ConsentSpermDonorData = {
  donorName: string;
  clinicianName: string;
  counsellorName: string;
  wifeConsent: boolean;
  witness1Name: string;
  witness2Name: string;
  donorCode?: string;
  date?: string;
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", lineHeight: 1.4 },
  title: { fontSize: 13, textAlign: "center", marginBottom: 14, fontFamily: "Helvetica-Bold" },
  para: { marginBottom: 8, textAlign: "justify" },
  row: { marginBottom: 6 },
});

function Form15Doc({ data }: { data: Form15ConsentSpermDonorData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>FORM 15 — CONSENT OF SPERM DONOR</Text>
        <Text style={styles.para}>
          I, {data.donorName}
          {data.donorCode ? ` (Donor Code ${data.donorCode})` : ""}, hereby consent to donate
          spermatozoa for ART procedures under the ART Act 2021.
        </Text>
        <Text style={styles.para}>
          I have been explained the procedure, risks, and legal implications by clinician{" "}
          {data.clinicianName} and counsellor {data.counsellorName}.
        </Text>
        <Text style={styles.row}>
          Spouse / partner consent obtained: {data.wifeConsent ? "YES" : "NO / N/A"}
        </Text>
        <Text style={styles.row}>Witness 1 (Bank): {data.witness1Name}</Text>
        <Text style={styles.row}>Witness 2 (Bank): {data.witness2Name}</Text>
        <Text style={styles.row}>Date: {data.date ?? new Date().toISOString().slice(0, 10)}</Text>
        <Text style={styles.row}>Donor signature: ______________________</Text>
      </Page>
    </Document>
  );
}

export async function generate(data: Form15ConsentSpermDonorData): Promise<Buffer> {
  const buf = await renderToBuffer(
    <Form15Doc data={data} />,
  );
  return Buffer.from(buf);
}

export const Form15ConsentSpermDonorTemplate = Form15Doc;
