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

  // Everything lives in Stripe — no database needed
  let stripeInvoice;
  try {
    stripeInvoice = await stripe.invoices.retrieve(invoice);
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    return res.status(500).json({ error: "Failed to fetch invoice" });
  }

  const meta = stripeInvoice.metadata || {};

  // Only return deliveries we've set up (have cpc_delivery flag)
  if (meta.cpc_delivery !== "true") {
    return res.status(404).json({ error: "Delivery not found" });
  }

  let previewImages = [];
  try {
    previewImages = JSON.parse(meta.previewImages || "[]");
  } catch (e) {
    previewImages = [];
  }

  return res.status(200).json({
    invoiceId: stripeInvoice.id,
    clientName: meta.clientName || "",
    projectName: meta.projectName || "",
    previewImages,
    paid: stripeInvoice.status === "paid",
    hostedInvoiceUrl: stripeInvoice.hosted_invoice_url,
    amountDue: stripeInvoice.amount_due,
    currency: stripeInvoice.currency,
  });
};
