/**
 * Report Categories API
 * 
 * GET - Get all report categories with subcategories
 */

import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-response";

/**
 * GET /api/reports/categories - Get all active report categories
 */
export async function GET(request: NextRequest) {
  try {
    // Get all categories
    const result = await pool.query(
      `SELECT id, name, description, parent_id, display_order
       FROM report_categories
       WHERE is_active = TRUE
       ORDER BY display_order, name`
    );

    // Organize into hierarchy
    const categories = result.rows.filter((c) => c.parent_id === null);
    const subcategories = result.rows.filter((c) => c.parent_id !== null);

    const categoriesWithSubs = categories.map((cat) => ({
      ...cat,
      subcategories: subcategories
        .filter((sub) => sub.parent_id === cat.id)
        .map((sub) => ({
          id: sub.id,
          name: sub.name,
          description: sub.description,
        })),
    }));

    return successResponse({ categories: categoriesWithSubs });
  } catch (error) {
    console.error("Get report categories error:", error);
    return errorResponse("Failed to fetch categories", 500);
  }
}
