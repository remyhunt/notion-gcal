import type { VercelRequest, VercelResponse } from "@vercel/node";
import { google } from "googleapis";

// One-time use: exchange OAuth code for refresh token
// 1. Visit: https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&response_type=code&scope=https://www.googleapis.com/auth/calendar&access_type=offline&prompt=consent
// 2. It redirects here with ?code=xxx
// 3. Copy the refresh_token from the response and add it to your env vars

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = req.query.code as string;
  if (!code) {
    return res.status(400).json({ error: "No code provided" });
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/auth/callback`
  );

  try {
    const { tokens } = await oauth2.getToken(code);
    return res.status(200).json({
      message: "Copy the refresh_token below and add it as GOOGLE_REFRESH_TOKEN in your Vercel env vars",
      refresh_token: tokens.refresh_token,
      note: "You only need to do this once. Delete this endpoint after.",
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
