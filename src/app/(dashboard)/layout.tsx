"use client";

import { TopBar, StatusBar } from "@/components/TenacitOS";
import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="tenacios-shell" style={{ minHeight: "100vh" }}>
      <TopBar />
      <Sidebar />
      
      <main
        style={{
          marginLeft: "240px", // Width of sidebar
          marginTop: "48px", // Height of top bar
          marginBottom: "32px", // Height of status bar
          minHeight: "calc(100vh - 48px - 32px)",
          padding: "24px",
        }}
      >
        {children}
      </main>

      <StatusBar />
    </div>
  );
}
