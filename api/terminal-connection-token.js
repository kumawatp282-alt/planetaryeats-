// Stripe Terminal needs a fresh, short-lived "connection token" every time
// the kiosk's browser talks to a physical card reader — created server-side
// with the secret key (same reason create-checkout-session.js exists: the
// secret key must never reach the browser bundle).
const Stripe = require('stripe');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const connectionToken = await stripe.terminal.connectionTokens.create();
    res.status(200).json({ secret: connectionToken.secret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
