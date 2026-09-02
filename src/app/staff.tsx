// Kitchen-staff kiosk — code login (not email/password, not Supabase Auth;
// see context/EmployeeAuthContext.tsx), clock in/out, and a quick way to
// log a personal/staff order. Meant for a shared device in the kitchen,
// not a customer-facing screen — AppHeader hides itself on this route.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEmployeeAuth } from '../context/EmployeeAuthContext';
import { fetchMenu, MenuItem } from '../data/menu';
import QuantityStepper from '../components/QuantityStepper';
import { colors, radii, spacing, typography } from '../constants/theme';
import { formatPrice } from '../lib/format';

function LoginScreen() {
  const { login } = useEmployeeAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!code.trim()) return;
    setSubmitting(true);
    setError(null);
    const { error: loginError } = await login(code);
    setSubmitting(false);
    if (loginError) {
      setError(loginError);
      setCode('');
    }
  };

  return (
    <View style={styles.centered}>
      <View style={styles.loginCard}>
        <Text style={typography.h1}>Staff Login</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs, marginBottom: spacing.lg }]}>
          Enter the code your manager gave you.
        </Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          onSubmitEditing={submit}
          placeholder="Code"
          placeholderTextColor={colors.inkMuted}
          keyboardType="number-pad"
          secureTextEntry
          style={styles.codeInput}
          autoFocus
        />
        <Pressable style={styles.primaryButton} onPress={submit} disabled={submitting || !code.trim()}>
          <Text style={styles.primaryButtonText}>{submitting ? 'Checking…' : 'Log in'}</Text>
        </Pressable>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </View>
  );
}

function StaffDashboard() {
  const { employee, logout, currentShift, refreshShift, clockIn, clockOut, logStaffOrder } = useEmployeeAuth();
  const [shiftLoading, setShiftLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[] | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [orderMessage, setOrderMessage] = useState<string | null>(null);

  useEffect(() => {
    refreshShift().then(() => setShiftLoading(false));
    fetchMenu().then(setMenuItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleClock = async () => {
    setBusy(true);
    const { error } = currentShift ? await clockOut() : await clockIn();
    setBusy(false);
    if (error) setOrderMessage(error);
  };

  const setQty = (id: string, qty: number) => {
    setQuantities((current) => ({ ...current, [id]: Math.max(0, qty) }));
  };

  const selectedTotal = (menuItems ?? []).reduce(
    (sum, item) => sum + item.price * (quantities[item.id] ?? 0),
    0
  );

  const submitStaffOrder = async () => {
    const lines = (menuItems ?? [])
      .filter((item) => (quantities[item.id] ?? 0) > 0)
      .map((item) => ({
        item: { id: item.id, name: item.name, price: item.price },
        quantity: quantities[item.id],
      }));
    if (lines.length === 0) {
      setOrderMessage('Pick at least one item.');
      return;
    }
    setBusy(true);
    setOrderMessage(null);
    const { error } = await logStaffOrder(lines, selectedTotal);
    setBusy(false);
    if (error) {
      setOrderMessage(error);
      return;
    }
    setQuantities({});
    setOrderMessage('Order logged.');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={typography.h1}>Hi, {employee?.name}</Text>
          <Text style={typography.bodyMuted}>Kitchen staff</Text>
        </View>
        <Pressable onPress={logout} hitSlop={8}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={typography.label}>SHIFT</Text>
        {shiftLoading ? (
          <ActivityIndicator color={colors.forest} style={{ marginTop: spacing.sm }} />
        ) : (
          <>
            <Text style={[typography.body, { marginTop: spacing.xs }]}>
              {currentShift
                ? `Clocked in since ${new Date(currentShift.clockIn).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : 'Not clocked in'}
            </Text>
            <Pressable
              style={[styles.primaryButton, currentShift && styles.clockOutButton]}
              onPress={toggleClock}
              disabled={busy}
            >
              <Text style={styles.primaryButtonText}>
                {busy ? '…' : currentShift ? 'Clock out' : 'Clock in'}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
        LOG A PERSONAL ORDER
      </Text>
      {!menuItems ? (
        <ActivityIndicator color={colors.forest} style={{ marginTop: spacing.md }} />
      ) : (
        <View style={styles.card}>
          {menuItems.map((item) => (
            <View key={item.id} style={styles.menuRow}>
              <View style={{ flex: 1 }}>
                <Text style={typography.body}>{item.name}</Text>
                <Text style={typography.bodyMuted}>{formatPrice(item.price)}</Text>
              </View>
              <QuantityStepper
                quantity={quantities[item.id] ?? 0}
                min={0}
                onIncrease={() => setQty(item.id, (quantities[item.id] ?? 0) + 1)}
                onDecrease={() => setQty(item.id, (quantities[item.id] ?? 0) - 1)}
              />
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={typography.body}>Total</Text>
            <Text style={[typography.body, { fontWeight: '700' }]}>{formatPrice(selectedTotal)}</Text>
          </View>
          <Pressable style={styles.primaryButton} onPress={submitStaffOrder} disabled={busy}>
            <Text style={styles.primaryButtonText}>{busy ? 'Logging…' : 'Log order'}</Text>
          </Pressable>
          {orderMessage && <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]}>{orderMessage}</Text>}
        </View>
      )}
    </ScrollView>
  );
}

export default function StaffScreen() {
  const { employee, loading } = useEmployeeAuth();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  }

  return employee ? <StaffDashboard /> : <LoginScreen />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
    padding: spacing.lg,
  },
  content: {
    padding: spacing.lg,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: spacing.xxl,
  },
  loginCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.xl,
  },
  codeInput: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 24,
    letterSpacing: 4,
    textAlign: 'center',
    color: colors.ink,
  },
  primaryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  clockOutButton: {
    backgroundColor: colors.danger,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logoutText: {
    color: colors.leaf,
    fontWeight: '700',
    fontSize: 13,
    marginTop: spacing.sm,
  },
  card: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
});
