// Creates the PaymentIntent a physical Stripe Terminal card reader charges
// against, for a kiosk order. Same security rule as create-checkout-session.js:
// the amount is recomputed from menu_items using the service-role key, never
// taken from the request body — the kiosk browser only says *which* order.
// Scoped to source = 'kiosk' only (enforced in the query below) since this
// is a distinct, guest/anonymous order path from the regular website's own
// Checkout Session flow.
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { computeOrderPricing } = require('./_lib/orderPricing');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Server misconfigured — missing SUPABASE_SERVICE_ROLE_KEY.' });
    return;
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { orderId } = req.body || {};

  if (!orderId) {
    res.status(400).json({ error: 'Missing orderId' });
    return;
  }

  try {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, lines, source')
      .eq('id', orderId)
      .eq('source', 'kiosk')
      .maybeSingle();

    if (orderError || !order || !Array.isArray(order.lines) || order.lines.length === 0) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const { subtotal } = await computeOrderPricing(supabase, order);
    const amount = Math.round(subtotal * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'eur',
      payment_method_types: ['card_present'],
      capture_method: 'automatic',
      metadata: { orderId },
    });

    // Keep the stored order in sync with the verified amount, same as the
    // Checkout Session flow does.
    await supabase.from('orders').update({ total: subtotal }).eq('id', orderId);

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
