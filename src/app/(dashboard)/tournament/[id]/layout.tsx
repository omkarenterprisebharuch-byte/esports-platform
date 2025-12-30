import { Metadata } from "next";
import pool from "@/lib/db";

interface TournamentMetadata {
  tournament_name: string;
  description: string;
  game_type: string;
  prize_pool: number;
  tournament_banner_url: string | null;
  tournament_start_date: Date;
  max_teams: number;
  current_teams: number;
  entry_fee: number;
}

// Game type display names and emojis
const GAME_INFO: Record<string, { name: string; emoji: string }> = {
  freefire: { name: "Free Fire", emoji: "🔥" },
  pubg: { name: "PUBG", emoji: "🎯" },
  valorant: { name: "Valorant", emoji: "⚔️" },
  codm: { name: "Call of Duty Mobile", emoji: "🔫" },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  
  try {
    const result = await pool.query<TournamentMetadata>(
      `SELECT tournament_name, description, game_type, prize_pool, 
              tournament_banner_url, tournament_start_date, max_teams, 
              current_teams, entry_fee
       FROM tournaments WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return {
        title: "Tournament Not Found",
        description: "This tournament does not exist.",
      };
    }

    const tournament = result.rows[0];
    const gameInfo = GAME_INFO[tournament.game_type] || { name: tournament.game_type, emoji: "🎮" };
    const startDate = new Date(tournament.tournament_start_date).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    const title = `${tournament.tournament_name} | ${gameInfo.name} Tournament`;
    const description = tournament.description 
      ? tournament.description.slice(0, 150) + (tournament.description.length > 150 ? "..." : "")
      : `${gameInfo.emoji} ${gameInfo.name} Tournament • 💰 ₹${tournament.prize_pool} Prize Pool • 👥 ${tournament.current_teams}/${tournament.max_teams} Teams • 📅 ${startDate}`;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://esportsplatform.com";
    const tournamentUrl = `${appUrl}/tournament/${id}`;
    
    // Use tournament banner or a default OG image
    const ogImage = tournament.tournament_banner_url || `${appUrl}/og-default.png`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: tournamentUrl,
        siteName: "Esports Platform",
        images: [
          {
            url: ogImage,
            width: 1200,
            height: 630,
            alt: tournament.tournament_name,
          },
        ],
        locale: "en_IN",
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImage],
        creator: "@esportsplatform",
      },
      other: {
        // WhatsApp specific
        "og:image:width": "1200",
        "og:image:height": "630",
      },
    };
  } catch (error) {
    console.error("Error generating tournament metadata:", error);
    return {
      title: "Tournament",
      description: "View tournament details on Esports Platform",
    };
  }
}

export default function TournamentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
