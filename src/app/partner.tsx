import React from 'react';
import InquiryForm from '../components/InquiryForm';

export default function PartnerScreen() {
  return (
    <InquiryForm
      type="partner"
      title="Partner with us"
      intro="Local supplier, sponsorship idea, or another way you'd like to work with Planetary Eats — tell us more and we'll follow up."
      showCompany
      messageLabel="TELL US ABOUT THE OPPORTUNITY"
      messagePlaceholder="What you have in mind..."
    />
  );
}
