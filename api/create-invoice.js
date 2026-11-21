const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { customerEmail, description, amount } = req.body;

  try {
    // Find or create customer
    let customer;
    const customers = await stripe.customers.list({ email: customerEmail || "test@example.com", limit: 1 });
    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      customer = await stripe.customers.create({ email: customerEmail || "test@example.com", name: "Test Client" });
    }

    // Create invoice
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      auto_advance: false,
    });

    // Add invoice item
    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      description: description || "Photo Editing Service",
      amount: amount || 15000,
      currency: "usd",
    });

    // Finalize the invoice so it can be paid
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

    return res.status(200).json({
      invoiceId: finalizedInvoice.id,
      hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url,
      amountDue: finalizedInvoice.amount_due,
      status: finalizedInvoice.status,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
