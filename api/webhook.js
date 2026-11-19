// Webhook endpoint kept for future use (e.g., email notifications on payment)
// With the Stripe-as-database approach, payment status is read live from Stripe,
// so this webhook is not required for core functionality.

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Simply acknowledge receipt
  return res.status(200).json({ received: true });
};
