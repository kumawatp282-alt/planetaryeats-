// /admin — gated inline: signed out -> sign in; signed in but not admin ->
// "not authorized"; admin -> the dashboard (Settings / Customers / Orders).
// Real enforcement is server-side (Supabase RLS via is_admin()); this
// screen just decides what to render for the current viewer.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { AdminMenuItem, AdminProfile, Order, useStore } from '../context/StoreContext';
import AuthForm from '../components/AuthForm';
import ReceiptView from '../components/ReceiptView';
import MenuItemEditorModal from '../components/MenuItemEditorModal';
import RadiusMapEditor from '../components/RadiusMapEditor';
import OrderHeatmap from '../components/OrderHeatmap';
import { colors, radii, shadow, spacing, typography } from '../constants/theme';
import { formatPrice } from '../lib/format';
import { extractPostcode, geocodeAddress } from '../lib/delivery';
import { DayHours, OpeningHours, WEEKDAYS, WEEKDAY_LABELS, Weekday } from '../lib/openingHours';
import {
  ChecklistItem,
  DISH_COSTS,
  FOOD_SAFETY_RULES,
  INGREDIENT_PRICES,
  KEY_NUMBERS,
  LAUNCH_CHECKLIST,
  SHELF_LIFE,
  TRUE_COST_BY_VOLUME,
} from '../data/businessData';

type Section = 'settings' | 'menu' | 'customers' | 'orders' | 'analytics' | 'business';

const SECTION_LABELS: Record<Section, string> = {
  settings: 'Settings',
  menu: 'Menu',
  customers: 'Customers',
  orders: 'Orders',
  analytics: 'Analytics',
  business: 'Business',
};

export default function AdminScreen() {
  const { user, loading, isAdmin } = useAuth();
  const [section, setSection] = useState<Section>('settings');

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.screen}>
        <AuthForm helperText="Sign in with your admin account." />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={typography.h3}>Not authorized</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
          This account doesn't have admin access.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.tabRow}>
        {(Object.keys(SECTION_LABELS) as Section[]).map((s) => (
          <Pressable
            key={s}
            style={[styles.tab, section === s && styles.tabActive]}
            onPress={() => setSection(s)}
          >
            <Text style={[styles.tabText, section === s && styles.tabTextActive]}>{SECTION_LABELS[s]}</Text>
          </Pressable>
        ))}
      </View>
      {section === 'settings' && <SettingsSection />}
      {section === 'menu' && <MenuSection />}
      {section === 'customers' && <CustomersSection />}
      {section === 'orders' && <OrdersSection />}
      {section === 'analytics' && <AnalyticsSection />}
      {section === 'business' && <BusinessSection />}
    </View>
  );
}

