"use client";

import { ReactNode } from "react";
import { SidebarProvider } from "@/contexts/SidebarContext";
import dynamic from "next/dynamic";

// Dynamically import ChatProvider to avoid SSR issues with socket.io-client
const ChatProvider = dynamic(
  () => import("@/contexts/ChatContext").then(mod => ({ default: mod.ChatProvider })),
  { ssr: false }
);

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <ChatProvider>
        {children}
      </ChatProvider>
    </SidebarProvider>
  );
}
