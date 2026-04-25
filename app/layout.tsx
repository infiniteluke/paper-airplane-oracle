import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Oracle",
  description: "Confidently-stated, sometimes-wrong product advice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
