import React from 'react';
import InquiryForm from '../components/InquiryForm';

export default function CourierScreen() {
  return (
    <InquiryForm
      type="courier"
      title="Become a courier"
      intro="Deliver for Planetary Eats in your area. Tell us a bit about yourself and we'll be in touch about availability, pay, and how to get started."
      messageLabel="ANYTHING ELSE WE SHOULD KNOW? (OPTIONAL)"
      messagePlaceholder="Your own vehicle/bike, availability, previous delivery experience..."
    />
  );
}
