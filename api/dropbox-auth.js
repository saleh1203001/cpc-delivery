// One-time OAuth callback to get a Dropbox refresh token.
//
// Step 1: Visit this URL in your browser (replace YOUR_APP_KEY):
//   https://www.dropbox.com/oauth2/authorize?client_id=YOUR_APP_KEY&response_type=code&token_access_type=offline
//
// Step 2: Authorize the app, Dropbox gives you a code.
//
// Step 3: Call this endpoint with the code:
//   POST /api/dropbox-auth
//   Body: { "code": "THE_CODE_FROM_DROPBOX" }
//   Header: x-admin-key: YOUR_ADMIN_KEY
//
// Step 4: Save the returned refresh_token as DROPBOX_REFRESH_TOKEN in Vercel env vars.
// Step 5: Delete this endpoint (or leave it — it's admin-key protected).

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");

  if (req.method === "OPTIONS") return res.status(200).end();

  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;

  if (!appKey || !appSecret) {
    return res.status(500).json({ error: "DROPBOX_APP_KEY and DROPBOX_APP_SECRET not configured" });
  }

  // GET: show the authorization URL
  if (req.method === "GET") {
    const authUrl = "https://www.dropbox.com/oauth2/authorize?client_id=" + appKey + "&response_type=code&token_access_type=offline";
    return res.status(200).json({
      step1: "Open this URL in your browser and authorize the app:",
      authUrl,
      step2: "Copy the code Dropbox gives you",
      step3: "POST it to this endpoint: { \"code\": \"YOUR_CODE\" }",
    });
  }

  // POST: exchange the code for a refresh token
  if (req.method === "POST") {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: "code is required" });
    }

    try {
      const tokenRes = await fetch("https://api.dropboxapi.com/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          code,
          grant_type: "authorization_code",
          client_id: appKey,
          client_secret: appSecret,
        }).toString(),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        return res.status(400).json({ error: "Token exchange failed", details: errText });
      }

      const tokenData = await tokenRes.json();

      return res.status(200).json({
        success: true,
        refresh_token: tokenData.refresh_token,
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in,
        instructions: "Save the refresh_token as DROPBOX_REFRESH_TOKEN in your Vercel environment variables. It never expires.",
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
