// Renders a QR code as a plain <Image> — generated client-side via the
// `qrcode` package (pure JS, no network call), so this works the same
// offline as it does live.
import React, { useEffect, useState } from 'react';
import { Image } from 'react-native';
import QRCode from 'qrcode';

export default function QrCode({ value, size = 160 }: { value: string; size?: number }) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { width: size, margin: 1 }).then((dataUrl) => {
      if (!cancelled) setUri(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!uri) return null;
  return <Image source={{ uri }} style={{ width: size, height: size }} />;
}
