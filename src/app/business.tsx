import React from 'react';
import InquiryForm from '../components/InquiryForm';

export default function BusinessScreen() {
  return (
    <InquiryForm
      type="business"
      title="Planetary Eats for Business"
      intro="Catering for your office, event, or company lunch program — tell us the size and date and we'll put together a plan and a quote."
      showCompany
      showEventDate
      messageLabel="WHAT DO YOU NEED?"
      messagePlaceholder="Number of people, dietary requirements, delivery vs. drop-off..."
    />
  );
}
