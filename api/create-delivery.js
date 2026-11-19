const Stripe = require('stripe');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { invoiceId, downloadLink, previewImages, clientName, projectName } = req.body;
    if (!invoiceId || !downloadLink) {
      return res.status(400).json({ error: 'invoiceId and downloadLink are required' });
    }

    // Store in Upstash Redis via REST API
    const redisUrl = process.env.KV_REST_API_URL;
    const redisToken = process.env.KV_REST_API_TOKEN;

    const data = JSON.stringify({
      invoiceId, downloadLink, previewImages: previewImages || [],
      clientName: clientName || '', projectName: projectName || '',
      paid: false, createdAt: new Date().toISOString()
    });

    const redisRes = await fetch(redisUrl + '/set/delivery:' + invoiceId, {
      method: 'POST', headers: { Authorization: 'Bearer ' + redisToken },
      body: JSON.stringify([data])
    });

    if (!redisRes.ok) throw new Error('Redis error: ' + redisRes.status);

    const clientPageUrl = 'https://cpc-delivery.vercel.app/?invoice=' + encodeURIComponent(invoiceId);
    res.status(200).json({ success: true, clientPageUrl });
  } catch (err) {
    console.error('Create delivery error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
