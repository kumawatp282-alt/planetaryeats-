import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadow, spacing, typography } from '../constants/theme';

const FAQS: { question: string; answer: string }[] = [
  {
    question: "Where's my order?",
    answer:
      'Track it under Your orders in your account — it moves through placed, preparing, out for delivery, and delivered as the kitchen and rider update it.',
  },
  {
    question: 'Can I cancel or change my order?',
    answer:
      "Orders start on their way to the kitchen quickly, so we can't guarantee a change once it's placed. If something's wrong, get in touch as soon as possible and we'll do what we can.",
  },
  {
    question: 'Do you cater for allergies?',
    answer:
      'Every dish lists its allergens on the menu. If you have a specific concern not covered there, reach out before ordering.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'Card (charged securely via Stripe at checkout), PayPal, bank transfer, and cash on delivery.',
  },
  {
    question: 'How do stamp-card rewards work?',
    answer:
      "Every 10th order earns a free bowl automatically — check Rewards in your account to see your progress and any vouchers you've earned.",
  },
  {
    question: 'I have a gift or discount code — where do I use it?',
    answer: "Enter it at checkout, in the \"Discount or gift code\" field, before placing your order.",
  },
  {
    question: "What's your delivery area?",
    answer:
      "Enter your address at checkout and we'll tell you right away whether it's within our delivery radius.",
  },
];

export default function HelpScreen() {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.h1}>Need help?</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]}>
          Answers to the most common questions. Still stuck? Email us — you'll find our contact details on the{' '}
          Impressum page.
        </Text>

        {FAQS.map((faq) => (
          <View key={faq.question} style={styles.card}>
            <Text style={typography.h3}>{faq.question}</Text>
            <Text style={[typography.bodyMuted, styles.answer]}>{faq.answer}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    padding: spacing.lg,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadow.card,
  },
  answer: {
    marginTop: spacing.sm,
    lineHeight: 20,
  },
});
