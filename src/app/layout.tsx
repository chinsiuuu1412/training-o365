import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { AuthProvider } from "@/state/auth-provider";
import { ApiDataProvider } from "@/state/api-data-provider";
export const metadata: Metadata = { title: { default: "CLB o365 HUST - Khóa học Kĩ năng mềm", template: "%s | CLB o365 HUST" }, description: "Khóa học Kĩ năng mềm do CLB o365 HUST tổ chức." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="vi" className={GeistSans.variable}><body><AuthProvider><ApiDataProvider>{children}</ApiDataProvider></AuthProvider></body></html>; }
