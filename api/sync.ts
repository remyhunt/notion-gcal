import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runSync } from "../lib/sync";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret for automated calls, allow manual POST
  if (req.method === "GET") {
    const authHeader = req.headers["authorization"];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const result = await runSync();
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err: any) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: err.message });
  }
}
