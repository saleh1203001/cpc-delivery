const { kv } = require("@vercel/kv");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { invoiceId, downloadLink, previewImages, clientName, projectName } = req.body;

  if (!invoiceId || !downloadLink) {
    return res.status(400).json({ error: "invoiceId and downloadLink are required" });
  }

  const delivery = {
    invoiceId,
    downloadLink,
    previewImages: previewImages || [],
    clientName: clientName || "",
    projectName: projectName || "",
    paid: false,
    createdAt: new Date().toISOString(),
  };

  await kv.set(`delivery:${invoiceId}`, JSON.stringify(delivery));

  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : `https://${req.headers.host}`;

  const clientPageUrl = `${baseUrl}/?invoice=${invoiceId}`;

  return res.status(200).json({
    success: true,
    clientPageUrl,
    invoiceId,
  });
};
