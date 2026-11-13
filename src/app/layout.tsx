import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { LmsProvider } from "@/state/lms-provider";
export const metadata: Metadata = { title: { default: "Học Việt · Không gian học tập", template: "%s | Học Việt" }, description: "Hệ thống quản lý học tập Học Việt — bản demo giao diện." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="vi" className={GeistSans.variable}><body><LmsProvider>{children}</LmsProvider></body></html>; }
