"use client";

import dynamic from "next/dynamic";

// Dynamically import PWA components to avoid SSR issues
const InstallPrompt = dynamic(
  () => import("./InstallPrompt").then((mod) => mod.default),
  { ssr: false }
);

const UpdateNotification = dynamic(
  () => import("./ServiceWorkerProvider").then((mod) => mod.UpdateNotification),
  { ssr: false }
);

const OfflineIndicator = dynamic(
  () => import("./ServiceWorkerProvider").then((mod) => mod.OfflineIndicator),
  { ssr: false }
);

export default function PWAProvider({ children }: { children?: React.ReactNode }) {
  return (
    <>
      {children}
      <InstallPrompt />
      <UpdateNotification />
      <OfflineIndicator />
    </>
  );
}
