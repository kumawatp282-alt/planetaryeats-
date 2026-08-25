// Shared email/password sign in/up form — used on the Profile tab and on
// /admin (an admin signs in through the exact same account system, just
// with `profiles.is_admin = true`).
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, radii, shadow, spacing, typography } from '../constants/theme';

type Mode = 'signIn' | 'signUp';

interface Props {
  helperText?: string;
}

export default function AuthForm({
  helperText = "An account is required to place an order — browsing the menu doesn't need one.",
}: Props) {
  const { signIn, signUp, bannedMessage } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signedUpMessage, setSignedUpMessage] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSignedUpMessage(false);
    if (!email.trim() || password.length < 6) {
      setError('Enter a valid email and a password of at least 6 characters.');
      return;
    }
    const parsedBirthYear = birthYear.trim() ? Number(birthYear.trim()) : undefined;
    const currentYear = new Date().getFullYear();
    if (parsedBirthYear !== undefined && (!Number.isInteger(parsedBirthYear) || parsedBirthYear < currentYear - 120 || parsedBirthYear > currentYear)) {
      setError('Enter a valid birth year, or leave it blank.');
      return;
    }
    setSubmitting(true);
    const result =
      mode === 'signIn' ? await signIn(email.trim(), password) : await signUp(email.trim(), password, parsedBirthYear);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    } else if (mode === 'signUp') {
      setSignedUpMessage(true);
    }
  };

  return (
    <View style={styles.authCard}>
      <Text style={typography.h2}>{mode === 'signIn' ? 'Sign in' : 'Create your account'}</Text>
      <Text style={[typography.bodyMuted, { marginTop: 4, marginBottom: spacing.lg }]}>{helperText}</Text>

      {bannedMessage && <Text style={[styles.errorText, { marginBottom: spacing.md }]}>{bannedMessage}</Text>}

      <Text style={typography.label}>EMAIL</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
        placeholderTextColor={colors.inkMuted}
        style={styles.input}
      />

      <Text style={[typography.label, { marginTop: spacing.md }]}>PASSWORD</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="At least 6 characters"
        placeholderTextColor={colors.inkMuted}
        style={styles.input}
      />

      {mode === 'signUp' && (
        <>
          <Text style={[typography.label, { marginTop: spacing.md }]}>YEAR OF BIRTH (OPTIONAL)</Text>
          <TextInput
            value={birthYear}
            onChangeText={setBirthYear}
            keyboardType="numeric"
            placeholder="e.g. 1995"
            placeholderTextColor={colors.inkMuted}
            style={styles.input}
          />
          <Text style={[typography.bodyMuted, { fontSize: 11, marginTop: 4 }]}>
            Only used in aggregate, anonymous form to understand who's ordering — never shown tied to your identity.
            Leave blank if you'd rather not say.
          </Text>
        </>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}
      {signedUpMessage && (
        <Text style={styles.successText}>Account created — check your email to confirm, then sign in.</Text>
      )}

      <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.submitButtonText}>
          {submitting ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : 'Create account'}
        </Text>
      </Pressable>

      <Pressable
        style={styles.switchModeButton}
        onPress={() => {
          setMode(mode === 'signIn' ? 'signUp' : 'signIn');
          setError(null);
          setSignedUpMessage(false);
        }}
      >
        <Text style={styles.switchModeText}>
          {mode === 'signIn' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  authCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
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
  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  successText: {
    color: colors.forest,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  submitButton: {
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  switchModeButton: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  switchModeText: {
    color: colors.leaf,
    fontSize: 13,
    fontWeight: '600',
  },
});
