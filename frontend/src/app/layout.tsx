import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { AuthProvider } from "@/state/auth-provider";

export const metadata: Metadata = {
  title: {
    default: "CLB o365 HUST · Khóa học Kĩ năng mềm",
    template: "%s | CLB o365 HUST",
  },
  description:
    "Hệ thống quản lý Khóa học Kĩ năng mềm về bộ công cụ Microsoft cơ bản của CLB o365 - HUST.",
  icons: {
    icon: [
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-64.png", sizes: "64x64", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={GeistSans.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
