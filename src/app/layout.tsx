import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { ToastProvider } from "@/context/ToastContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FACE Prep E-Campus - Operations & Timetable System",
  description: "Advanced Slot Booking, Operations, and Student Academic Management Platform",
  icons: {
    icon: "/E-Campus.png",
    shortcut: "/E-Campus.png",
    apple: "/E-Campus.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col transition-colors duration-250">
        <ToastProvider>
          <AppProvider>
            {children}
          </AppProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
