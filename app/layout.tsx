import type { ReactNode } from "react";

export const metadata = {
  title: "HubSpot MCP demo",
  description: "A remote MCP server that lets Claude read and annotate HubSpot.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
