const Stripe = require('stripe');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const invoiceId = req.query.invoice;
  if (!invoiceId) return res.status(400).json({ error: 'invoice parameter required' });

  try {
    // Get delivery data from Upstash Redis
    const redisUrl = process.env.KV_REST_API_URL;
    const redisToken = process.env.KV_REST_API_TOKEN;

    const redisRes = await fetch(redisUrl + '/get/delivery:' + invoiceId, {
      headers: { Authorization: 'Bearer ' + redisToken }
    });
    const redisData = await redisRes.json();

    if (!redisData.result) return res.status(404).json({ error: 'Delivery not found' });

    const delivery = JSON.parse(redisData.result);

    // Double-check with Stripe that invoice is paid
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const invoice = await stripe.invoices.retrieve(invoiceId);

    if (invoice.status !== 'paid') {
      return res.status(403).json({ error: 'Invoice not yet paid' });
    }

    // Only return download link if payment confirmed
    res.status(200).json({ downloadLink: delivery.downloadLink });
  } catch (err) {
    console.error('Get link error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
