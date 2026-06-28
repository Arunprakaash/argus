import "./globals.css";
import { Manrope } from "next/font/google";

const manrope = Manrope({ subsets: ["latin"], display: "swap", variable: "--font-sans" });

export const metadata = {
  title: "Argus",
  description: "Argus — the watchful guardian: observability & QA for the LiveKit interview agent.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