function SettingsSection() {
  const { appSettings, updateAppSettings } = useStore();
  const [radius, setRadius] = useState(String(appSettings.deliveryRadiusKm));
  const [postcodes, setPostcodes] = useState<string[]>(appSettings.closedPostcodes);
  const [newPostcode, setNewPostcode] = useState('');
  const [minOrder, setMinOrder] = useState(String(appSettings.minimumOrderValue));
  const [hours, setHours] = useState<OpeningHours>(appSettings.openingHours);
  const [promoCode, setPromoCode] = useState(appSettings.promoCode);
  const [promoDiscountPct, setPromoDiscountPct] = useState(String(appSettings.promoDiscount * 100));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setRadius(String(appSettings.deliveryRadiusKm));
    setPostcodes(appSettings.closedPostcodes);
    setMinOrder(String(appSettings.minimumOrderValue));
    setHours(appSettings.openingHours);
    setPromoCode(appSettings.promoCode);
    setPromoDiscountPct(String(appSettings.promoDiscount * 100));
  }, [
    appSettings.deliveryRadiusKm,
    appSettings.closedPostcodes,
    appSettings.minimumOrderValue,
    appSettings.openingHours,
    appSettings.promoCode,
    appSettings.promoDiscount,
  ]);

  const addPostcode = () => {
    const trimmed = newPostcode.trim();
    if (!/^\d{5}$/.test(trimmed) || postcodes.includes(trimmed)) return;
    setPostcodes([...postcodes, trimmed]);
    setNewPostcode('');
  };

  const removePostcode = (postcode: string) => setPostcodes(postcodes.filter((p) => p !== postcode));

  const updateDay = (day: Weekday, changes: Partial<DayHours>) => {
    setHours({ ...hours, [day]: { ...hours[day], ...changes } });
  };

  const save = async () => {
    const parsedRadius = Number(radius);
    const parsedMinOrder = Number(minOrder);
    const parsedPromoPct = Number(promoDiscountPct);
    if (!Number.isFinite(parsedRadius) || parsedRadius <= 0) {
      setMessage('Enter a valid radius in km.');
      return;
    }
    if (!Number.isFinite(parsedMinOrder) || parsedMinOrder < 0) {
      setMessage('Enter a valid minimum order value.');
      return;
    }
    if (!Number.isFinite(parsedPromoPct) || parsedPromoPct < 0 || parsedPromoPct > 100) {
      setMessage('Enter a valid promo discount percentage (0-100).');
      return;
    }
    setSaving(true);
    setMessage(null);
    const { error } = await updateAppSettings({
      deliveryRadiusKm: parsedRadius,
      closedPostcodes: postcodes,
      minimumOrderValue: parsedMinOrder,
      openingHours: hours,
      promoCode: promoCode.trim().toUpperCase(),
      promoDiscount: parsedPromoPct / 100,
    });
    setSaving(false);
    setMessage(error ?? 'Saved.');
  };

  const mapRadius = Number(radius);

  return (
    <ScrollView contentContainerStyle={styles.sectionContent}>
      <Text style={typography.label}>DELIVERY RADIUS (KM)</Text>
      <TextInput
        value={radius}
        onChangeText={setRadius}
        keyboardType="numeric"
        style={styles.input}
        placeholder="10"
        placeholderTextColor={colors.inkMuted}
      />

      {Number.isFinite(mapRadius) && mapRadius > 0 && (
        <View style={{ marginTop: spacing.sm }}>
          <RadiusMapEditor
            lat={appSettings.restaurantLat}
            long={appSettings.restaurantLong}
            radiusKm={mapRadius}
          />
        </View>
      )}

      <Text style={[typography.label, { marginTop: spacing.lg }]}>CLOSED POSTCODES</Text>
      <Text style={typography.bodyMuted}>
        Addresses in these postcodes are rejected even if they're within the radius above.
      </Text>
      {postcodes.length > 0 && (
        <View style={styles.chipRow}>
          {postcodes.map((postcode) => (
            <Pressable key={postcode} style={styles.chip} onPress={() => removePostcode(postcode)}>
              <Text style={styles.chipText}>{postcode} ✕</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.inputRow}>
        <TextInput
          value={newPostcode}
          onChangeText={setNewPostcode}
          placeholder="e.g. 85354"
          placeholderTextColor={colors.inkMuted}
          keyboardType="numeric"
          style={[styles.input, { flex: 1, marginTop: 0 }]}
        />
        <Pressable style={styles.smallButton} onPress={addPostcode}>
          <Text style={styles.smallButtonText}>Add</Text>
        </Pressable>
      </View>

      <Text style={[typography.label, { marginTop: spacing.lg }]}>MINIMUM ORDER VALUE (€)</Text>
      <Text style={typography.bodyMuted}>Customers can't check out below this — 0 means no minimum.</Text>
      <TextInput
        value={minOrder}
        onChangeText={setMinOrder}
        keyboardType="numeric"
        style={styles.input}
        placeholder="0"
        placeholderTextColor={colors.inkMuted}
      />

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>OPENING HOURS</Text>
      {WEEKDAYS.map((day) => (
        <View key={day} style={styles.hoursRow}>
          <Text style={[typography.body, { width: 92 }]}>{WEEKDAY_LABELS[day]}</Text>
          {hours[day].closed ? (
            <Text style={[typography.bodyMuted, { flex: 1 }]}>Closed</Text>
          ) : (
            <>
              <TextInput
                value={hours[day].open}
                onChangeText={(v) => updateDay(day, { open: v })}
                placeholder="11:00"
                placeholderTextColor={colors.inkMuted}
                style={[styles.input, styles.hoursInput, { marginTop: 0 }]}
              />
              <Text style={typography.bodyMuted}>–</Text>
              <TextInput
                value={hours[day].close}
                onChangeText={(v) => updateDay(day, { close: v })}
                placeholder="21:30"
                placeholderTextColor={colors.inkMuted}
                style={[styles.input, styles.hoursInput, { marginTop: 0 }]}
              />
            </>
          )}
          <Pressable
            style={[styles.smallButton, hours[day].closed ? styles.unbanButton : styles.banButton]}
            onPress={() => updateDay(day, { closed: !hours[day].closed })}
          >
            <Text style={styles.smallButtonText}>{hours[day].closed ? 'Open' : 'Close'}</Text>
          </Pressable>
        </View>
      ))}

      <Text style={[typography.label, { marginTop: spacing.lg }]}>PROMO CODE</Text>
      <Text style={typography.bodyMuted}>
        Leave blank to hide the promo code field at checkout entirely.
      </Text>
      <TextInput
        value={promoCode}
        onChangeText={setPromoCode}
        autoCapitalize="characters"
        style={styles.input}
        placeholder="e.g. WORLD10"
        placeholderTextColor={colors.inkMuted}
      />

      <Text style={[typography.label, { marginTop: spacing.lg }]}>PROMO DISCOUNT (%)</Text>
      <TextInput
        value={promoDiscountPct}
        onChangeText={setPromoDiscountPct}
        keyboardType="numeric"
        style={styles.input}
        placeholder="10"
        placeholderTextColor={colors.inkMuted}
      />

      <Pressable style={styles.saveButton} onPress={save} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save settings'}</Text>
      </Pressable>
      {message && <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]}>{message}</Text>}
    </ScrollView>
  );
}

function MenuSection() {
  const { fetchAllMenuItemsAdmin, setMenuItemActive, deleteMenuItem } = useStore();
  const [items, setItems] = useState<AdminMenuItem[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminMenuItem | null>(null);

  const load = () => {
    fetchAllMenuItemsAdmin().then(setItems);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    setEditingItem(null);
    setEditorVisible(true);
  };

  const openEdit = (item: AdminMenuItem) => {
    setEditingItem(item);
    setEditorVisible(true);
  };

  const toggleActive = async (item: AdminMenuItem) => {
    setBusyId(item.id);
    await setMenuItemActive(item.id, !item.isActive);
    load();
    setBusyId(null);
  };

  const remove = async (item: AdminMenuItem) => {
    if (typeof window !== 'undefined' && !window.confirm(`Permanently delete "${item.name}"? This can't be undone.`)) {
      return;
    }
    setBusyId(item.id);
    await deleteMenuItem(item.id);
    load();
    setBusyId(null);
  };

  if (!items) {
    return <ActivityIndicator color={colors.forest} style={{ marginTop: spacing.xl }} />;
  }

  const byCategory = { Bowls: [] as AdminMenuItem[], Drinks: [] as AdminMenuItem[], Desserts: [] as AdminMenuItem[] };
  items.forEach((item) => byCategory[item.category].push(item));

  return (
    <ScrollView contentContainerStyle={styles.sectionContent}>
      <Pressable style={styles.saveButton} onPress={openAdd}>
        <Text style={styles.saveButtonText}>+ Add new dish</Text>
      </Pressable>

      {(Object.keys(byCategory) as (keyof typeof byCategory)[]).map((category) =>
        byCategory[category].length === 0 ? null : (
          <View key={category}>
            <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
              {category.toUpperCase()}
            </Text>
            {byCategory[category].map((item) => (
              <View key={item.id} style={[styles.rowCard, !item.isActive && styles.rowCardHidden]}>
                {item.dishImage ? (
                  <Image source={item.dishImage} style={styles.menuThumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.menuThumb, styles.menuThumbEmoji]}>
                    <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={typography.body}>{item.name}</Text>
                  <Text style={typography.bodyMuted}>
                    {formatPrice(item.price)}
                    {!item.isActive ? ' · Hidden' : ''}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                  <Pressable style={styles.smallButton} onPress={() => openEdit(item)}>
                    <Text style={styles.smallButtonText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.smallButton, styles.adminToggleButton]}
                    onPress={() => toggleActive(item)}
                    disabled={busyId === item.id}
                  >
                    <Text style={styles.smallButtonText}>
                      {busyId === item.id ? '…' : item.isActive ? 'Hide' : 'Show'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.smallButton, styles.banButton]}
                    onPress={() => remove(item)}
                    disabled={busyId === item.id}
                  >
                    <Text style={styles.smallButtonText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )
      )}

      <MenuItemEditorModal
        visible={editorVisible}
        item={editingItem}
        onClose={() => setEditorVisible(false)}
        onSaved={load}
      />
    </ScrollView>
  );
}

function CustomersSection() {
  const { user } = useAuth();
  const { fetchAllProfiles, setUserBanned, setUserAdmin, setUserAdminByEmail } = useStore();
  const [profiles, setProfiles] = useState<AdminProfile[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [grantEmail, setGrantEmail] = useState('');
  const [granting, setGranting] = useState(false);
  const [grantMessage, setGrantMessage] = useState<string | null>(null);

  const load = () => {
    fetchAllProfiles().then(setProfiles);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleBan = async (profile: AdminProfile) => {
    setBusyId(profile.id);
    await setUserBanned(profile.id, !profile.banned);
    load();
    setBusyId(null);
  };

  const toggleAdmin = async (profile: AdminProfile) => {
    setBusyId(profile.id);
    await setUserAdmin(profile.id, !profile.isAdmin);
    load();
    setBusyId(null);
  };

  const grantByEmail = async () => {
    const trimmed = grantEmail.trim();
    if (!trimmed) return;
    setGranting(true);
    setGrantMessage(null);
    const { error } = await setUserAdminByEmail(trimmed, true);
    setGranting(false);
    if (error) {
      setGrantMessage(error);
      return;
    }
    setGrantMessage(`${trimmed} is now an admin.`);
    setGrantEmail('');
    load();
  };

  if (!profiles) {
    return <ActivityIndicator color={colors.forest} style={{ marginTop: spacing.xl }} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.sectionContent}>
      <Text style={typography.label}>GRANT ADMIN ACCESS</Text>
      <Text style={typography.bodyMuted}>
        They need to have already signed up on the site with this email — this doesn't create an account for them.
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          value={grantEmail}
          onChangeText={setGrantEmail}
          placeholder="someone@example.com"
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          style={[styles.input, { flex: 1, marginTop: 0 }]}
        />
        <Pressable style={styles.smallButton} onPress={grantByEmail} disabled={granting || !grantEmail.trim()}>
          <Text style={styles.smallButtonText}>{granting ? '…' : 'Make admin'}</Text>
        </Pressable>
      </View>
      {grantMessage && <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>{grantMessage}</Text>}

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>ALL CUSTOMERS</Text>
      {profiles.map((profile) => (
        <View key={profile.id} style={styles.rowCard}>
          <View style={{ flex: 1 }}>
            <Text style={typography.body}>{profile.email}</Text>
            <View style={styles.badgeRow}>
              {profile.isAdmin && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>Admin</Text>
                </View>
              )}
              {profile.banned && (
                <View style={styles.bannedBadge}>
                  <Text style={styles.bannedBadgeText}>Banned</Text>
                </View>
              )}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            {profile.id !== user?.id && (
              <Pressable
                style={[styles.smallButton, styles.adminToggleButton]}
                onPress={() => toggleAdmin(profile)}
                disabled={busyId === profile.id}
              >
                <Text style={styles.smallButtonText}>
                  {busyId === profile.id ? '…' : profile.isAdmin ? 'Remove admin' : 'Make admin'}
                </Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.smallButton, profile.banned ? styles.unbanButton : styles.banButton]}
              onPress={() => toggleBan(profile)}
              disabled={busyId === profile.id}
            >
              <Text style={styles.smallButtonText}>{busyId === profile.id ? '…' : profile.banned ? 'Unban' : 'Ban'}</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {profiles.length === 0 && <Text style={typography.bodyMuted}>No customers yet.</Text>}
    </ScrollView>
  );
}

const MANUAL_SOURCES = ['Lieferando', 'Phone', 'Walk-in', 'Other'];

function OrdersSection() {
  const { fetchAllOrders, fetchAllProfiles, logManualOrder } = useStore();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [emailById, setEmailById] = useState<Record<string, string>>({});
  const [openReceipt, setOpenReceipt] = useState<Order | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualTotal, setManualTotal] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualSource, setManualSource] = useState(MANUAL_SOURCES[0]);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualMessage, setManualMessage] = useState<string | null>(null);

  const load = () => {
    fetchAllOrders().then(setOrders);
    fetchAllProfiles().then((profiles) => {
      const map: Record<string, string> = {};
      profiles.forEach((p) => {
        map[p.id] = p.email;
      });
      setEmailById(map);
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitManualOrder = async () => {
    const total = Number(manualTotal);
    if (!Number.isFinite(total) || total <= 0 || !manualAddress.trim()) {
      setManualMessage('Enter a valid amount and address.');
      return;
    }
    setManualSaving(true);
    setManualMessage(null);
    const geo = await geocodeAddress(manualAddress.trim());
    const { error } = await logManualOrder({
      total,
      address: manualAddress.trim(),
      lat: geo?.lat,
      long: geo?.long,
      source: manualSource.toLowerCase(),
      placedAt: new Date().toISOString(),
    });
    setManualSaving(false);
    if (error) {
      setManualMessage(error);
      return;
    }
    setManualTotal('');
    setManualAddress('');
    setShowManualForm(false);
    load();
  };

  if (!orders) {
    return <ActivityIndicator color={colors.forest} style={{ marginTop: spacing.xl }} />;
  }

  if (openReceipt) {
    return (
      <View style={{ flex: 1 }}>
        <Pressable style={styles.backLink} onPress={() => setOpenReceipt(null)}>
          <Text style={styles.backLinkText}>← Back to orders</Text>
        </Pressable>
        <ReceiptView
          order={openReceipt}
          customerEmail={openReceipt.userId ? emailById[openReceipt.userId] : undefined}
        />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.sectionContent}>
      <Pressable style={styles.saveButton} onPress={() => setShowManualForm(!showManualForm)}>
        <Text style={styles.saveButtonText}>{showManualForm ? 'Cancel' : '+ Log an order (Lieferando, phone, walk-in)'}</Text>
      </Pressable>

      {showManualForm && (
        <View style={{ marginTop: spacing.md }}>
          <Text style={typography.label}>SOURCE</Text>
          <View style={styles.pillRow}>
            {MANUAL_SOURCES.map((s) => (
              <Pressable
                key={s}
                style={[styles.chip, manualSource === s && styles.chipActive]}
                onPress={() => setManualSource(s)}
              >
                <Text style={[styles.chipText, manualSource === s && styles.chipTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[typography.label, { marginTop: spacing.md }]}>TOTAL (€)</Text>
          <TextInput
            value={manualTotal}
            onChangeText={setManualTotal}
            keyboardType="numeric"
            style={styles.input}
            placeholder="14.90"
            placeholderTextColor={colors.inkMuted}
          />
          <Text style={[typography.label, { marginTop: spacing.md }]}>DELIVERY ADDRESS</Text>
          <TextInput
            value={manualAddress}
            onChangeText={setManualAddress}
            style={styles.input}
            placeholder="Street, city, postcode"
            placeholderTextColor={colors.inkMuted}
          />
          <Text style={[typography.bodyMuted, { fontSize: 11, marginTop: spacing.xs }]}>
            Used to place this order on the Analytics heat map — doesn't need to be exact.
          </Text>
          <Pressable style={styles.saveButton} onPress={submitManualOrder} disabled={manualSaving}>
            <Text style={styles.saveButtonText}>{manualSaving ? 'Saving…' : 'Save order'}</Text>
          </Pressable>
          {manualMessage && <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]}>{manualMessage}</Text>}
        </View>
      )}

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>ALL ORDERS</Text>
      {orders.map((order) => (
        <Pressable key={order.id} style={styles.rowCard} onPress={() => setOpenReceipt(order)}>
          <View style={{ flex: 1 }}>
            <Text style={typography.body}>
              {order.id} · {formatPrice(order.total)}
              {order.source !== 'website' && <Text style={styles.sourceTag}> · {order.source}</Text>}
            </Text>
            <Text style={typography.bodyMuted}>
              {(order.userId && emailById[order.userId]) ?? order.fulfillment.address ?? 'No address'} ·{' '}
              {new Date(order.placedAt).toLocaleString()}
            </Text>
          </View>
        </Pressable>
      ))}
      {orders.length === 0 && <Text style={typography.bodyMuted}>No orders yet.</Text>}
    </ScrollView>
  );
}

function AnalyticsSection() {
  const { fetchAllOrders, fetchAllProfiles, appSettings } = useStore();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [profiles, setProfiles] = useState<AdminProfile[] | null>(null);

  useEffect(() => {
    fetchAllOrders().then(setOrders);
    fetchAllProfiles().then(setProfiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!orders || !profiles) {
    return <ActivityIndicator color={colors.forest} style={{ marginTop: spacing.xl }} />;
  }

  const points = orders
    .filter((o) => o.fulfillment.lat !== undefined && o.fulfillment.long !== undefined)
    .map((o) => ({ lat: o.fulfillment.lat as number, long: o.fulfillment.long as number }));

  const postcodeCounts: Record<string, number> = {};
  orders.forEach((o) => {
    const postcode = o.fulfillment.address ? extractPostcode(o.fulfillment.address) : null;
    if (postcode) postcodeCounts[postcode] = (postcodeCounts[postcode] ?? 0) + 1;
  });
  const topPostcodes = Object.entries(postcodeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const hourCounts = new Array(24).fill(0);
  orders.forEach((o) => {
    hourCounts[new Date(o.placedAt).getHours()] += 1;
  });
  const busiestHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const currentYear = new Date().getFullYear();
  const ageBuckets: Record<string, number> = {};
  profiles.forEach((p) => {
    if (!p.birthYear) return;
    const age = currentYear - p.birthYear;
    const bucketStart = Math.floor(age / 10) * 10;
    const label = `${bucketStart}–${bucketStart + 9}`;
    ageBuckets[label] = (ageBuckets[label] ?? 0) + 1;
  });
  const ageEntries = Object.entries(ageBuckets).sort((a, b) => a[0].localeCompare(b[0]));
  const withBirthYear = profiles.filter((p) => p.birthYear).length;

  return (
    <ScrollView contentContainerStyle={styles.sectionContent}>
      <Text style={typography.label}>WHERE ORDERS COME FROM</Text>
      {points.length > 0 ? (
        <View style={{ marginTop: spacing.sm }}>
          <OrderHeatmap points={points} centerLat={appSettings.restaurantLat} centerLong={appSettings.restaurantLong} />
        </View>
      ) : (
        <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]}>
          No order locations yet — this fills in as delivery orders come through the website, or are logged manually
          with an address.
        </Text>
      )}

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>TOP POSTCODES</Text>
      {topPostcodes.length === 0 && <Text style={typography.bodyMuted}>Not enough data yet.</Text>}
      {topPostcodes.map(([postcode, count]) => (
        <View key={postcode} style={styles.statRow}>
          <Text style={typography.body}>{postcode}</Text>
          <Text style={typography.bodyMuted}>{count} order{count === 1 ? '' : 's'}</Text>
        </View>
      ))}

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>BUSIEST HOURS</Text>
      {busiestHours.length === 0 && <Text style={typography.bodyMuted}>Not enough data yet.</Text>}
      {busiestHours.map(({ hour, count }) => (
        <View key={hour} style={styles.statRow}>
          <Text style={typography.body}>{hour}:00–{hour + 1}:00</Text>
          <Text style={typography.bodyMuted}>{count} order{count === 1 ? '' : 's'}</Text>
        </View>
      ))}

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>AGE GROUPS</Text>
      <Text style={[typography.bodyMuted, { marginBottom: spacing.sm }]}>
        Aggregate only, from the optional year-of-birth field at sign-up ({withBirthYear} of {profiles.length}{' '}
        customers have shared it).
      </Text>
      {ageEntries.length === 0 && <Text style={typography.bodyMuted}>Not enough data yet.</Text>}
      {ageEntries.map(([bucket, count]) => (
        <View key={bucket} style={styles.statRow}>
          <Text style={typography.body}>{bucket}</Text>
          <Text style={typography.bodyMuted}>{count} customer{count === 1 ? '' : 's'}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const CHECKLIST_GROUPS: { key: ChecklistItem['group']; label: string; blurb?: string }[] = [
  { key: 'urgent', label: 'Do first', blurb: 'Flagged as blocking in your kitchen assessment and business plan.' },
  { key: 'kitchen', label: 'Kitchen equipment' },
  { key: 'compliance', label: 'German compliance' },
  { key: 'launch', label: 'Decisions before launch' },
];

type BusinessTab = 'checklist' | 'costs' | 'prices' | 'storage';

const BUSINESS_TAB_LABELS: Record<BusinessTab, string> = {
  checklist: 'Checklist',
  costs: 'Costs',
  prices: 'Prices',
  storage: 'Storage',
};

function BusinessSection() {
  const { fetchChecklistState, setChecklistItem } = useStore();
  const [tab, setTab] = useState<BusinessTab>('checklist');
  const [done, setDone] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    fetchChecklistState().then(setDone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id: string) => {
    if (!done) return;
    const next = !done[id];
    setDone({ ...done, [id]: next }); // optimistic — the row is tiny and admin-only
    setChecklistItem(id, next);
  };

  if (!done) {
    return <ActivityIndicator color={colors.forest} style={{ marginTop: spacing.xl }} />;
  }

  const completed = LAUNCH_CHECKLIST.filter((i) => done[i.id]).length;

  return (
    <ScrollView contentContainerStyle={styles.sectionContent}>
      <View style={styles.privateBanner}>
        <Text style={styles.privateBannerText}>
          🔒 Private — visible only to admins, never on the public site. From your own business plan, kitchen
          assessment and financial model. Every figure is an estimate to replace with real quotes.
        </Text>
      </View>

      <View style={styles.subTabRow}>
        {(Object.keys(BUSINESS_TAB_LABELS) as BusinessTab[]).map((t) => (
          <Pressable key={t} style={[styles.subTab, tab === t && styles.subTabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.subTabText, tab === t && styles.subTabTextActive]}>{BUSINESS_TAB_LABELS[t]}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'checklist' && (
        <View>
          <Text style={[typography.bodyMuted, { marginBottom: spacing.md }]}>
            {completed} of {LAUNCH_CHECKLIST.length} done
          </Text>
          {CHECKLIST_GROUPS.map((group) => (
            <View key={group.key}>
              <Text style={[typography.label, { marginTop: spacing.md }]}>{group.label.toUpperCase()}</Text>
              {group.blurb && <Text style={[typography.bodyMuted, { fontSize: 11 }]}>{group.blurb}</Text>}
              {LAUNCH_CHECKLIST.filter((i) => i.group === group.key).map((item) => (
                <Pressable key={item.id} style={styles.checkRow} onPress={() => toggle(item.id)}>
                  <View style={[styles.checkbox, done[item.id] && styles.checkboxActive]}>
                    {done[item.id] && <Text style={styles.checkboxMark}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.body, done[item.id] && styles.checkDone]}>{item.label}</Text>
                    {item.detail && (
                      <Text style={[typography.bodyMuted, { fontSize: 11, marginTop: 2 }]}>{item.detail}</Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      )}

      {tab === 'costs' && (
        <View>
          <Text style={typography.label}>KEY NUMBERS</Text>
          <View style={styles.statRow}>
            <Text style={typography.body}>Avg food cost per bowl</Text>
            <Text style={typography.bodyMuted}>{formatPrice(KEY_NUMBERS.avgFoodCostPerBowl)}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={typography.body}>Recommended menu price</Text>
            <Text style={typography.bodyMuted}>{formatPrice(KEY_NUMBERS.recommendedMenuPrice)}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={typography.body}>Break-even</Text>
            <Text style={typography.bodyMuted}>
              {KEY_NUMBERS.breakEvenBowlsLow}–{KEY_NUMBERS.breakEvenBowlsHigh} bowls/day
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={typography.body}>Monthly operating cost</Text>
            <Text style={typography.bodyMuted}>
              {formatPrice(KEY_NUMBERS.monthlyOperatingLow)}–{formatPrice(KEY_NUMBERS.monthlyOperatingHigh)}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={typography.body}>Minimum cash to open</Text>
            <Text style={typography.bodyMuted}>{formatPrice(KEY_NUMBERS.minimumStart)}</Text>
          </View>

          <Text style={[typography.label, { marginTop: spacing.lg }]}>FOOD COST PER DISH</Text>
          {DISH_COSTS.map((d) => (
            <View key={d.name} style={styles.statRow}>
              <Text style={typography.body}>{d.name}</Text>
              <Text style={typography.bodyMuted}>{formatPrice(d.total)}</Text>
            </View>
          ))}

          <Text style={[typography.label, { marginTop: spacing.lg }]}>TRUE COST PER BOWL BY VOLUME</Text>
          <Text style={[typography.bodyMuted, { fontSize: 11, marginBottom: spacing.sm }]}>
            All overheads included. Profit shown at {formatPrice(KEY_NUMBERS.recommendedMenuPrice)}, high-cost
            scenario. Volume — not ingredient cost — is what makes this work.
          </Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, styles.tableHeaderText]}>Bowls/day</Text>
            <Text style={[styles.tableCell, styles.tableHeaderText]}>True cost</Text>
            <Text style={[styles.tableCell, styles.tableHeaderText]}>Platform</Text>
            <Text style={[styles.tableCell, styles.tableHeaderText]}>Self-deliver</Text>
          </View>
          {TRUE_COST_BY_VOLUME.map((r) => (
            <View key={r.bowlsPerDay} style={styles.tableRow}>
              <Text style={styles.tableCell}>{r.bowlsPerDay}</Text>
              <Text style={styles.tableCell}>{formatPrice(r.trueCostHigh)}</Text>
              <Text style={[styles.tableCell, { color: r.netProfitPlatform < 0 ? colors.danger : colors.forest }]}>
                {formatPrice(r.netProfitPlatform)}
              </Text>
              <Text
                style={[styles.tableCell, { color: r.netProfitSelfDelivery < 0 ? colors.danger : colors.forest }]}
              >
                {formatPrice(r.netProfitSelfDelivery)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {tab === 'prices' && (
        <View>
          <Text style={typography.label}>INGREDIENT PRICES</Text>
          <Text style={[typography.bodyMuted, { fontSize: 11, marginBottom: spacing.sm }]}>
            German wholesale estimates (METRO/Selgros level, netto). Items marked ⚠ your recipes need but your
            inventory sheet didn't list. Replace these with your real prices.
          </Text>
          {INGREDIENT_PRICES.map((p) => (
            <View key={p.name} style={styles.statRow}>
              <Text style={typography.body}>
                {p.missing ? '⚠ ' : ''}
                {p.name}
              </Text>
              <Text style={typography.bodyMuted}>
                {formatPrice(p.price)} / {p.unit}
              </Text>
            </View>
          ))}
        </View>
      )}

      {tab === 'storage' && (
        <View>
          <Text style={typography.label}>FOOD SAFETY RULES</Text>
          {FOOD_SAFETY_RULES.map((rule) => (
            <Text key={rule} style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
              • {rule}
            </Text>
          ))}

          <Text style={[typography.label, { marginTop: spacing.lg }]}>SHELF LIFE</Text>
          {SHELF_LIFE.map((s) => (
            <View key={s.item} style={styles.shelfCard}>
              <View style={styles.statRowInner}>
                <Text style={typography.body}>{s.item}</Text>
                <Text style={typography.bodyMuted}>
                  {s.fridge} · ❄ {s.freezer}
                </Text>
              </View>
              {s.note && <Text style={[typography.bodyMuted, { fontSize: 11, marginTop: 2 }]}>{s.note}</Text>}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
    padding: spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
    padding: spacing.lg,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.forest,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkMuted,
  },
  tabTextActive: {
    color: colors.white,
  },
  sectionContent: {
    paddingBottom: spacing.xl,
  },
  input: {
    marginTop: spacing.xs,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.ink,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    alignItems: 'flex-start',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
  },
  chipActive: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  chipTextActive: {
    color: colors.white,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: 6,
  },
  sourceTag: {
    color: colors.clay,
    fontWeight: '700',
    fontSize: 13,
  },
  smallButton: {
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  saveButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  rowCardHidden: {
    opacity: 0.5,
  },
  menuThumb: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.cream,
  },
  menuThumbEmoji: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 4,
  },
  adminBadge: {
    backgroundColor: colors.forest,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  adminBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  bannedBadge: {
    backgroundColor: colors.danger,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  bannedBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  adminToggleButton: {
    backgroundColor: colors.clay,
  },
  banButton: {
    backgroundColor: colors.danger,
  },
  unbanButton: {
    backgroundColor: colors.leaf,
  },
  privateBanner: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  privateBannerText: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 18,
  },
  subTabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  subTab: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  subTabActive: {
    backgroundColor: colors.clay,
    borderColor: colors.clay,
  },
  subTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkMuted,
  },
  subTabTextActive: {
    color: colors.white,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  checkboxMark: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  checkDone: {
    textDecorationLine: 'line-through',
    color: colors.inkMuted,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  tableHeaderText: {
    fontWeight: '700',
    color: colors.inkMuted,
    fontSize: 11,
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: 4,
  },
  tableCell: {
    flex: 1,
    fontSize: 12,
    color: colors.ink,
  },
  shelfCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  statRowInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  hoursInput: {
    width: 72,
    textAlign: 'center',
  },
  backLink: {
    paddingVertical: spacing.sm,
  },
  backLinkText: {
    color: colors.leaf,
    fontWeight: '700',
    fontSize: 13,
  },
});
