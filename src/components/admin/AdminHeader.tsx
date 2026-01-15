"use client";

import React, { useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ui/ThemeToggle";
import dynamic from "next/dynamic";
import { useSidebar } from "@/contexts/SidebarContext";

// Lazy load notification center
const NotificationCenter = dynamic(
  () => import("@/components/notifications/NotificationCenter"),
  { ssr: false, loading: () => null }
);

interface AdminHeaderProps {
  user: {
    username: string;
    avatar_url?: string;
    role?: "player" | "organizer" | "owner";
    is_host?: boolean;
  };
  onMenuClick: () => void;
  onLogout: () => void;
  companyName?: string;
}

export function AdminHeader({ user, onMenuClick, onLogout, companyName = "VOU Esports" }: AdminHeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { isCollapsed } = useSidebar();
  const isOwner = user?.role === "owner";

  return (
    <>
      {/* Mobile Header */}
      <header className="sticky top-0 z-30 lg:hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 h-16">
          {/* Menu Button */}
          <button
            onClick={onMenuClick}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Company Name */}
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <span className="font-bold text-gray-900 dark:text-white text-lg">
              {companyName}
            </span>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationCenter />
          </div>
        </div>
      </header>

      {/* Desktop Header */}
      <header className={`hidden lg:flex fixed top-0 right-0 h-16 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-6 items-center justify-between z-20 transition-all duration-300 ${isCollapsed ? "left-20" : "left-72"}`}>
        {/* Left Section - Company Name & Branding */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">{companyName}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Admin Panel</p>
            </div>
          </div>
          
          {/* Divider */}
          <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-2" />
          
          {/* Host Info Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <span className="text-sm">👤</span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {isOwner ? "Owner" : "Host"}: <span className="text-indigo-600 dark:text-indigo-400">{user.username}</span>
            </span>
          </div>
        </div>

        {/* Right Section - Actions */}
        <div className="flex items-center gap-3">
          {/* View as Player Button */}
          <Link
            href="/app"
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition font-medium text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View as Player
          </Link>
          
          <ThemeToggle />
          <NotificationCenter />
          
          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition border border-gray-200 dark:border-gray-700"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-medium text-sm">
                  {user.username?.charAt(0).toUpperCase()}
                </span>
              </div>
              <svg 
                className={`w-4 h-4 text-gray-500 transition-transform ${showUserMenu ? "rotate-180" : ""}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowUserMenu(false)} 
                />
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-20">
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <p className="font-medium text-gray-900 dark:text-white">{user.username}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isOwner ? "👑 Owner Account" : "⚙️ Organizer Account"}
                    </p>
                  </div>
                  
                  <Link
                    href="/app/profile"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <span>👤</span>
                    Profile Settings
                  </Link>
                  
                  <Link
                    href="/app"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <span>🎮</span>
                    Player Dashboard
                  </Link>
                  
                  {isOwner && (
                    <Link
                      href="/owner"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <span>👑</span>
                      Owner Portal
                    </Link>
                  )}
                  
                  <hr className="my-2 border-gray-200 dark:border-gray-700" />
                  
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout();
                    }}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-full"
                  >
                    <span>🚪</span>
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
