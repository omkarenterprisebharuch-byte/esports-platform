"use client";

import { useState, useEffect } from "react";
import { secureFetch } from "@/lib/api-client";

interface ReportCategory {
  id: number;
  name: string;
  description: string;
  subcategories: Array<{
    id: number;
    name: string;
    description: string;
  }>;
}

interface ReportPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportedGameId: string;
  reportedGameType: string;
  reportedUserId?: number;
  reportedUsername?: string;
  tournamentId?: number;
  matchId?: number;
}

export default function ReportPlayerModal({
  isOpen,
  onClose,
  reportedGameId,
  reportedGameType,
  reportedUserId,
  reportedUsername,
  tournamentId,
  matchId,
}: ReportPlayerModalProps) {
  const [categories, setCategories] = useState<ReportCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [newEvidenceUrl, setNewEvidenceUrl] = useState("");

  // Fetch categories on mount
  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    try {
      const res = await secureFetch("/api/reports/categories");
      const data = await res.json();
      if (data.success) {
        setCategories(data.data.categories);
      }
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvidence = () => {
    if (newEvidenceUrl && evidenceUrls.length < 5) {
      try {
        new URL(newEvidenceUrl); // Validate URL
        setEvidenceUrls([...evidenceUrls, newEvidenceUrl]);
        setNewEvidenceUrl("");
      } catch {
        setError("Please enter a valid URL");
      }
    }
  };

  const handleRemoveEvidence = (index: number) => {
    setEvidenceUrls(evidenceUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedCategory) {
      setError("Please select a category");
      return;
    }

    if (description.length < 10) {
      setError("Please provide a detailed description (at least 10 characters)");
      return;
    }

    setSubmitting(true);

    try {
      const res = await secureFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          reported_game_id: reportedGameId,
          reported_game_type: reportedGameType,
          reported_user_id: reportedUserId,
          tournament_id: tournamentId,
          match_id: matchId,
          category_id: selectedCategory,
          subcategory_id: selectedSubcategory,
          description,
          evidence_urls: evidenceUrls,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          resetForm();
        }, 2000);
      } else {
        setError(data.message || "Failed to submit report");
      }
    } catch (err) {
      setError("Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setDescription("");
    setEvidenceUrls([]);
    setNewEvidenceUrl("");
    setSuccess(false);
    setError(null);
  };

  const selectedCategoryData = categories.find((c) => c.id === selectedCategory);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              🚨 Report Player
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {reportedUsername || reportedGameId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {success ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Report Submitted
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Thank you for your report. Our team will review it shortly.
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-gray-900 dark:border-white border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Report Category *
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(category.id);
                        setSelectedSubcategory(null);
                      }}
                      className={`p-3 rounded-lg border text-left transition ${
                        selectedCategory === category.id
                          ? "border-red-500 bg-red-50 dark:bg-red-900/30"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-white">
                        {category.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {category.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subcategory Selection */}
              {selectedCategoryData && selectedCategoryData.subcategories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Specific Issue (Optional)
                  </label>
                  <select
                    value={selectedSubcategory || ""}
                    onChange={(e) => setSelectedSubcategory(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                  >
                    <option value="">Select specific issue...</option>
                    {selectedCategoryData.subcategories.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please describe what happened in detail..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none resize-none"
                  required
                  minLength={10}
                  maxLength={2000}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {description.length}/2000 characters
                </p>
              </div>

              {/* Evidence URLs */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Evidence (Screenshots/Videos)
                </label>
                
                {evidenceUrls.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {evidenceUrls.map((url, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2"
                      >
                        <span className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1">
                          {url}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEvidence(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {evidenceUrls.length < 5 && (
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={newEvidenceUrl}
                      onChange={(e) => setNewEvidenceUrl(e.target.value)}
                      placeholder="Paste image/video URL..."
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddEvidence}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
                    >
                      Add
                    </button>
                  </div>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Upload screenshots to Imgur or similar and paste the URL (max 5)
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || !selectedCategory || description.length < 10}
                className="w-full py-3 px-4 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting..." : "Submit Report"}
              </button>

              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                False reports may result in penalties. Please only report genuine violations.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
