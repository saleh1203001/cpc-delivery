const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { invoiceId, downloadLink, previewImages, clientName, projectName } =
    req.body;

  if (!invoiceId || !downloadLink) {
    return res
      .status(400)
      .json({ error: "invoiceId and downloadLink are required" });
  }

  // Store delivery data in the Stripe invoice metadata (no DB needed)
  try {
    await stripe.invoices.update(invoiceId, {
      metadata: {
        downloadLink,
        previewImages: JSON.stringify(previewImages || []),
        clientName: clientName || "",
        projectName: projectName || "",
        cpc_delivery: "true",
      },
    });
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
