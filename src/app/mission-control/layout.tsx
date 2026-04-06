import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import "@/styles/admin.css";
import AdminAuthProvider from "@/components/admin/AdminAuthProvider";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Knotie-AI Mission Control",
  description: "Internal management system",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AdminAuthProvider>
      <div className={`admin-layout ${inter.className}`}>
        {children}
      </div>
      <Toaster />
    </AdminAuthProvider>
  );
}
