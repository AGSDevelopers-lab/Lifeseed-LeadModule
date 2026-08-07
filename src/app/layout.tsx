import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AppToaster } from "@/components/providers/app-toaster";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LifeSeed ART Bank",
  description: "LifeSeed ART Bank management application",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
