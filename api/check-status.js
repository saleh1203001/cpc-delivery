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

    // Also check Stripe for latest invoice status
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const invoice = await stripe.invoices.retrieve(invoiceId);

    const paid = invoice.status === 'paid' || delivery.paid;

    // If Stripe says paid but Redis doesn't, update Redis
    if (invoice.status === 'paid' && !delivery.paid) {
      delivery.paid = true;
      await fetch(redisUrl + '/set/delivery:' + invoiceId, {
        method: 'POST', headers: { Authorization: 'Bearer ' + redisToken },
        body: JSON.stringify([JSON.stringify(delivery)])
      });
    }

    res.status(200).json({
      paid, projectName: delivery.projectName, clientName: delivery.clientName,
      previewImages: delivery.previewImages,
      amountDue: invoice.amount_due, currency: invoice.currency,
      hostedInvoiceUrl: invoice.hosted_invoice_url
    });
  } catch (err) {
    console.error('Check status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
