/**
 * Generate invite codes for teams that don't have one
 * Run: npx tsx scripts/generate-missing-invite-codes.ts
 */

import pool from "../src/lib/db";

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function generateMissingInviteCodes() {
  try {
    console.log("🔍 Finding teams without invite codes...");

    // Get teams without invite codes
    const result = await pool.query(
      "SELECT id, team_name FROM teams WHERE invite_code IS NULL"
    );

    if (result.rows.length === 0) {
      console.log("✅ All teams already have invite codes!");
      process.exit(0);
    }

    console.log(`📝 Found ${result.rows.length} teams without invite codes`);

    let updated = 0;
    for (const team of result.rows) {
      let inviteCode: string;
      let isUnique = false;

      // Generate unique invite code
      while (!isUnique) {
        inviteCode = generateInviteCode();
        const existing = await pool.query(
          "SELECT id FROM teams WHERE invite_code = $1",
          [inviteCode]
        );
        if (existing.rows.length === 0) {
          isUnique = true;
        }
      }

      // Update team
      await pool.query(
        "UPDATE teams SET invite_code = $1 WHERE id = $2",
        [inviteCode!, team.id]
      );

      updated++;
      console.log(`✅ Updated team "${team.team_name}" with invite code: ${inviteCode!}`);
    }

    console.log(`\n🎉 Successfully generated invite codes for ${updated} teams!`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error generating invite codes:", error);
    process.exit(1);
  }
}

generateMissingInviteCodes();
