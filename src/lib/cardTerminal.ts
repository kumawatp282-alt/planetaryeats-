// Physical card-reader integration for the kiosk's "Pay by card" flow, via
// Stripe Terminal (https://stripe.com/docs/terminal). Web-only — only ever
// imported from app/kiosk.tsx, and every call here degrades gracefully to
// "no reader" if the Stripe Terminal script can't load or nothing is
// registered yet, so the kiosk keeps working with today's browser-checkout
// flow until a real reader exists.
//
// HARDWARE NOTE: only Stripe's own internet-connected "Smart Reader"
// (Stripe Reader S700) works here — the cheaper Bluetooth BBPOS WisePad 3
// needs the Web Bluetooth API for browser pairing, which Safari (and so
// every iPad browser) does not support at all. Buy the S700, not the
// WisePad 3, and register it to your Stripe account's default location
// from the reader's own on-screen setup before it'll be found here.
import { loadStripeTerminal } from '@stripe/terminal-js';

let terminalPromise: Promise<any> | null = null;

async function getTerminal(): Promise<any> {
  if (!terminalPromise) {
    terminalPromise = loadStripeTerminal().then((StripeTerminal) => {
      if (!StripeTerminal) throw new Error('Stripe Terminal failed to load');
      return StripeTerminal.create({
        onFetchConnectionToken: async () => {
          const res = await fetch('/api/terminal-connection-token', { method: 'POST' });
          const data = await res.json();
          if (!data.secret) throw new Error(data.error || 'Could not fetch connection token');
          return data.secret as string;
        },
        onUnexpectedReaderDisconnect: () => {
          // The next payment attempt notices getConnectedReader() is empty
          // and reconnects on its own — nothing to do here.
        },
      });
    });
  }
  return terminalPromise;
}

export async function hasConnectedReader(): Promise<boolean> {
  try {
    const terminal = await getTerminal();
    return Boolean(terminal.getConnectedReader());
  } catch {
    return false;
  }
}

export async function connectReader(): Promise<{ connected: boolean; error?: string }> {
  try {
    const terminal = await getTerminal();
    if (terminal.getConnectedReader()) return { connected: true };

    const discoverResult = await terminal.discoverReaders({ discoveryMethod: 'internet' });
    if (discoverResult.error) return { connected: false, error: discoverResult.error.message };
    const readers = discoverResult.discoveredReaders || [];
    if (readers.length === 0) return { connected: false, error: 'No card reader found on this Stripe account.' };

    const connectResult = await terminal.connectReader(readers[0]);
    if (connectResult.error) return { connected: false, error: connectResult.error.message };
    return { connected: true };
  } catch (err: any) {
    return { connected: false, error: err?.message || 'Could not reach the card reader.' };
  }
}

export async function chargeOnReader(orderId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const ready = await connectReader();
    if (!ready.connected) return { success: false, error: ready.error || 'Card reader not connected.' };

    const terminal = await getTerminal();
    const intentRes = await fetch('/api/terminal-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });
    const intentData = await intentRes.json();
    if (!intentData.clientSecret) return { success: false, error: intentData.error || 'Could not start the payment.' };

    const collectResult = await terminal.collectPaymentMethod(intentData.clientSecret);
    if (collectResult.error) return { success: false, error: collectResult.error.message };

    const processResult = await terminal.processPayment(collectResult.paymentIntent);
    if (processResult.error) return { success: false, error: processResult.error.message };

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Card payment failed.' };
  }
}
