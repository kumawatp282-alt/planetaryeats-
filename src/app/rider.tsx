// Rider dashboard — code login (see context/EmployeeAuthContext.tsx),
// a map of pending deliveries relative to the store, claim/pickup/deliver
// actions. Distance/ETA are straight-line (Haversine) estimates, not a
// real route — there's no routing API wired up, and for a small delivery
// radius this is close enough to be useful without adding an API cost.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEmployeeAuth, RiderOrderSummary, RiderClaimedOrder } from '../context/EmployeeAuthContext';
import { useStore } from '../context/StoreContext';
import RiderMap from '../components/RiderMap';
import { distanceKm } from '../lib/delivery';
import { colors, radii, spacing, typography } from '../constants/theme';
import { formatPrice } from '../lib/format';

const AVG_DELIVERY_SPEED_KMH = 18; // rough bike/scooter average incl. stops — not a real route
const REFRESH_MS = 20000;

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
        <Text style={typography.h1}>Rider Login</Text>
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

function etaMinutes(km: number): number {
  return Math.max(1, Math.round((km / AVG_DELIVERY_SPEED_KMH) * 60));
}

function RiderDashboard() {
  const { employee, logout, riderAvailableOrders, riderMyOrders, riderClaimOrder, riderMarkPickedUp, riderMarkDelivered } =
    useEmployeeAuth();
  const { appSettings } = useStore();
  const [available, setAvailable] = useState<RiderOrderSummary[] | null>(null);
  const [mine, setMine] = useState<RiderClaimedOrder[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    riderAvailableOrders().then(setAvailable);
    riderMyOrders().then(setMine);
  };

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, REFRESH_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const claim = async (orderId: string) => {
    setBusyId(orderId);
    setMessage(null);
    const { error } = await riderClaimOrder(orderId);
    setBusyId(null);
    if (error) {
      setMessage(error);
      return;
    }
    setSelectedId(orderId);
    load();
  };

  const markPickedUp = async (orderId: string) => {
    setBusyId(orderId);
    const { error } = await riderMarkPickedUp(orderId);
    setBusyId(null);
    if (error) setMessage(error);
    load();
  };

  const markDelivered = async (orderId: string) => {
    setBusyId(orderId);
    const { error } = await riderMarkDelivered(orderId);
    setBusyId(null);
    if (error) setMessage(error);
    load();
  };

  if (!available || !mine) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  }

  const pins = [
    ...available.map((o) => ({ id: o.id, lat: o.lat, long: o.long, claimed: false })),
    ...mine.map((o) => ({ id: o.id, lat: o.lat, long: o.long, claimed: true })),
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={typography.h1}>Hi, {employee?.name}</Text>
          <Text style={typography.bodyMuted}>Rider</Text>
        </View>
        <Pressable onPress={logout} hitSlop={8}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>

      <View style={{ marginTop: spacing.md }}>
        <RiderMap
          storeLat={appSettings.restaurantLat}
          storeLong={appSettings.restaurantLong}
          pins={pins}
          selectedId={selectedId}
        />
      </View>
      {message && <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]}>{message}</Text>}

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>MY DELIVERIES</Text>
      {mine.length === 0 && <Text style={typography.bodyMuted}>Nothing claimed yet.</Text>}
      {mine.map((o) => {
        const km = distanceKm(appSettings.restaurantLat, appSettings.restaurantLong, o.lat, o.long);
        return (
          <Pressable key={o.id} style={styles.orderCard} onPress={() => setSelectedId(o.id)}>
            <Text style={typography.body}>{o.id}</Text>
            <Text style={typography.bodyMuted}>{o.address}</Text>
            <Text style={[typography.bodyMuted, { fontSize: 11 }]}>
              {km.toFixed(1)} km · ~{etaMinutes(km)} min · {formatPrice(o.total)}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              {!o.pickedUpAt ? (
                <Pressable
                  style={styles.smallButton}
                  onPress={() => markPickedUp(o.id)}
                  disabled={busyId === o.id}
                >
                  <Text style={styles.smallButtonText}>{busyId === o.id ? '…' : 'Mark picked up'}</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.smallButton, styles.deliverButton]}
                  onPress={() => markDelivered(o.id)}
                  disabled={busyId === o.id}
                >
                  <Text style={styles.smallButtonText}>{busyId === o.id ? '…' : 'Mark delivered'}</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        );
      })}

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
        AVAILABLE DELIVERIES
      </Text>
      {available.length === 0 && <Text style={typography.bodyMuted}>Nothing waiting right now.</Text>}
      {available.map((o) => {
        const km = distanceKm(appSettings.restaurantLat, appSettings.restaurantLong, o.lat, o.long);
        return (
          <Pressable key={o.id} style={styles.orderCard} onPress={() => setSelectedId(o.id)}>
            <Text style={typography.body}>{o.id}</Text>
            <Text style={[typography.bodyMuted, { fontSize: 11 }]}>
              {km.toFixed(1)} km · ~{etaMinutes(km)} min · {formatPrice(o.total)} · placed{' '}
              {new Date(o.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Pressable
              style={[styles.smallButton, { marginTop: spacing.sm }]}
              onPress={() => claim(o.id)}
              disabled={busyId === o.id}
            >
              <Text style={styles.smallButtonText}>{busyId === o.id ? 'Claiming…' : 'Claim'}</Text>
            </Pressable>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function RiderScreen() {
  const { employee, loading } = useEmployeeAuth();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  }

  return employee ? <RiderDashboard /> : <LoginScreen />;
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
    maxWidth: 640,
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
  orderCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  smallButton: {
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  deliverButton: {
    backgroundColor: colors.clay,
  },
  smallButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
});
