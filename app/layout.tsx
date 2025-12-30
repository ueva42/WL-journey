import "./globals.css";
import Nav from "@/components/Nav";

export const metadata = {
  title: "Weight & Group Tracker",
  description: "Gewicht, Ziele und Gruppenübersicht",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          background: "#0f0f0f",
          color: "#f5f5f5",
          minHeight: "100vh",
        }}
      >
        {/* Top Navigation */}
        <Nav />

        {/* Seiteninhalt */}
        <main
          style={{
            maxWidth: 980,
            margin: "0 auto",
            padding: "24px 16px",
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
