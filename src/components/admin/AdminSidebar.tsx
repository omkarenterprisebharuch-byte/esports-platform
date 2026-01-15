"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useSidebar } from "@/contexts/SidebarContext";

interface NavItem {
  icon: string;
  label: string;
  href: string;
  badge?: string | number;
  description?: string;
}

interface AdminSidebarProps {
  user: {
    id: number;
    username: string;
    email?: string;
    avatar_url?: string;
    is_host?: boolean;
    role?: "player" | "organizer" | "owner";
  };
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

// Admin management navigation items
const adminNavItems: NavItem[] = [
  { icon: "📊", label: "Dashboard", href: "/admin", description: "Overview & Stats" },
  { icon: "➕", label: "Create Tournament", href: "/admin/create-tournament", description: "New tournament" },
  { icon: "🏆", label: "League Management", href: "/admin/leagues", description: "Manage leagues" },
  { icon: "🚫", label: "Ban Manager", href: "/admin/bans", description: "User bans" },
  { icon: "📋", label: "Reports", href: "/admin/reports", description: "Player reports" },
  { icon: "💳", label: "Wallet", href: "/admin/wallet", description: "Financials" },
];

// Quick navigation back to user area
const userNavItems: NavItem[] = [
  { icon: "🏠", label: "Back to App", href: "/app", description: "Player view" },
  { icon: "🎮", label: "Browse Tournaments", href: "/app/tournaments", description: "All tournaments" },
];

export function AdminSidebar({ user, onLogout, isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const { isCollapsed, toggleCollapse } = useSidebar();
  const isOwner = user?.role === "owner";

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = pathname === item.href || 
      (item.href !== "/admin" && pathname?.startsWith(item.href));

    return (
      <Link
        href={item.href}
        onClick={onClose}
        title={isCollapsed ? item.label : undefined}
        className={`
          flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium
          transition-all duration-200 group
          ${isCollapsed ? "justify-center" : ""}
          ${isActive
            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          }
        `}
      >
        <span className="text-lg">{item.icon}</span>
        {!isCollapsed && (
          <div className="flex-1">
            <span className="block">{item.label}</span>
            {item.description && (
              <span className={`text-xs ${isActive ? "text-indigo-200" : "text-gray-500 dark:text-gray-400"}`}>
                {item.description}
              </span>
            )}
          </div>
        )}
        {!isCollapsed && item.badge !== undefined && (
          <span className={`
            px-2 py-0.5 text-xs font-semibold rounded-full
            ${isActive 
              ? "bg-white/20 text-white" 
              : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
            }
          `}>
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  const NavSection = ({ title, items }: { title: string; items: NavItem[] }) => (
    <div className="mb-4">
      {!isCollapsed && (
        <h3 className="px-3 mb-3 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {title}
        </h3>
      )}
      <nav className="space-y-1">
        {items.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>
    </div>
  );

  const sidebarContent = (
    <>
      {/* Logo & Brand - Only show on mobile or as compact version on collapsed */}
      <div className={`flex items-center gap-2 px-2 mb-6 ${isCollapsed ? "justify-center" : ""}`}>
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
          <span className="text-white font-bold text-lg">⚙️</span>
        </div>
        {!isCollapsed && (
          <div>
            <span className="text-lg font-bold text-gray-900 dark:text-white block">
              Admin Panel
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Management Options
            </span>
          </div>
        )}
      </div>

      {/* User Profile Card */}
      <div className={`bg-gradient-to-br from-indigo-100 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/20 rounded-2xl p-4 mb-6 border border-indigo-200 dark:border-indigo-800 ${isCollapsed ? "p-2" : ""}`}>
        <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : ""}`}>
          <Image
            src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}&background=4f46e5&color=fff`}
            alt={user.username}
            width={isCollapsed ? 36 : 48}
            height={isCollapsed ? 36 : 48}
            className="rounded-xl ring-2 ring-white dark:ring-indigo-700 shadow-md"
          />
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 dark:text-white truncate text-base">
                {user.username}
              </p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 truncate font-medium">
                {isOwner ? "👑 Owner" : "⚙️ Organizer"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto">
        <NavSection title="Management" items={adminNavItems} />
        
        {/* Owner Portal Link */}
        {isOwner && (
          <div className="mb-4">
            {!isCollapsed && (
              <h3 className="px-3 mb-3 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Owner Access
              </h3>
            )}
            <nav className="space-y-1">
              <Link
                href="/owner"
                onClick={onClose}
                title={isCollapsed ? "Owner Portal" : undefined}
                className={`
                  flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium
                  transition-all duration-200
                  ${isCollapsed ? "justify-center" : ""}
                  text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800
                `}
              >
                <span className="text-lg">👑</span>
                {!isCollapsed && (
                  <div className="flex-1">
                    <span className="block">Owner Portal</span>
                    <span className="text-xs text-purple-500 dark:text-purple-400">Full platform control</span>
                  </div>
                )}
              </Link>
            </nav>
          </div>
        )}
        
        <NavSection title="Navigation" items={userNavItems} />
      </div>

      {/* Logout Button */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
        <button
          onClick={onLogout}
          title={isCollapsed ? "Sign Out" : undefined}
          className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium w-full
            text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800
            ${isCollapsed ? "justify-center" : ""}`}
        >
          <span className="text-lg">🚪</span>
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`
          fixed left-0 top-0 h-full w-72 bg-white dark:bg-gray-900 
          border-r border-gray-200 dark:border-gray-700 p-4 z-50 
          transform transition-transform duration-300 ease-out lg:hidden
          flex flex-col
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition lg:hidden"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {sidebarContent}
      </div>

      {/* Desktop Sidebar */}
      <aside className={`fixed left-0 top-0 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-4 hidden lg:flex flex-col transition-all duration-300 ${isCollapsed ? "w-20" : "w-72"}`}>
        {/* Collapse Toggle Button */}
        <button
          onClick={toggleCollapse}
          className="absolute -right-3 top-20 w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors shadow-md z-10"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg 
            className={`w-4 h-4 text-gray-600 dark:text-gray-300 transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {sidebarContent}
      </aside>
    </>
  );
}
