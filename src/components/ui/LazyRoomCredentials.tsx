"use client";

import { useState, useCallback } from "react";
import { useLazyReveal } from "@/hooks/useOnDemandFetch";

interface RoomCredentials {
  room_id: string | null;
  room_password: string | null;
  message?: string;
}

interface LazyRoomCredentialsProps {
  tournamentId: number | string;
  isRegistered: boolean;
}

/**
 * Room credentials box - shows in the stats grid
 * Credentials are only fetched when user clicks "Reveal"
 */
export function LazyRoomCredentials({ tournamentId, isRegistered }: LazyRoomCredentialsProps) {
  const { data, loading, error, revealed, reveal, hide } = useLazyReveal<RoomCredentials>(
    `/api/registrations/room-credentials/${tournamentId}`
  );
  const [copiedField, setCopiedField] = useState<"id" | "password" | null>(null);

  const copyToClipboard = useCallback(async (text: string, field: "id" | "password") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, []);

  // Not registered - show disabled box
  if (!isRegistered) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 text-center opacity-60">
        <p className="text-sm text-gray-500">Room ID & Password</p>
        <p className="text-sm font-medium text-gray-400 mt-2">Register to view</p>
      </div>
    );
  }

  // Not revealed yet - show button to fetch
  if (!revealed) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
        <p className="text-sm text-gray-500 mb-2">Room ID & Password</p>
        <button
          onClick={reveal}
          disabled={loading}
          className="w-full py-2 px-3 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Loading...
            </>
          ) : (
            <>
              🔐 Reveal
            </>
          )}
        </button>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white border border-amber-200 rounded-xl p-4 text-center">
        <p className="text-sm text-gray-500 mb-1">Room ID & Password</p>
        <p className="text-amber-600 text-sm">{error}</p>
      </div>
    );
  }

  // Data revealed and credentials available
  if (data && data.room_id) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-green-700">🎮 Room Credentials</p>
          <button
            onClick={hide}
            className="text-green-600 text-xs hover:underline"
          >
            Hide
          </button>
        </div>
        
        {/* Room ID with Copy */}
        <div className="space-y-2">
          <div className="bg-white rounded-lg p-2 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600">Room ID</p>
                <p className="font-mono font-bold text-gray-900">{data.room_id}</p>
              </div>
              <button
                onClick={() => copyToClipboard(data.room_id!, "id")}
                className="p-2 hover:bg-green-100 rounded-lg transition"
                title="Copy Room ID"
              >
                {copiedField === "id" ? (
                  <span className="text-green-600 text-sm">✓</span>
                ) : (
                  <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Password with Copy */}
          {data.room_password && (
            <div className="bg-white rounded-lg p-2 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600">Password</p>
                  <p className="font-mono font-bold text-gray-900">{data.room_password}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(data.room_password!, "password")}
                  className="p-2 hover:bg-green-100 rounded-lg transition"
                  title="Copy Password"
                >
                  {copiedField === "password" ? (
                    <span className="text-green-600 text-sm">✓</span>
                  ) : (
                    <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Room credentials not set yet
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
      <p className="text-sm text-gray-500 mb-1">Room ID & Password</p>
      <p className="text-amber-700 text-sm font-medium">
        {data?.message || "Will be available soon"}
      </p>
    </div>
  );
}
