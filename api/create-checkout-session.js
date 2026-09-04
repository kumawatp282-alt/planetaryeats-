// Vercel serverless function (Node runtime) — the one server-side piece of
// this otherwise-static site. Creates a real Stripe Checkout Session using
// the secret key, which must never reach the browser bundle.
//
// SECURITY: every euro amount here is recomputed from the database using
// the service-role key, never taken from the request body. The previous
// version trusted a client-submitted unitPrice/discount, which meant a
// tampered request could make Stripe charge less than the real menu price.
// The browser now only tells us *which* order to charge for and *which*
// discount it claims — this function independently verifies both against
// menu_items / vouchers / app_settings before Stripe ever sees an amount.
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const DELIVERY_FEE = 2.99; // must match DELIVERY_FEE in context/StoreContext.tsx

async function resolveDiscount(supabase, body, order, subtotal) {
  const voucherId = body?.voucherId;
  if (voucherId) {
    const { data: voucher } = await supabase
      .from('vouchers')
      .select('user_id, type, value, redeemed, expires_at')
      .eq('id', voucherId)
      .maybeSingle();
    if (!voucher || voucher.redeemed) return 0;
    const ownedByOrder = voucher.user_id === null || voucher.user_id === order.user_id;
    const notExpired = !voucher.expires_at || new Date(voucher.expires_at) > new Date();
    if (!ownedByOrder || !notExpired) return 0;
    const raw = voucher.type === 'percent' ? subtotal * (Number(voucher.value) / 100) : Number(voucher.value);
    return Math.min(raw, subtotal);
  }

  const promoCode = body?.promoCode;
  if (promoCode) {
    const { data: settings } = await supabase
      .from('app_settings')
      .select('promo_code, promo_discount')
      .eq('id', 1)
      .maybeSingle();
    if (settings?.promo_code && String(promoCode).trim().toUpperCase() === settings.promo_code.trim().toUpperCase()) {
      return subtotal * Number(settings.promo_discount ?? 0);
    }
  }

  return 0;
}

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
  const { orderId, origin } = req.body || {};

  if (!orderId || !origin) {
    res.status(400).json({ error: 'Missing order details' });
    return;
  }

  try {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, lines, fulfillment')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order || !Array.isArray(order.lines) || order.lines.length === 0) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const itemIds = [...new Set(order.lines.map((line) => line.item && line.item.id).filter(Boolean))];
    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('id, name, price, add_ons')
      .in('id', itemIds);

    if (menuError || !menuItems) {
      res.status(500).json({ error: 'Could not verify menu prices' });
      return;
    }
    const menuById = new Map(menuItems.map((m) => [m.id, m]));

    let subtotal = 0;
    const line_items = order.lines.map((line) => {
      const menuItem = menuById.get(line.item && line.item.id);
      if (!menuItem) {
        throw new Error(`Order references a menu item that no longer exists: ${line.item && line.item.id}`);
      }
      const addOnsTotal = (menuItem.add_ons || [])
        .filter((addOn) => (line.selectedAddOnIds || []).includes(addOn.id))
        .reduce((sum, addOn) => sum + Number(addOn.price), 0);
      const unitPrice = Number(menuItem.price) + addOnsTotal;
      subtotal += unitPrice * line.quantity;
      return {
        price_data: {
          currency: 'eur',
          product_data: { name: menuItem.name },
          unit_amount: Math.round(unitPrice * 100),
        },
        quantity: line.quantity,
      };
    });

    const deliveryFee = order.fulfillment && order.fulfillment.method === 'delivery' ? DELIVERY_FEE : 0;
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

    const discount = await resolveDiscount(supabase, req.body, order, subtotal);

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

    // Keep the stored order in sync with the verified amount actually
    // charged, in case the client-computed total it was inserted with
    // (before this endpoint ever ran) drifted from the real price.
    const verifiedTotal = Math.max(subtotal - discount, 0) + deliveryFee;
    await supabase.from('orders').update({ total: verifiedTotal }).eq('id', orderId);

    res.status(200).json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
