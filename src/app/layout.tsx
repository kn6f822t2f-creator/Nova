import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "@/providers";

export const metadata: Metadata = {
  title: "Nova",
  description: "Provably-fair crypto casino",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
