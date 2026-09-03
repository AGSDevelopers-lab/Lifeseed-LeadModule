import "server-only";

import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export type DeclarationSemenDonorData = {
  date: string;
  clinicName: string;
  refNo: string;
  donorCode: string;
  aadhaarNo: string;
  bankName?: string;
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", lineHeight: 1.4 },
  title: { fontSize: 14, textAlign: "center", marginBottom: 16, fontFamily: "Helvetica-Bold" },
  row: { marginBottom: 8 },
  label: { fontFamily: "Helvetica-Bold" },
  para: { marginBottom: 10, textAlign: "justify" },
  sign: { marginTop: 40 },
});

function DeclarationDoc({ data }: { data: DeclarationSemenDonorData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>DECLARATION OF SEMEN DONOR</Text>
        <Text style={styles.row}>Date: {data.date}</Text>
        <Text style={styles.row}>Ref No: {data.refNo}</Text>
        <Text style={styles.row}>Clinic: {data.clinicName}</Text>
        <Text style={styles.para}>
          This is to declare that Donor Code <Text style={styles.label}>{data.donorCode}</Text>{" "}
          (Aadhaar masked: {data.aadhaarNo}) has voluntarily donated semen to{" "}
          {data.bankName ?? "LifeSeed ART Bank"} for use by the named ART clinic under the ART Act 2021.
        </Text>
        <Text style={styles.para}>
          The donor has been counselled, screened, and consented as required. Identity verification
          was completed at intake. This declaration accompanies the donor passport packet for clinic use.
        </Text>
        <View style={styles.sign}>
          <Text>Authorised Signatory — Bank</Text>
          <Text>Date: {data.date}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generate(data: DeclarationSemenDonorData): Promise<Buffer> {
  const buf = await renderToBuffer(
    <DeclarationDoc data={data} />,
  );
  return Buffer.from(buf);
}

export const DeclarationSemenDonorTemplate = DeclarationDoc;
