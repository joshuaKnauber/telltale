import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar.tsx";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-[--color-canvas] text-[--color-fg]">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-auto">{children}</main>
    </div>
  );
}
