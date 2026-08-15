import type { Metadata } from "next";
import "@subboost/ui/styles/globals.css";
import { MobileNav } from "@subboost/ui/components/layout/mobile-nav";
import { ScrollLockStabilizer } from "@subboost/ui/components/layout/scroll-lock-stabilizer";
import { ConfirmDialogHost } from "@subboost/ui/components/ui/confirm-dialog";
import { Toaster } from "@subboost/ui/components/ui/toaster";
import { LocalHeader } from "@local/components/local-header";
import {
  SUBBOOST_FAVICON_PATH,
  SUBBOOST_ICON_PATH,
  SUBBOOST_KEYWORDS,
  SUBBOOST_PRODUCT_DESCRIPTION,
  SUBBOOST_PRODUCT_TITLE,
  SUBBOOST_SITE_NAME,
  SUBBOOST_THEME_COLOR,
} from "@subboost/ui/brand";

export const metadata: Metadata = {
  title: {
    default: SUBBOOST_PRODUCT_TITLE,
    template: `%s | ${SUBBOOST_SITE_NAME}`,
  },
  description: SUBBOOST_PRODUCT_DESCRIPTION,
  keywords: SUBBOOST_KEYWORDS,
  authors: [{ name: SUBBOOST_SITE_NAME }],
  creator: SUBBOOST_SITE_NAME,
  publisher: SUBBOOST_SITE_NAME,
  icons: {
    icon: SUBBOOST_ICON_PATH,
    shortcut: SUBBOOST_FAVICON_PATH,
    apple: SUBBOOST_ICON_PATH,
  },
};

export const viewport = {
  themeColor: SUBBOOST_THEME_COLOR,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <head>
        <link rel="preload" href="/fonts/clash-display-600.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/switzer-400.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="font-sans">
        <ScrollLockStabilizer />
        <div className="min-h-screen flex flex-col">
          <LocalHeader />
          <main className="flex-1 pb-16 md:pb-0">{children}</main>
          <MobileNav mode="local" />
        </div>
        <Toaster />
        <ConfirmDialogHost />
      </body>
    </html>
  );
}
