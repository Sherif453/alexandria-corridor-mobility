import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "leaflet/dist/leaflet.css";
import "./globals.css";

import { defaultMetadata, getSiteUrlFromHeaders } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();

  return {
    ...defaultMetadata,
    metadataBase: getSiteUrlFromHeaders(requestHeaders),
  };
}

export const viewport: Viewport = {
  initialScale: 1,
  width: "device-width",
  themeColor: "#0f766e",
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
