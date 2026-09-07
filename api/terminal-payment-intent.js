// Creates the PaymentIntent a physical Stripe Terminal card reader charges
// against, for a kiosk order. Scoped to source = 'kiosk' only (enforced in
// the query below).
//
// Unlike create-checkout-session.js, this does NOT recompute the price from
// menu_items — it charges `orders.total` directly. That's safe specifically
// for kiosk orders because that column was never client-writable to begin
// with: place_kiosk_order (a security-definer RPC using the service-role
// key) is the only thing that ever sets it, already recomputing every line
// from menu_items and validating any voucher/promo code server-side. The
// regular website's orders don't have that guarantee (their total can be
// set by ordinary client code before this kind of endpoint verifies it),
// which is exactly why create-checkout-session.js still does its own
// independent recompute for those.
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

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
      .select('id, lines, total, source')
      .eq('id', orderId)
      .eq('source', 'kiosk')
      .maybeSingle();

    if (orderError || !order || !Array.isArray(order.lines) || order.lines.length === 0) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const amount = Math.round(Number(order.total) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'eur',
      payment_method_types: ['card_present'],
      capture_method: 'automatic',
      metadata: { orderId },
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
