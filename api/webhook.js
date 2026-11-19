const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { kv } = require("@vercel/kv");

module.exports.config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawBody = await getRawBody(req);
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object;
    const invoiceId = invoice.id;
    const raw = await kv.get(`delivery:${invoiceId}`);
    if (raw) {
      const delivery = typeof raw === "string" ? JSON.parse(raw) : raw;
      delivery.paid = true;
      delivery.paidAt = new Date().toISOString();
      await kv.set(`delivery:${invoiceId}`, JSON.stringify(delivery));
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const invoiceId = session.metadata?.invoiceId;
    if (invoiceId) {
      const raw = await kv.get(`delivery:${invoiceId}`);
      if (raw) {
        const delivery = typeof raw === "string" ? JSON.parse(raw) : raw;
        delivery.paid = true;
        delivery.paidAt = new Date().toISOString();
        await kv.set(`delivery:${invoiceId}`, JSON.stringify(delivery));
      }
    }
  }

  return res.status(200).json({ received: true });
};
