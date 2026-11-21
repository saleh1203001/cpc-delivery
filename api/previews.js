const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { invoice } = req.query;
  if (!invoice) {
    return res.status(400).json({ error: "invoice parameter required" });
  }

  let stripeInvoice;
  try {
    stripeInvoice = await stripe.invoices.retrieve(invoice);
  } catch (err) {
    return res.status(404).json({ error: "Invoice not found" });
  }

  const meta = stripeInvoice.metadata || {};
  if (meta.cpc_delivery !== "true" || !meta.dropboxFolder) {
    return res.status(404).json({ error: "No preview folder configured" });
  }

  const dropboxToken = process.env.DROPBOX_ACCESS_TOKEN;
  if (!dropboxToken) {
    return res.status(500).json({ error: "Dropbox not configured" });
  }

  try {
    const listRes = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + dropboxToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: meta.dropboxFolder, limit: 200 }),
    });

    if (!listRes.ok) {
      const errText = await listRes.text();
      console.error("Dropbox list error:", errText);
      return res.status(502).json({ error: "Failed to list Dropbox folder" });
    }

    const listData = await listRes.json();
    const imageExts = [".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".webp"];
    const imageFiles = listData.entries.filter(
      (f) => f[".tag"] === "file" && imageExts.some((ext) => f.name.toLowerCase().endsWith(ext))
    );

    const thumbnails = [];
    const batchSize = 25;

    for (let i = 0; i < imageFiles.length; i += batchSize) {
      const batch = imageFiles.slice(i, i + batchSize);
      const entries = batch.map((f) => ({
        path: f.path_lower,
        format: "jpeg",
        size: "w128h128",
      }));

      const thumbRes = await fetch("https://content.dropboxapi.com/2/files/get_thumbnail_batch", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + dropboxToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ entries }),
      });

      if (thumbRes.ok) {
        const thumbData = await thumbRes.json();
        for (const entry of thumbData.entries) {
          if (entry[".tag"] === "success") {
            thumbnails.push({
              name: entry.metadata.name,
              thumbnail: "data:image/jpeg;base64," + entry.thumbnail,
            });
          }
        }
      }
    }

    return res.status(200).json({ totalFiles: imageFiles.length, thumbnails });
  } catch (err) {
    console.error("Preview error:", err);
    return res.status(500).json({ error: "Failed to fetch previews" });
  }
};
