import type { Metadata } from "next";
import { Caveat, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-caveat",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm",
});

export const metadata: Metadata = {
  title: "Linea del tempo – Guerre di religione in Europa",
  description: "Web application full-stack creata con Next.js, React e TypeScript",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${caveat.variable} ${ibmPlexSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
