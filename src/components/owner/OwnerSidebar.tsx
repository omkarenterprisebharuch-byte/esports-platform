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
}

interface OwnerSidebarProps {
  user: {
    id: number;
    username: string;
    email?: string;
    avatar_url?: string;
    role?: "player" | "organizer" | "owner";
  };
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

// Owner navigation items
const ownerNavItems: NavItem[] = [
  { icon: "📊", label: "Dashboard", href: "/owner" },
  { icon: "👥", label: "User Management", href: "/owner/users" },
  { icon: "📺", label: "Advertisements", href: "/owner/ads" },
  { icon: "💰", label: "Deposit Requests", href: "/owner/deposits" },
  { icon: "📈", label: "System Monitoring", href: "/owner/monitoring" },
];

// Quick navigation
const quickNavItems: NavItem[] = [
  { icon: "⚙️", label: "Admin Panel", href: "/admin" },
  { icon: "🏠", label: "Back to App", href: "/app" },
];

export function OwnerSidebar({ user, onLogout, isOpen, onClose }: OwnerSidebarProps) {
  const pathname = usePathname();
  const { isCollapsed, toggleCollapse } = useSidebar();

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = pathname === item.href || 
      (item.href !== "/owner" && pathname?.startsWith(item.href));

    return (
      <Link
        href={item.href}
        onClick={onClose}
        title={isCollapsed ? item.label : undefined}
        className={`
          flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
          transition-all duration-200
          ${isCollapsed ? "justify-center" : ""}
          ${isActive
            ? "bg-purple-600 text-white shadow-sm"
            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          }
        `}
      >
        <span className="text-lg">{item.icon}</span>
        {!isCollapsed && <span className="flex-1">{item.label}</span>}
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
    <div className="mb-6">
      {!isCollapsed && (
        <h3 className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
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
      {/* Logo */}
      <div className={`flex items-center gap-2 px-2 mb-8 ${isCollapsed ? "justify-center" : ""}`}>
        <span className="text-2xl">👑</span>
        {!isCollapsed && (
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            Owner Portal
          </span>
        )}
      </div>

      {/* User Profile Card */}
      <div className={`bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-900/10 rounded-2xl p-4 mb-6 ${isCollapsed ? "p-2" : ""}`}>
        <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : ""}`}>
          <Image
            src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}&background=9333ea&color=fff`}
            alt={user.username}
            width={isCollapsed ? 36 : 44}
            height={isCollapsed ? 36 : 44}
            className="rounded-full ring-2 ring-white dark:ring-purple-700"
          />
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white truncate">
                {user.username}
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400 truncate">
                👑 Platform Owner
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto">
        <NavSection title="Owner" items={ownerNavItems} />
        <NavSection title="Navigation" items={quickNavItems} />
      </div>

      {/* Logout Button */}
      <button
        onClick={onLogout}
        title={isCollapsed ? "Sign Out" : undefined}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full
          text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors
          ${isCollapsed ? "justify-center" : ""}`}
      >
        <span>🚪</span>
        {!isCollapsed && <span>Sign Out</span>}
      </button>
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
