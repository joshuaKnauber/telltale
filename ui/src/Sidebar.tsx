import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  Sparkles,
  GitCommitVertical,
  Activity,
  Settings as SettingsIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Memory",
    items: [
      { to: "/learnings", label: "Learnings", icon: BookOpen },
      { to: "/potential", label: "Potential", icon: Sparkles },
    ],
  },
  {
    label: "Activity",
    items: [
      { to: "/runs", label: "Runs", icon: Activity },
      { to: "/history", label: "History", icon: GitCommitVertical },
    ],
  },
  {
    label: "Configure",
    items: [{ to: "/settings", label: "Settings", icon: SettingsIcon }],
  },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-[228px] flex-shrink-0 flex-col bg-[--color-subtle]">
      <div className="flex items-baseline gap-2 px-6 pt-7 pb-8 leading-none">
        <span className="text-[14px] font-semibold tracking-tight text-[--color-fg]">
          telltale
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[--color-fg-subtle]">
          v0.1
        </span>
      </div>

      <nav className="flex flex-col gap-6 px-3">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[--color-fg-subtle]">
              {group.label}
            </div>
            <div className="flex flex-col">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    [
                      "group flex items-center gap-3 rounded-md px-3 py-1.5 text-[13.5px] transition-colors",
                      isActive
                        ? "bg-[--color-elevated] text-[--color-fg]"
                        : "text-[--color-fg-muted] hover:text-[--color-fg]",
                    ].join(" ")
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        size={15}
                        strokeWidth={1.75}
                        className={
                          isActive
                            ? "text-[--color-fg]"
                            : "text-[--color-fg-subtle] group-hover:text-[--color-fg-muted]"
                        }
                      />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto px-6 pb-6">
        <div className="flex items-center gap-2 text-[11px] text-[--color-fg-subtle]">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-[--color-accent] opacity-50" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[--color-accent]" />
          </span>
          <span className="font-mono uppercase tracking-[0.12em]">analyzer idle</span>
        </div>
      </div>
    </aside>
  );
}
