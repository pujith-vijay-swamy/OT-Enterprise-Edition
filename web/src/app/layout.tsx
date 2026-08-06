import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "RepoTrace — Cross-Repository API Observability & PR Governance",
  description: "Passive AST Boundary Observability & Automated PR Governance Platform for Microservices",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "RepoTrace — Cross-Repository API Observability & PR Governance",
    description: "Passive AST Boundary Observability & Automated PR Governance Platform for Microservices",
    url: "http://localhost:3000",
    siteName: "RepoTrace Enterprise",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "RepoTrace Enterprise Static AST Boundary Observability",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RepoTrace — Cross-Repository API Observability & PR Governance",
    description: "Passive AST Boundary Observability & Automated PR Governance Platform for Microservices",
    images: ["/og-image.jpg"],
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
