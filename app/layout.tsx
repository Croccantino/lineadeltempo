import type { Metadata } from "next";
import { Inter, Caveat } from "next/font/google";
import FeedbackWidget from "./components/FeedbackWidget";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-caveat",
});

export const metadata: Metadata = {
  title: "Linea del Tempo",
  description: "Web application full-stack creata con Next.js, React e TypeScript",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${inter.variable} ${caveat.variable}`}>
      <head>
        <link rel="preconnect" href="https://timeline-cb4b2-default-rtdb.europe-west1.firebasedatabase.app" />
        <link rel="preconnect" href="https://timeline-cb4b2.firebaseapp.com" />
        <link rel="dns-prefetch" href="https://timeline-cb4b2-default-rtdb.europe-west1.firebasedatabase.app" />
      </head>
      <body>
        {children}
        <FeedbackWidget />
        <footer className="site-footer">
          Realizzato da <strong>Francesco Zompì</strong> · Presentato da{" "}
          <strong>Alessandro Rizzo</strong>
        </footer>
      </body>
    </html>
  );
}
