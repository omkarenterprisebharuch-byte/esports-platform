"use client";

import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import { useChat } from "@/contexts/ChatContext";
import { ChatMessage } from "@/lib/socket-client";

interface TournamentChatRoomProps {
  tournamentId: number | string;
  tournamentName: string;
  registeredUserIds: (number | string)[];
  tournamentEndTime: string;
  currentUserId: number | string;
  isOpen: boolean;
  onClose: () => void;
}

// Memoized message component to prevent unnecessary re-renders
const ChatMessageItem = memo(function ChatMessageItem({
  msg,
  isOwnMessage,
  formatTime,
}: {
  msg: ChatMessage;
  isOwnMessage: boolean;
  formatTime: (timestamp: Date) => string;
}) {
  return (
    <div className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          isOwnMessage
            ? "bg-gray-900 text-white rounded-br-md"
            : "bg-white border border-gray-200 rounded-bl-md"
        }`}
      >
        {!isOwnMessage && (
          <p className="text-xs font-semibold text-gray-600 mb-1">
            {msg.username}
          </p>
        )}
        <p className={`text-sm ${isOwnMessage ? "text-white" : "text-gray-800"}`}>
          {msg.message}
        </p>
        <p className={`text-xs mt-1 ${isOwnMessage ? "text-gray-400" : "text-gray-400"}`}>
          {formatTime(msg.timestamp)}
        </p>
      </div>
    </div>
  );
});

export default function TournamentChatRoom({
  tournamentId,
  tournamentName,
  registeredUserIds,
  tournamentEndTime,
  currentUserId,
  isOpen,
  onClose,
}: TournamentChatRoomProps) {
  const {
    isConnected,
    messages,
    activeUserCount,
    error,
    isChatClosed,
    hasMoreMessages,
    isLoadingMore,
    connect,
    joinChat,
    leaveChat,
    send,
    loadMoreMessages,
    clearError,
  } = useChat();

  const [inputMessage, setInputMessage] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesStartRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  // Intersection observer for loading more messages when scrolling to top
  useEffect(() => {
    if (!messagesStartRef.current || !hasMoreMessages || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreMessages();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(messagesStartRef.current);
    return () => observer.disconnect();
  }, [hasMoreMessages, isLoadingMore, loadMoreMessages]);

  // Connect and join chat when modal opens
  useEffect(() => {
    console.log("[Chat] useEffect triggered - isOpen:", isOpen, "hasJoined:", hasJoined);
    if (isOpen && !hasJoined) {
      console.log("[Chat] Fetching socket token...");
      // Fetch socket token from API (uses httpOnly cookie auth)
      const fetchSocketToken = async () => {
        try {
          console.log("[Chat] Making request to /api/auth/socket-token");
          const response = await fetch("/api/auth/socket-token", {
            credentials: "include",
          });
          console.log("[Chat] Socket token response status:", response.status);
          if (response.ok) {
            const data = await response.json();
            console.log("[Chat] Socket token received:", !!data.token);
            if (data.token) {
              connect(data.token);
            }
          } else {
            console.error("[Chat] Failed to get socket token");
          }
        } catch (error) {
          console.error("[Chat] Error fetching socket token:", error);
        }
      };
      fetchSocketToken();
    }
  }, [isOpen, hasJoined, connect]);

  // Join chat room once connected
  useEffect(() => {
    if (isOpen && isConnected && !hasJoined) {
      joinChat(tournamentId, registeredUserIds, tournamentEndTime);
      setHasJoined(true);
    }
  }, [isOpen, isConnected, hasJoined, tournamentId, registeredUserIds, tournamentEndTime, joinChat]);

  // Leave chat when modal closes
  useEffect(() => {
    if (!isOpen && hasJoined) {
      leaveChat(tournamentId);
      setHasJoined(false);
    }
  }, [isOpen, hasJoined, tournamentId, leaveChat]);

  // Scroll to bottom when new messages arrive (not when loading older messages)
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      // Only scroll if we're adding new messages (not loading old ones at top)
      const isNewMessage = prevMessageCountRef.current > 0;
      if (isNewMessage) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && hasJoined) {
      inputRef.current?.focus();
    }
  }, [isOpen, hasJoined]);

  const handleSend = useCallback(() => {
    if (inputMessage.trim()) {
      send(tournamentId, inputMessage);
      setInputMessage("");
    }
  }, [tournamentId, inputMessage, send]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = useCallback((timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-gray-900 to-gray-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💬</span>
            <div>
              <h2 className="font-semibold text-lg leading-tight">{tournamentName}</h2>
              <p className="text-xs text-gray-300">Tournament Chat</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Active Users Count */}
            {activeUserCount > 0 && (
              <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                <span className="text-sm font-medium">{activeUserCount}</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
            >
              <span className="text-xl">×</span>
            </button>
          </div>
        </div>

        {/* Connection Status */}
        {!isConnected && !isChatClosed && (
          <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-200 text-yellow-700 text-sm flex items-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full"></div>
            Connecting to chat...
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-600 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={clearError} className="text-red-500 hover:text-red-700">
              ×
            </button>
          </div>
        )}

        {/* Chat Closed Notice */}
        {isChatClosed && (
          <div className="px-4 py-8 text-center text-gray-500">
            <span className="text-4xl block mb-2">🏁</span>
            <p className="font-medium">Tournament has ended</p>
            <p className="text-sm">Chat history has been cleared</p>
          </div>
        )}

        {/* Messages */}
        {!isChatClosed && (
          <div 
            ref={scrollContainerRef} 
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 min-h-[300px]"
          >
            {/* Load more trigger at top */}
            {hasMoreMessages && (
              <div ref={messagesStartRef} className="flex justify-center py-2">
                {isLoadingMore ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                    Loading older messages...
                  </div>
                ) : (
                  <button
                    onClick={loadMoreMessages}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Load older messages
                  </button>
                )}
              </div>
            )}
            
            {/* Empty state */}
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full text-center text-gray-500 py-8">
                <div>
                  <span className="text-4xl block mb-2">👋</span>
                  <p>No messages yet. Be the first to say hello!</p>
                </div>
              </div>
            )}

            {/* Message list with memoized items */}
            {messages.map((msg: ChatMessage) => {
              const isOwnMessage = String(msg.userId) === String(currentUserId);
              return (
                <ChatMessageItem
                  key={msg.id}
                  msg={msg}
                  isOwnMessage={isOwnMessage}
                  formatTime={formatTime}
                />
              );
            })}
            
            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input */}
        {!isChatClosed && (
          <div className="p-4 bg-white border-t border-gray-200">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                maxLength={500}
                disabled={!isConnected}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSend}
                disabled={!isConnected || !inputMessage.trim()}
                className="px-6 py-2 bg-gray-900 text-white rounded-full font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Messages are temporary and will be deleted when the tournament ends
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
