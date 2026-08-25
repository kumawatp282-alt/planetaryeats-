// Vercel serverless function (Node runtime) — the one server-side piece of
// this otherwise-static site. Creates a real Stripe Checkout Session using
// the secret key, which must never reach the browser bundle.
const Stripe = require('stripe');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const { orderId, lines, deliveryFee, discount, origin } = req.body || {};

  if (!orderId || !Array.isArray(lines) || lines.length === 0) {
    res.status(400).json({ error: 'Missing order details' });
    return;
  }

  try {
    const line_items = lines.map((line) => ({
      price_data: {
        currency: 'eur',
        product_data: { name: line.name },
        unit_amount: Math.round(line.unitPrice * 100),
      },
      quantity: line.quantity,
    }));

    if (deliveryFee > 0) {
      line_items.push({
        price_data: {
          currency: 'eur',
          product_data: { name: 'Delivery fee' },
          unit_amount: Math.round(deliveryFee * 100),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      discounts:
        discount > 0
          ? [
              {
                coupon: await stripe.coupons
                  .create({ amount_off: Math.round(discount * 100), currency: 'eur', duration: 'once' })
                  .then((c) => c.id),
              },
            ]
          : undefined,
      success_url: `${origin}/order-confirmation?orderId=${encodeURIComponent(orderId)}`,
      cancel_url: `${origin}/checkout`,
      metadata: { orderId },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
