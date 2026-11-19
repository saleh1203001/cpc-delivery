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

  // Everything lives in Stripe — single source of truth
  let stripeInvoice;
  try {
    stripeInvoice = await stripe.invoices.retrieve(invoice);
  } catch (err) {
    return res.status(404).json({ error: "Invoice not found" });
  }

  // Verify payment status directly from Stripe
  if (stripeInvoice.status !== "paid") {
    return res.status(403).json({ error: "Payment not completed" });
  }

  const meta = stripeInvoice.metadata || {};
  if (!meta.downloadLink) {
    return res.status(404).json({ error: "No download link configured" });
  }

  return res.status(200).json({
    downloadLink: meta.downloadLink,
    projectName: meta.projectName || "",
  });
};
