import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createImpressionToken, type ServedAd } from "@/lib/ads";

export const dynamic = "force-dynamic";

// Ad row type from database (matching actual schema)
interface AdRow {
  ad_id: number;
  title?: string;
  description?: string;
  image_url?: string;
  link_url: string;
  position: string;
}

// GET /api/ads?placement=dashboard_top - Get ad for placement
// POST /api/ads/impression - Track impression
// POST /api/ads/click - Track click

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const placementId = searchParams.get("placement");
    
    if (!placementId) {
      return NextResponse.json(
        { success: false, message: "Placement ID required" },
        { status: 400 }
      );
    }
    
    // Get eligible ads for this placement (using actual DB schema)
    let rows: AdRow[] = [];
    try {
      rows = await query<AdRow>(
        `SELECT 
          a.id as ad_id,
          a.title,
          a.description,
          a.image_url,
          a.link_url,
          a.position
        FROM advertisements a
        WHERE 
          a.is_active = true
          AND a.position = $1
          AND (a.start_date IS NULL OR a.start_date <= NOW())
          AND (a.end_date IS NULL OR a.end_date > NOW())
        ORDER BY RANDOM()
        LIMIT 1`,
        [placementId]
      );
    } catch (queryError) {
      // Table might not exist or no ads yet - return null ad gracefully
      console.log("No ads available or table not ready:", queryError);
      return NextResponse.json({ success: true, ad: null });
    }
    
    if (rows.length === 0) {
      return NextResponse.json({ success: true, ad: null });
    }
    
    const adRow = rows[0];
    const timestamp = Date.now();
    const impressionToken = createImpressionToken(adRow.ad_id, placementId, timestamp);
    
    // Map to ServedAd format (treating all as banner type)
    const ad: ServedAd = {
      adId: adRow.ad_id,
      name: adRow.title || "Ad",
      adType: "banner" as ServedAd["adType"],
      imageUrl: adRow.image_url,
      title: adRow.title,
      description: adRow.description,
      ctaText: "Learn More",
      destinationUrl: adRow.link_url,
      impressionToken,
    };
    
    return NextResponse.json({ success: true, ad });
  } catch (error) {
    console.error("Error fetching ad:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch ad" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    if (action === "impression") {
      return handleImpression(request, body);
    } else if (action === "click") {
      return handleClick(request, body);
    } else {
      return NextResponse.json(
        { success: false, message: "Invalid action" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error processing ad action:", error);
    return NextResponse.json(
      { success: false, message: "Failed to process action" },
      { status: 500 }
    );
  }
}

async function handleImpression(request: NextRequest, body: {
  adId: number;
  placementId: string;
  impressionToken: string;
  sessionId?: string;
  pageUrl?: string;
  viewDurationMs?: number;
  viewabilityPercent?: number;
}) {
  const { adId, placementId, sessionId } = body;
  
  if (!adId || !placementId) {
    return NextResponse.json(
      { success: false, message: "Ad ID and placement ID required" },
      { status: 400 }
    );
  }
  
  try {
    // Increment impressions counter on advertisements table (using actual schema)
    await query(
      `UPDATE advertisements SET impressions = COALESCE(impressions, 0) + 1, updated_at = NOW() WHERE id = $1`,
      [adId]
    );
    
    return NextResponse.json({ 
      success: true, 
      impressionId: Date.now(),
      message: "Impression recorded" 
    });
  } catch (error) {
    console.log("Failed to record impression:", error);
    return NextResponse.json({ 
      success: true, 
      message: "Impression noted" 
    });
  }
}

async function handleClick(request: NextRequest, body: {
  adId: number;
  impressionId?: number;
  placementId: string;
  sessionId?: string;
  pageUrl?: string;
  destinationUrl?: string;
  timeToClickMs?: number;
}) {
  const { adId, placementId } = body;
  
  if (!adId || !placementId) {
    return NextResponse.json(
      { success: false, message: "Ad ID and placement ID required" },
      { status: 400 }
    );
  }
  
  try {
    // Increment clicks counter on advertisements table (using actual schema)
    await query(
      `UPDATE advertisements SET clicks = COALESCE(clicks, 0) + 1, updated_at = NOW() WHERE id = $1`,
      [adId]
    );
    
    return NextResponse.json({ 
      success: true, 
      valid: true,
      message: "Click recorded"
    });
  } catch (error) {
    console.log("Failed to record click:", error);
    return NextResponse.json({ 
      success: true, 
      valid: true,
      message: "Click noted"
    });
  }
}
