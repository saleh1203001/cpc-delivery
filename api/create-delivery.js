const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const {
    invoiceId,
    downloadLink,
    dropboxFolder,
    previewImages,
    clientName,
    projectName,
  } = req.body;

  if (!invoiceId || !downloadLink) {
    return res
      .status(400)
      .json({ error: "invoiceId and downloadLink are required" });
  }

  // Build metadata object
  const metadata = {
    downloadLink,
    clientName: clientName || "",
    projectName: projectName || "",
    cpc_delivery: "true",
  };

  // Support both Dropbox folder (auto-previews) and manual preview URLs
  if (dropboxFolder) {
    metadata.dropboxFolder = dropboxFolder;
  }
  if (previewImages && previewImages.length > 0) {
    metadata.previewImages = JSON.stringify(previewImages);
  }

  // Store delivery data in the Stripe invoice metadata (no DB needed)
  try {
    await stripe.invoices.update(invoiceId, { metadata });
  } catch (err) {
    return res
      .status(400)
      .json({ error: "Failed to update invoice: " + err.message });
  }

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
