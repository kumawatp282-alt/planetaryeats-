// Shared form for the three public "get in touch" pages — Become a
// courier, For Business, Partner with us. Same submit target (the
// `inquiries` table), same review workflow for the admin, different copy
// and slightly different fields per type.
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Inquiry, useStore } from '../context/StoreContext';
import { colors, radii, shadow, spacing, typography } from '../constants/theme';

interface Props {
  type: Inquiry['type'];
  title: string;
  intro: string;
  messageLabel: string;
  messagePlaceholder: string;
  showCompany?: boolean;
  showEventDate?: boolean;
}

export default function InquiryForm({
  type,
  title,
  intro,
  messageLabel,
  messagePlaceholder,
  showCompany,
  showEventDate,
}: Props) {
  const { submitInquiry } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const canSubmit = name.trim().length > 0 && email.trim().includes('@') && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const { error: submitError } = await submitInquiry({
      type,
      name,
      email,
      phone: phone || undefined,
      company: company || undefined,
      eventDate: eventDate || undefined,
      message: message || undefined,
    });
    setSubmitting(false);
    if (submitError) {
      setError(submitError);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <View style={styles.screen}>
        <View style={styles.content}>
          <Text style={typography.h1}>Thanks!</Text>
          <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]}>
            We've got your details and will get back to you at {email}.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.h1}>{title}</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]}>{intro}</Text>

        <View style={styles.card}>
          <Text style={typography.label}>YOUR NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Jane Doe"
            placeholderTextColor={colors.inkMuted}
            style={styles.input}
          />

          <Text style={[typography.label, { marginTop: spacing.md }]}>EMAIL</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="jane@example.com"
            placeholderTextColor={colors.inkMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />

          <Text style={[typography.label, { marginTop: spacing.md }]}>PHONE (OPTIONAL)</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="+49 ..."
            placeholderTextColor={colors.inkMuted}
            keyboardType="phone-pad"
            style={styles.input}
          />

          {showCompany && (
            <>
              <Text style={[typography.label, { marginTop: spacing.md }]}>COMPANY / ORGANIZATION</Text>
              <TextInput
                value={company}
                onChangeText={setCompany}
                placeholder="Optional"
                placeholderTextColor={colors.inkMuted}
                style={styles.input}
              />
            </>
          )}

          {showEventDate && (
            <>
              <Text style={[typography.label, { marginTop: spacing.md }]}>EVENT / DELIVERY DATE (OPTIONAL)</Text>
              <TextInput
                value={eventDate}
                onChangeText={setEventDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.inkMuted}
                style={styles.input}
              />
            </>
          )}

          <Text style={[typography.label, { marginTop: spacing.md }]}>{messageLabel}</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={messagePlaceholder}
            placeholderTextColor={colors.inkMuted}
            multiline
            numberOfLines={4}
            style={[styles.input, styles.textarea]}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={!canSubmit}>
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.submitText}>Send</Text>
            )}
          </Pressable>
        </View>
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
    marginTop: spacing.lg,
    ...shadow.card,
  },
  input: {
    marginTop: spacing.xs,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.ink,
  },
  textarea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  submitButton: {
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
