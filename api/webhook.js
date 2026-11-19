module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Parse the event - for now just acknowledge receipt
    // The check-status endpoint already polls Stripe directly
    // so the webhook just speeds up payment detection

    const event = req.body;
    
    if (event.type === 'invoice.paid') {
      const invoiceId = event.data && event.data.object && event.data.object.id;
      
      if (invoiceId) {
        // Update Redis to mark as paid
        const redisUrl = process.env.KV_REST_API_URL;
        const redisToken = process.env.KV_REST_API_TOKEN;

        const redisRes = await fetch(redisUrl + '/get/delivery:' + invoiceId, {
          headers: { Authorization: 'Bearer ' + redisToken }
        });
        const redisData = await redisRes.json();

        if (redisData.result) {
          const delivery = JSON.parse(redisData.result);
          delivery.paid = true;
          await fetch(redisUrl + '/set/delivery:' + invoiceId, {
            method: 'POST', headers: { Authorization: 'Bearer ' + redisToken },
            body: JSON.stringify([JSON.stringify(delivery)])
          });
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(200).json({ received: true });
  }
};
