export const metadata = {
  title: "Interview Observer",
  description: "Observability & QA dashboard for the LiveKit interview agent.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
