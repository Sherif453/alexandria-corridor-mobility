import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alexandria Corridor Mobility Intelligence",
  description: "Corridor mobility decision-support system",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
