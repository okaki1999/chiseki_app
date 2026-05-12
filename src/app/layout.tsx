import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { AuthGate } from "~/app/_components/AuthGate";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "地積測量図OCR",
  description: "地積測量図の画像から座標・地番・測地系を自動抽出",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={`${geist.variable}`} suppressHydrationWarning>
      <body>
        <TRPCReactProvider>
          <AuthGate>{children}</AuthGate>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
