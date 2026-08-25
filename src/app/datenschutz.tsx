import React from 'react';
import LegalContent from '../components/LegalContent';

export default function DatenschutzScreen() {
  return (
    <LegalContent
      title="Datenschutzerklärung"
      sections={[
        {
          heading: '1. Verantwortlicher',
          body: [
            '[Your full legal name / business name], [Street and house number], [Postcode and city], Germany. E-Mail: [Your business email address].',
          ],
        },
        {
          heading: '2. Welche Daten wir verarbeiten',
          body: [
            'Kontodaten: E-Mail-Adresse und Passwort (Passwörter werden von unserem Auth-Anbieter Supabase gehasht gespeichert, uns liegt das Klartext-Passwort nie vor). Optional: Geburtsjahr, freiwillig bei der Registrierung angegeben.',
            'Bestelldaten: bestellte Artikel, Preise, gewählte Zahlungsart, Lieferadresse (bei Lieferung) inklusive der daraus ermittelten Koordinaten, Bestellzeitpunkt und -status.',
            'Technische Daten: Standard-Server-/Hosting-Logs unseres Hosting-Anbieters (Vercel).',
          ],
        },
        {
          heading: '3. Zweck und Rechtsgrundlage',
          body: [
            'Konto- und Bestelldaten verarbeiten wir zur Erfüllung des Bestellvertrags (Art. 6 Abs. 1 lit. b DSGVO) — also um Ihr Konto zu führen, Ihre Bestellung zuzustellen und den Liefer-Umkreis zu prüfen.',
            'Das optionale Geburtsjahr verarbeiten wir auf Grundlage Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), ausschließlich in aggregierter, anonymisierter Form (z. B. "10 Kund*innen zwischen 25–34"), nie einzelnen Personen zugeordnet sichtbar.',
          ],
        },
        {
          heading: '4. Eingesetzte Dienstleister (Auftragsverarbeiter)',
          body: [
            'Supabase (Authentifizierung, Datenbank) — verarbeitet Konto- und Bestelldaten in unserem Auftrag.',
            'Mapbox — wandelt eine eingegebene Adresse in Koordinaten um, um den Liefer-Umkreis zu prüfen.',
            'Stripe — verarbeitet Kartenzahlungen; uns liegen keine vollständigen Kartendaten vor.',
            'Vercel — hostet diese Website.',
            'Mit allen genannten Anbietern bestehen bzw. sind Auftragsverarbeitungsverträge abzuschließen. [Confirm these are in place — most of these providers offer a standard DPA you can accept in their dashboard.]',
          ],
        },
        {
          heading: '5. Speicherdauer',
          body: [
            'Wir speichern Ihre Daten so lange, wie es für die oben genannten Zwecke erforderlich ist, oder so lange, wie gesetzliche Aufbewahrungspflichten (z. B. handels- und steuerrechtliche Fristen für Bestell-/Rechnungsdaten) bestehen. [Confirm exact retention periods with your Steuerberater.]',
          ],
        },
        {
          heading: '6. Ihre Rechte',
          body: [
            'Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch gegen die Verarbeitung Ihrer Daten sowie das Recht, eine erteilte Einwilligung jederzeit zu widerrufen. Wenden Sie sich dazu an die oben genannte E-Mail-Adresse.',
            'Sie haben außerdem das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren.',
          ],
        },
        {
          heading: '7. Cookies und lokaler Speicher',
          body: [
            'Wir setzen technisch notwendige lokale Speicherung (localStorage) ein, um Sie eingeloggt zu halten (über Supabase Auth). Wir setzen derzeit keine Analyse- oder Werbe-Cookies ein.',
          ],
        },
      ]}
    />
  );
}
