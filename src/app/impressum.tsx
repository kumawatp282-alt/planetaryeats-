import React from 'react';
import LegalContent from '../components/LegalContent';

export default function ImpressumScreen() {
  return (
    <LegalContent
      title="Impressum"
      sections={[
        {
          heading: 'Angaben gemäß § 5 TMG',
          body: [
            '[Your full legal name / business name]',
            '[Street and house number]',
            '[Postcode and city]',
            'Germany',
          ],
        },
        {
          heading: 'Kontakt',
          body: ['Telefon: [Your phone number]', 'E-Mail: [Your business email address]'],
        },
        {
          heading: 'Umsatzsteuer-ID',
          body: [
            'Umsatzsteuer-Identifikationsnummer gemäß §27a Umsatzsteuergesetz: [Your VAT ID, if you have one — leave this section out entirely if you\'re operating under the Kleinunternehmerregelung].',
          ],
        },
        {
          heading: 'Registereintrag',
          body: [
            '[If registered in the Handelsregister: registering court and registration number. If you\'re operating as an Einzelunternehmen without a Handelsregister entry, this section can be removed.]',
          ],
        },
        {
          heading: 'Verantwortlich für den Inhalt',
          body: ['[Your name and the same address as above], gemäß § 18 Abs. 2 MStV.'],
        },
        {
          heading: 'Streitschlichtung',
          body: [
            'Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: https://ec.europa.eu/consumers/odr/. Unsere E-Mail-Adresse finden Sie oben.',
            'Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. [Confirm this stance, or update it, once you know whether you want to participate.]',
          ],
        },
      ]}
    />
  );
}
