import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { publicAppUrlFromEnv } from "@/lib/app-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appOrigin = publicAppUrlFromEnv() ?? "http://localhost:3001";

export const metadata: Metadata = {
  metadataBase: new URL(appOrigin),
  title: {
    default: "Studio Galleries | Private Client Photo Proofing",
    template: "%s | Studio Galleries",
  },
  description:
    "Private proofing galleries for photographers and studios. Share shoots, collect favorites and comments, and deliver final images securely.",
  applicationName: "Studio Galleries",
  keywords: [
    "photo proofing",
    "client galleries",
    "photography delivery",
    "studio galleries",
    "private photo gallery",
  ],
  authors: [{ name: "Studio Galleries" }],
  creator: "Studio Galleries",
  publisher: "Studio Galleries",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Studio Galleries",
    title: "Studio Galleries | Private Client Photo Proofing",
    description:
      "Share private galleries, collect client selections, comments, and downloads, and keep every delivery under studio control.",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Studio Galleries private client photo proofing",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Studio Galleries | Private Client Photo Proofing",
    description:
      "Private proofing galleries for photographers and studios.",
    images: ["/og-image.svg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
