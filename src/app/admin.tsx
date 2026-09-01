// /admin — gated inline: signed out -> sign in; signed in but not admin ->
// "not authorized"; admin -> the dashboard (Settings / Customers / Orders).
// Real enforcement is server-side (Supabase RLS via is_admin()); this
// screen just decides what to render for the current viewer.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import {
  AdminMenuItem,
  AdminProfile,
  InventoryItem,
  InventoryMovement,
  lineUnitPrice,
  Order,
  RecipeCostRow,
  RecipeIngredient,
  RecipeTriggerType,
  useStore,
} from '../context/StoreContext';
import { Nutrition } from '../data/menu';
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

type Section =
  | 'dashboard'
  | 'settings'
  | 'menu'
  | 'inventory'
  | 'recipes'
  | 'customers'
  | 'orders'
  | 'analytics'
  | 'business';

const SECTION_LABELS: Record<Section, string> = {
  dashboard: 'Dashboard',
  settings: 'Settings',
  menu: 'Menu',
  inventory: 'Inventory',
  recipes: 'Recipes',
  customers: 'Customers',
  orders: 'Orders',
  analytics: 'Analytics',
  business: 'Business',
};

export default function AdminScreen() {
  const { user, loading, isAdmin } = useAuth();
  const [section, setSection] = useState<Section>('dashboard');

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
      {section === 'dashboard' && <DashboardSection />}
      {section === 'settings' && <SettingsSection />}
      {section === 'menu' && <MenuSection />}
      {section === 'inventory' && <InventorySection />}
      {section === 'recipes' && <RecipesSection />}
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
  const [weeklyLaborCost, setWeeklyLaborCost] = useState(String(appSettings.weeklyLaborCost));
  const [weeklyOperatingCosts, setWeeklyOperatingCosts] = useState(String(appSettings.weeklyOperatingCosts));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setRadius(String(appSettings.deliveryRadiusKm));
    setPostcodes(appSettings.closedPostcodes);
    setMinOrder(String(appSettings.minimumOrderValue));
    setHours(appSettings.openingHours);
    setPromoCode(appSettings.promoCode);
    setPromoDiscountPct(String(appSettings.promoDiscount * 100));
    setWeeklyLaborCost(String(appSettings.weeklyLaborCost));
    setWeeklyOperatingCosts(String(appSettings.weeklyOperatingCosts));
  }, [
    appSettings.deliveryRadiusKm,
    appSettings.closedPostcodes,
    appSettings.minimumOrderValue,
    appSettings.openingHours,
    appSettings.promoCode,
    appSettings.promoDiscount,
    appSettings.weeklyLaborCost,
    appSettings.weeklyOperatingCosts,
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
    const parsedLabor = Number(weeklyLaborCost);
    const parsedOperating = Number(weeklyOperatingCosts);
    if (!Number.isFinite(parsedLabor) || parsedLabor < 0 || !Number.isFinite(parsedOperating) || parsedOperating < 0) {
      setMessage('Enter valid numbers for labor and operating costs.');
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
      weeklyLaborCost: parsedLabor,
      weeklyOperatingCosts: parsedOperating,
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

      <Text style={[typography.label, { marginTop: spacing.lg }]}>OPERATIONS</Text>
      <Text style={typography.bodyMuted}>
        No shift/timesheet system exists yet, so these are the two figures the Dashboard's profit &amp; loss uses —
        keep them roughly current and it'll keep up.
      </Text>
      <Text style={[typography.label, { marginTop: spacing.sm }]}>WEEKLY LABOR COST (€)</Text>
      <TextInput
        value={weeklyLaborCost}
        onChangeText={setWeeklyLaborCost}
        keyboardType="numeric"
        style={styles.input}
        placeholder="0"
        placeholderTextColor={colors.inkMuted}
      />
      <Text style={[typography.label, { marginTop: spacing.sm }]}>OTHER WEEKLY OPERATING COSTS (€)</Text>
      <Text style={typography.bodyMuted}>Rent, utilities, subscriptions — anything recurring besides ingredients and labor.</Text>
      <TextInput
        value={weeklyOperatingCosts}
        onChangeText={setWeeklyOperatingCosts}
        keyboardType="numeric"
        style={styles.input}
        placeholder="0"
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

// Trims trailing zeros for display — 2.50 -> "2.5", 10.00 -> "10".
function formatQty(n: number): string {
  return Number(n.toFixed(2)).toString();
}

const UNIT_PRESETS = ['kg', 'g', 'l', 'ml', 'pcs', 'pack'];

const MOVEMENT_TYPES: InventoryMovement['type'][] = ['used', 'waste', 'restock'];
const MOVEMENT_LABELS: Record<InventoryMovement['type'], string> = {
  used: 'Used',
  waste: 'Waste',
  restock: 'Restock',
};
const DAY_MS = 24 * 60 * 60 * 1000;

function InventoryRow({
  item,
  movements,
  onChanged,
}: {
  item: InventoryItem;
  movements: InventoryMovement[];
  onChanged: () => void;
}) {
  const { setInventoryStock, upsertInventoryItem, deleteInventoryItem, logInventoryMovement } = useStore();
  const [stockDraft, setStockDraft] = useState(String(item.currentStock));
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [unit, setUnit] = useState(item.unit);
  const [parLevel, setParLevel] = useState(String(item.parLevel));
  const [reorderThreshold, setReorderThreshold] = useState(String(item.reorderThreshold));
  const [notes, setNotes] = useState(item.notes ?? '');
  const [caloriesPerUnit, setCaloriesPerUnit] = useState(item.caloriesPerUnit !== null ? String(item.caloriesPerUnit) : '');
  const [proteinPerUnit, setProteinPerUnit] = useState(item.proteinPerUnit !== null ? String(item.proteinPerUnit) : '');
  const [fiberPerUnit, setFiberPerUnit] = useState(item.fiberPerUnit !== null ? String(item.fiberPerUnit) : '');
  const [carbsPerUnit, setCarbsPerUnit] = useState(item.carbsPerUnit !== null ? String(item.carbsPerUnit) : '');
  const [fatPerUnit, setFatPerUnit] = useState(item.fatPerUnit !== null ? String(item.fatPerUnit) : '');
  const [costPerUnit, setCostPerUnit] = useState(item.costPerUnit !== null ? String(item.costPerUnit) : '');
  const [message, setMessage] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [moveType, setMoveType] = useState<InventoryMovement['type']>('used');
  const [moveQty, setMoveQty] = useState('');
  const [moveNote, setMoveNote] = useState('');
  const [moveMessage, setMoveMessage] = useState<string | null>(null);

  useEffect(() => {
    setStockDraft(String(item.currentStock));
  }, [item.currentStock]);

  const commitStock = async () => {
    const parsed = Number(stockDraft);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed === item.currentStock) {
      setStockDraft(String(item.currentStock));
      return;
    }
    setSaving(true);
    await setInventoryStock(item.id, parsed);
    setSaving(false);
    onChanged();
  };

  const saveDetails = async () => {
    const parsedPar = Number(parLevel);
    const parsedThreshold = Number(reorderThreshold);
    if (!name.trim() || !category.trim() || !unit.trim()) {
      setMessage('Name, category and unit are required.');
      return;
    }
    if (!Number.isFinite(parsedPar) || parsedPar < 0 || !Number.isFinite(parsedThreshold) || parsedThreshold < 0) {
      setMessage('Enter valid numbers for par level and reorder threshold.');
      return;
    }
    const numericFields = [caloriesPerUnit, proteinPerUnit, fiberPerUnit, carbsPerUnit, fatPerUnit, costPerUnit];
    if (numericFields.some((v) => v.trim() && (!Number.isFinite(Number(v)) || Number(v) < 0))) {
      setMessage('Per-unit nutrition and cost values must be valid numbers, or left blank.');
      return;
    }
    setSaving(true);
    setMessage(null);
    const { error } = await upsertInventoryItem({
      id: item.id,
      name: name.trim(),
      category: category.trim(),
      unit: unit.trim(),
      currentStock: item.currentStock,
      parLevel: parsedPar,
      reorderThreshold: parsedThreshold,
      notes: notes.trim() || null,
      caloriesPerUnit: caloriesPerUnit.trim() ? Number(caloriesPerUnit) : null,
      proteinPerUnit: proteinPerUnit.trim() ? Number(proteinPerUnit) : null,
      fiberPerUnit: fiberPerUnit.trim() ? Number(fiberPerUnit) : null,
      carbsPerUnit: carbsPerUnit.trim() ? Number(carbsPerUnit) : null,
      fatPerUnit: fatPerUnit.trim() ? Number(fatPerUnit) : null,
      costPerUnit: costPerUnit.trim() ? Number(costPerUnit) : null,
    });
    setSaving(false);
    if (error) {
      setMessage(error);
      return;
    }
    setEditing(false);
    onChanged();
  };

  const remove = async () => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete "${item.name}" from inventory?`)) return;
    setSaving(true);
    await deleteInventoryItem(item.id);
    setSaving(false);
    onChanged();
  };

  const submitMovement = async () => {
    const parsed = Number(moveQty);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setMoveMessage('Enter a quantity greater than 0.');
      return;
    }
    setSaving(true);
    setMoveMessage(null);
    const { error } = await logInventoryMovement(item.id, moveType, parsed, item.currentStock, moveNote);
    setSaving(false);
    if (error) {
      setMoveMessage(error);
      return;
    }
    setMoveQty('');
    setMoveNote('');
    setLogging(false);
    onChanged();
  };

  const status: 'out' | 'low' | 'ok' =
    item.currentStock <= 0 ? 'out' : item.currentStock <= item.reorderThreshold ? 'low' : 'ok';

  const now = Date.now();
  const usedThisWeek = movements
    .filter((m) => m.type === 'used' && now - new Date(m.createdAt).getTime() <= 7 * DAY_MS)
    .reduce((sum, m) => sum + m.quantity, 0);
  const wasteThisWeek = movements
    .filter((m) => m.type === 'waste' && now - new Date(m.createdAt).getTime() <= 7 * DAY_MS)
    .reduce((sum, m) => sum + m.quantity, 0);

  return (
    <View style={styles.rowCard}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={typography.body}>{item.name}</Text>
            <Text style={typography.bodyMuted}>
              {item.category} · par {formatQty(item.parLevel)} {item.unit}
            </Text>
            {(usedThisWeek > 0 || wasteThisWeek > 0) && (
              <Text style={[typography.bodyMuted, { fontSize: 11 }]}>
                This week —{usedThisWeek > 0 ? ` used ${formatQty(usedThisWeek)} ${item.unit}` : ''}
                {usedThisWeek > 0 && wasteThisWeek > 0 ? ' ·' : ''}
                {wasteThisWeek > 0 ? ` wasted ${formatQty(wasteThisWeek)} ${item.unit}` : ''}
              </Text>
            )}
          </View>
          {status !== 'ok' && (
            <View style={styles.lowBadge}>
              <Text style={styles.lowBadgeText}>{status === 'out' ? 'Out' : 'Low'}</Text>
            </View>
          )}
          <View style={styles.stockEditor}>
            <TextInput
              value={stockDraft}
              onChangeText={setStockDraft}
              onBlur={commitStock}
              onSubmitEditing={commitStock}
              keyboardType="numeric"
              style={[styles.input, styles.stockInput]}
            />
            <Text style={styles.unitLabel}>{item.unit}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm }}>
          <Pressable style={styles.smallButton} onPress={() => setLogging(!logging)}>
            <Text style={styles.smallButtonText}>{logging ? 'Close' : 'Log'}</Text>
          </Pressable>
          <Pressable style={styles.smallButton} onPress={() => setEditing(!editing)}>
            <Text style={styles.smallButtonText}>{editing ? 'Close' : 'Edit'}</Text>
          </Pressable>
          <Pressable style={[styles.smallButton, styles.banButton]} onPress={remove} disabled={saving}>
            <Text style={styles.smallButtonText}>Delete</Text>
          </Pressable>
        </View>

        {logging && (
          <View style={{ marginTop: spacing.md }}>
            <View style={styles.chipRow}>
              {MOVEMENT_TYPES.map((t) => (
                <Pressable key={t} style={[styles.chip, moveType === t && styles.chipActive]} onPress={() => setMoveType(t)}>
                  <Text style={[styles.chipText, moveType === t && styles.chipTextActive]}>{MOVEMENT_LABELS[t]}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.inputRow}>
              <TextInput
                value={moveQty}
                onChangeText={setMoveQty}
                keyboardType="numeric"
                style={[styles.input, { flex: 1, marginTop: 0 }]}
                placeholder={`Amount in ${item.unit}`}
                placeholderTextColor={colors.inkMuted}
              />
              <Pressable style={styles.smallButton} onPress={submitMovement} disabled={saving}>
                <Text style={styles.smallButtonText}>{saving ? '…' : 'Log'}</Text>
              </Pressable>
            </View>
            <TextInput
              value={moveNote}
              onChangeText={setMoveNote}
              style={[styles.input, { marginTop: spacing.sm }]}
              placeholder="Note (optional)"
              placeholderTextColor={colors.inkMuted}
            />
            {moveMessage && <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>{moveMessage}</Text>}
          </View>
        )}

        {editing && (
          <View style={{ marginTop: spacing.md }}>
            <Text style={typography.label}>NAME</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor={colors.inkMuted} />

            <Text style={[typography.label, { marginTop: spacing.sm }]}>CATEGORY</Text>
            <TextInput
              value={category}
              onChangeText={setCategory}
              style={styles.input}
              placeholderTextColor={colors.inkMuted}
            />

            <Text style={[typography.label, { marginTop: spacing.sm }]}>UNIT</Text>
            <TextInput value={unit} onChangeText={setUnit} style={styles.input} placeholderTextColor={colors.inkMuted} />
            <View style={styles.chipRow}>
              {UNIT_PRESETS.map((u) => (
                <Pressable key={u} style={[styles.chip, unit === u && styles.chipActive]} onPress={() => setUnit(u)}>
                  <Text style={[styles.chipText, unit === u && styles.chipTextActive]}>{u}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[typography.label, { marginTop: spacing.sm }]}>PAR LEVEL (target stock)</Text>
            <TextInput
              value={parLevel}
              onChangeText={setParLevel}
              keyboardType="numeric"
              style={styles.input}
              placeholderTextColor={colors.inkMuted}
            />

            <Text style={[typography.label, { marginTop: spacing.sm }]}>REORDER THRESHOLD</Text>
            <Text style={typography.bodyMuted}>Flagged as "running low" at or below this amount.</Text>
            <TextInput
              value={reorderThreshold}
              onChangeText={setReorderThreshold}
              keyboardType="numeric"
              style={styles.input}
              placeholderTextColor={colors.inkMuted}
            />

            <Text style={[typography.label, { marginTop: spacing.sm }]}>NOTES</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              style={styles.input}
              placeholder="Supplier, size, anything useful"
              placeholderTextColor={colors.inkMuted}
            />

            <Text style={[typography.label, { marginTop: spacing.md }]}>NUTRITION PER {unit.toUpperCase() || 'UNIT'}</Text>
            <Text style={typography.bodyMuted}>
              Optional — lets a dish's nutrition be computed from its recipe instead of typed in by hand.
            </Text>
            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.label, { marginTop: spacing.sm, fontSize: 10 }]}>KCAL</Text>
                <TextInput
                  value={caloriesPerUnit}
                  onChangeText={setCaloriesPerUnit}
                  keyboardType="numeric"
                  style={styles.input}
                  placeholderTextColor={colors.inkMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.label, { marginTop: spacing.sm, fontSize: 10 }]}>PROTEIN (G)</Text>
                <TextInput
                  value={proteinPerUnit}
                  onChangeText={setProteinPerUnit}
                  keyboardType="numeric"
                  style={styles.input}
                  placeholderTextColor={colors.inkMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.label, { marginTop: spacing.sm, fontSize: 10 }]}>FIBER (G)</Text>
                <TextInput
                  value={fiberPerUnit}
                  onChangeText={setFiberPerUnit}
                  keyboardType="numeric"
                  style={styles.input}
                  placeholderTextColor={colors.inkMuted}
                />
              </View>
            </View>
            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.label, { fontSize: 10 }]}>CARBS (G)</Text>
                <TextInput
                  value={carbsPerUnit}
                  onChangeText={setCarbsPerUnit}
                  keyboardType="numeric"
                  style={[styles.input, { marginTop: 0 }]}
                  placeholderTextColor={colors.inkMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.label, { fontSize: 10 }]}>FAT (G)</Text>
                <TextInput
                  value={fatPerUnit}
                  onChangeText={setFatPerUnit}
                  keyboardType="numeric"
                  style={[styles.input, { marginTop: 0 }]}
                  placeholderTextColor={colors.inkMuted}
                />
              </View>
            </View>

            <Text style={[typography.label, { marginTop: spacing.md }]}>COST PER {unit.toUpperCase() || 'UNIT'} (€)</Text>
            <Text style={typography.bodyMuted}>
              What one unit actually costs to buy — powers dish margins and turns logged waste into a cost figure.
            </Text>
            <TextInput
              value={costPerUnit}
              onChangeText={setCostPerUnit}
              keyboardType="numeric"
              style={styles.input}
              placeholderTextColor={colors.inkMuted}
            />

            <Pressable style={styles.saveButton} onPress={saveDetails} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save details'}</Text>
            </Pressable>
            {message && <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]}>{message}</Text>}
          </View>
        )}
      </View>
    </View>
  );
}

function InventorySection() {
  const { fetchInventoryItems, fetchInventoryMovements, upsertInventoryItem } = useStore();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('kg');
  const [currentStock, setCurrentStock] = useState('0');
  const [parLevel, setParLevel] = useState('0');
  const [reorderThreshold, setReorderThreshold] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    fetchInventoryItems().then(setItems);
    fetchInventoryMovements().then(setMovements);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setName('');
    setCategory('');
    setUnit('kg');
    setCurrentStock('0');
    setParLevel('0');
    setReorderThreshold('0');
    setNotes('');
    setMessage(null);
  };

  const addIngredient = async () => {
    const parsedCurrent = Number(currentStock);
    const parsedPar = Number(parLevel);
    const parsedThreshold = Number(reorderThreshold);
    if (!name.trim() || !unit.trim()) {
      setMessage('Enter at least a name and a unit.');
      return;
    }
    if (![parsedCurrent, parsedPar, parsedThreshold].every((n) => Number.isFinite(n) && n >= 0)) {
      setMessage('Stock, par level and reorder threshold must be valid numbers.');
      return;
    }
    setSaving(true);
    setMessage(null);
    const { error } = await upsertInventoryItem({
      name: name.trim(),
      category: category.trim() || 'Other',
      unit: unit.trim(),
      currentStock: parsedCurrent,
      parLevel: parsedPar,
      reorderThreshold: parsedThreshold,
      notes: notes.trim() || null,
      caloriesPerUnit: null,
      proteinPerUnit: null,
      fiberPerUnit: null,
      carbsPerUnit: null,
      fatPerUnit: null,
      costPerUnit: null,
    });
    setSaving(false);
    if (error) {
      setMessage(error);
      return;
    }
    resetForm();
    setShowAddForm(false);
    load();
  };

  if (!items) {
    return <ActivityIndicator color={colors.forest} style={{ marginTop: spacing.xl }} />;
  }

  const needsRestock = items
    .filter((i) => i.currentStock <= i.reorderThreshold)
    .map((i) => ({
      item: i,
      suggested: Math.max(i.parLevel - i.currentStock, i.reorderThreshold - i.currentStock, 0),
    }))
    .sort(
      (a, b) => a.item.currentStock - a.item.reorderThreshold - (b.item.currentStock - b.item.reorderThreshold)
    );

  const movementsByItem = new Map<string, InventoryMovement[]>();
  movements.forEach((m) => {
    const list = movementsByItem.get(m.itemId) ?? [];
    list.push(m);
    movementsByItem.set(m.itemId, list);
  });

  // Trailing-4-week average of used+waste, projected against what's
  // currently on hand — restocks don't count toward "how much you'll use".
  const now = Date.now();
  const nextWeekEstimate = items
    .map((item) => {
      const last28Days = (movementsByItem.get(item.id) ?? []).filter(
        (m) => (m.type === 'used' || m.type === 'waste') && now - new Date(m.createdAt).getTime() <= 28 * DAY_MS
      );
      const avgWeekly = last28Days.reduce((sum, m) => sum + m.quantity, 0) / 4;
      return { item, avgWeekly, shortfall: Math.max(avgWeekly - item.currentStock, 0) };
    })
    .filter((r) => r.avgWeekly > 0 && r.shortfall > 0)
    .sort((a, b) => b.shortfall - a.shortfall);

  const existingCategories = Array.from(new Set(items.map((i) => i.category))).sort();
  const grouped = new Map<string, InventoryItem[]>();
  items.forEach((i) => {
    const list = grouped.get(i.category) ?? [];
    list.push(i);
    grouped.set(i.category, list);
  });
  const groupNames = Array.from(grouped.keys()).sort();

  return (
    <ScrollView contentContainerStyle={styles.sectionContent}>
      <View style={styles.privateBanner}>
        <Text style={styles.privateBannerText}>
          📦 Internal only — ingredient stock and reorder estimates for kitchen ops, never shown to customers.
        </Text>
      </View>

      <Text style={typography.label}>NEEDS RESTOCK</Text>
      {needsRestock.length === 0 ? (
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>Everything's stocked. ✓</Text>
      ) : (
        needsRestock.map(({ item, suggested }) => (
          <View key={item.id} style={styles.statRow}>
            <View style={{ flex: 1 }}>
              <Text style={typography.body}>{item.name}</Text>
              <Text style={typography.bodyMuted}>
                {formatQty(item.currentStock)} {item.unit} left · reorder at {formatQty(item.reorderThreshold)}{' '}
                {item.unit}
              </Text>
            </View>
            <Text style={styles.restockAmount}>
              +{formatQty(suggested)} {item.unit}
            </Text>
          </View>
        ))
      )}

      <Text style={[typography.label, { marginTop: spacing.lg }]}>NEXT WEEK'S ESTIMATE</Text>
      <Text style={typography.bodyMuted}>Based on the last 4 weeks of logged usage and waste.</Text>
      {nextWeekEstimate.length === 0 ? (
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
          Not enough usage history yet — log usage or waste on an ingredient below to start seeing estimates here.
        </Text>
      ) : (
        nextWeekEstimate.map(({ item, avgWeekly, shortfall }) => (
          <View key={item.id} style={styles.statRow}>
            <View style={{ flex: 1 }}>
              <Text style={typography.body}>{item.name}</Text>
              <Text style={typography.bodyMuted}>
                ~{formatQty(avgWeekly)} {item.unit}/week avg · {formatQty(item.currentStock)} {item.unit} on hand
              </Text>
            </View>
            <Text style={styles.restockAmount}>
              +{formatQty(shortfall)} {item.unit}
            </Text>
          </View>
        ))
      )}

      <Pressable
        style={styles.saveButton}
        onPress={() => {
          if (!showAddForm) resetForm();
          setShowAddForm(!showAddForm);
        }}
      >
        <Text style={styles.saveButtonText}>{showAddForm ? 'Cancel' : '+ Add ingredient'}</Text>
      </Pressable>

      {showAddForm && (
        <View style={{ marginTop: spacing.md }}>
          <Text style={typography.label}>NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholder="e.g. Basmati rice"
            placeholderTextColor={colors.inkMuted}
          />

          <Text style={[typography.label, { marginTop: spacing.md }]}>CATEGORY</Text>
          <TextInput
            value={category}
            onChangeText={setCategory}
            style={styles.input}
            placeholder="e.g. Grains"
            placeholderTextColor={colors.inkMuted}
          />
          {existingCategories.length > 0 && (
            <View style={styles.chipRow}>
              {existingCategories.map((c) => (
                <Pressable key={c} style={styles.chip} onPress={() => setCategory(c)}>
                  <Text style={styles.chipText}>{c}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={[typography.label, { marginTop: spacing.md }]}>UNIT</Text>
          <TextInput
            value={unit}
            onChangeText={setUnit}
            style={styles.input}
            placeholder="kg"
            placeholderTextColor={colors.inkMuted}
          />
          <View style={styles.chipRow}>
            {UNIT_PRESETS.map((u) => (
              <Pressable key={u} style={[styles.chip, unit === u && styles.chipActive]} onPress={() => setUnit(u)}>
                <Text style={[styles.chipText, unit === u && styles.chipTextActive]}>{u}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[typography.label, { marginTop: spacing.md }]}>CURRENT STOCK</Text>
          <TextInput
            value={currentStock}
            onChangeText={setCurrentStock}
            keyboardType="numeric"
            style={styles.input}
            placeholder="0"
            placeholderTextColor={colors.inkMuted}
          />

          <Text style={[typography.label, { marginTop: spacing.md }]}>PAR LEVEL (target stock)</Text>
          <Text style={typography.bodyMuted}>How much you like to keep on hand when fully stocked.</Text>
          <TextInput
            value={parLevel}
            onChangeText={setParLevel}
            keyboardType="numeric"
            style={styles.input}
            placeholder="0"
            placeholderTextColor={colors.inkMuted}
          />

          <Text style={[typography.label, { marginTop: spacing.md }]}>REORDER THRESHOLD</Text>
          <Text style={typography.bodyMuted}>Flagged as "running low" at or below this amount.</Text>
          <TextInput
            value={reorderThreshold}
            onChangeText={setReorderThreshold}
            keyboardType="numeric"
            style={styles.input}
            placeholder="0"
            placeholderTextColor={colors.inkMuted}
          />

          <Text style={[typography.label, { marginTop: spacing.md }]}>NOTES (optional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            style={styles.input}
            placeholder="Supplier, size, anything useful"
            placeholderTextColor={colors.inkMuted}
          />

          <Pressable style={styles.saveButton} onPress={addIngredient} disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save ingredient'}</Text>
          </Pressable>
          {message && <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]}>{message}</Text>}
        </View>
      )}

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>ALL INGREDIENTS</Text>
      {items.length === 0 && <Text style={typography.bodyMuted}>No ingredients yet — add your first one above.</Text>}
      {groupNames.map((cat) => (
        <View key={cat}>
          <Text style={[typography.label, { marginTop: spacing.md, marginBottom: spacing.xs, fontSize: 11 }]}>
            {cat.toUpperCase()}
          </Text>
          {(grouped.get(cat) ?? []).map((item) => (
            <InventoryRow
              key={item.id}
              item={item}
              movements={movementsByItem.get(item.id) ?? []}
              onChanged={load}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const TRIGGER_LABELS: Record<RecipeTriggerType, string> = {
  base: 'ALWAYS USED',
  rice_scoop: 'PER RICE SCOOP',
  protein: 'BY PROTEIN CHOICE',
  addon: 'BY ADD-ON',
};

function RecipesSection() {
  const {
    fetchAllMenuItemsAdmin,
    fetchInventoryItems,
    fetchRecipeForItem,
    upsertRecipeIngredient,
    deleteRecipeIngredient,
    computeNutritionFromRecipe,
    upsertMenuItem,
  } = useStore();
  const [menuItems, setMenuItems] = useState<AdminMenuItem[] | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[] | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<RecipeIngredient[] | null>(null);
  const [busy, setBusy] = useState(false);

  const [ingredientId, setIngredientId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [triggerType, setTriggerType] = useState<RecipeTriggerType>('base');
  const [triggerValue, setTriggerValue] = useState<string | null>(null);
  const [addMessage, setAddMessage] = useState<string | null>(null);

  const [computedNutrition, setComputedNutrition] = useState<Nutrition | null>(null);
  const [computeMessage, setComputeMessage] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    fetchAllMenuItemsAdmin().then(setMenuItems);
    fetchInventoryItems().then(setInventoryItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRecipe = (itemId: string) => {
    fetchRecipeForItem(itemId).then(setRecipe);
  };

  const selectItem = (itemId: string) => {
    setSelectedItemId(itemId);
    setRecipe(null);
    setComputedNutrition(null);
    setComputeMessage(null);
    setAddMessage(null);
    setIngredientId('');
    setQuantity('');
    setTriggerType('base');
    setTriggerValue(null);
    loadRecipe(itemId);
  };

  if (!menuItems || !inventoryItems) {
    return <ActivityIndicator color={colors.forest} style={{ marginTop: spacing.xl }} />;
  }

  const selectedItem = menuItems.find((i) => i.id === selectedItemId) ?? null;
  const ingredientById = new Map(inventoryItems.map((i) => [i.id, i]));
  const ingredientCategories = Array.from(new Set(inventoryItems.map((i) => i.category))).sort();

  const groupedItems = new Map<string, AdminMenuItem[]>();
  menuItems.forEach((i) => {
    const key = i.groupLabel ?? i.category;
    const list = groupedItems.get(key) ?? [];
    list.push(i);
    groupedItems.set(key, list);
  });

  const recipeByTrigger: Record<RecipeTriggerType, RecipeIngredient[]> = {
    base: [],
    rice_scoop: [],
    protein: [],
    addon: [],
  };
  (recipe ?? []).forEach((r) => recipeByTrigger[r.triggerType].push(r));

  const hasBase = Boolean(selectedItem?.proteinOptions && selectedItem.proteinOptions.length > 0);
  const hasAddOns = Boolean(selectedItem?.addOns && selectedItem.addOns.length > 0);

  const addRow = async () => {
    if (!selectedItemId) return;
    const parsedQty = Number(quantity);
    if (!ingredientId) {
      setAddMessage('Pick an ingredient.');
      return;
    }
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setAddMessage('Enter a quantity greater than 0.');
      return;
    }
    setBusy(true);
    setAddMessage(null);
    const { error } = await upsertRecipeIngredient({
      menuItemId: selectedItemId,
      inventoryItemId: ingredientId,
      quantity: parsedQty,
      triggerType,
      triggerValue,
    });
    setBusy(false);
    if (error) {
      setAddMessage(error);
      return;
    }
    setIngredientId('');
    setQuantity('');
    loadRecipe(selectedItemId);
  };

  const removeRow = async (id: string) => {
    setBusy(true);
    await deleteRecipeIngredient(id);
    setBusy(false);
    if (selectedItemId) loadRecipe(selectedItemId);
  };

  const runCompute = async () => {
    if (!selectedItemId) return;
    setComputing(true);
    setComputeMessage(null);
    const result = await computeNutritionFromRecipe(selectedItemId, selectedItem?.proteinOptions?.[0]);
    setComputing(false);
    if (!result) {
      setComputeMessage("Couldn't compute — add some recipe ingredients first.");
      return;
    }
    setComputedNutrition(result);
  };

  const saveNutrition = async () => {
    if (!selectedItem || !computedNutrition) return;
    setBusy(true);
    setComputeMessage(null);
    const { error } = await upsertMenuItem({
      id: selectedItem.id,
      name: selectedItem.name,
      description: selectedItem.description,
      price: selectedItem.price,
      category: selectedItem.category,
      emoji: selectedItem.emoji,
      imageUrl: selectedItem.imageUrl,
      tags: selectedItem.tags ?? [],
      allergens: selectedItem.allergens ?? [],
      ingredients: selectedItem.ingredients ?? null,
      proteinOptions: selectedItem.proteinOptions ?? null,
      addOns: selectedItem.addOns ?? null,
      origin: selectedItem.origin ?? null,
      nutrition: computedNutrition,
      groupId: selectedItem.groupId ?? null,
      groupLabel: selectedItem.groupLabel ?? null,
      isActive: selectedItem.isActive,
      sortOrder: selectedItem.sortOrder,
    });
    setBusy(false);
    if (error) {
      setComputeMessage(error);
      return;
    }
    setComputeMessage("Saved as this dish's nutrition.");
    fetchAllMenuItemsAdmin().then(setMenuItems);
  };

  return (
    <ScrollView contentContainerStyle={styles.sectionContent}>
      <View style={styles.privateBanner}>
        <Text style={styles.privateBannerText}>
          🧾 Internal only — recipe composition, never shown to customers. Once a dish has a recipe, placing an order
          for it automatically deducts its ingredients from Inventory.
        </Text>
      </View>

      <Text style={typography.label}>PICK A DISH</Text>
      {Array.from(groupedItems.keys())
        .sort()
        .map((groupKey) => (
          <View key={groupKey}>
            <Text style={[typography.label, { marginTop: spacing.md, marginBottom: spacing.xs, fontSize: 11 }]}>
              {groupKey.toUpperCase()}
            </Text>
            <View style={styles.chipRow}>
              {(groupedItems.get(groupKey) ?? []).map((i) => (
                <Pressable
                  key={i.id}
                  style={[styles.chip, selectedItemId === i.id && styles.chipActive]}
                  onPress={() => selectItem(i.id)}
                >
                  <Text style={[styles.chipText, selectedItemId === i.id && styles.chipTextActive]}>{i.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

      {selectedItem && (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={typography.h3}>{selectedItem.name}</Text>

          {(['base', 'rice_scoop', 'protein', 'addon'] as RecipeTriggerType[]).map((t) => {
            if (t === 'rice_scoop' && !hasBase) return null;
            if (t === 'protein' && !hasBase) return null;
            if (t === 'addon' && !hasAddOns) return null;
            const rows = recipeByTrigger[t];
            return (
              <View key={t} style={{ marginTop: spacing.md }}>
                <Text style={[typography.label, { fontSize: 11 }]}>{TRIGGER_LABELS[t]}</Text>
                {rows.length === 0 && (
                  <Text style={[typography.bodyMuted, { marginTop: 4 }]}>Nothing added yet.</Text>
                )}
                {rows.map((r) => {
                  const ing = ingredientById.get(r.inventoryItemId);
                  return (
                    <View key={r.id} style={styles.statRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={typography.body}>
                          {ing?.name ?? 'Unknown ingredient'}
                          {t === 'addon' && r.triggerValue
                            ? ` — ${selectedItem.addOns?.find((a) => a.id === r.triggerValue)?.name ?? r.triggerValue}`
                            : t === 'protein' && r.triggerValue
                            ? ` — ${r.triggerValue}`
                            : ''}
                        </Text>
                        <Text style={typography.bodyMuted}>
                          {formatQty(r.quantity)} {ing?.unit ?? ''}
                          {t === 'rice_scoop' ? ' per scoop' : ''}
                        </Text>
                      </View>
                      <Pressable style={[styles.smallButton, styles.banButton]} onPress={() => removeRow(r.id)}>
                        <Text style={styles.smallButtonText}>✕</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            );
          })}

          <Text style={[typography.label, { marginTop: spacing.lg }]}>ADD INGREDIENT TO RECIPE</Text>
          <Text style={[typography.bodyMuted, { fontSize: 11 }]}>INGREDIENT</Text>
          {ingredientCategories.map((cat) => (
            <View key={cat}>
              <Text style={[typography.bodyMuted, { fontSize: 10, marginTop: spacing.xs }]}>{cat}</Text>
              <View style={styles.chipRow}>
                {inventoryItems
                  .filter((i) => i.category === cat)
                  .map((i) => (
                    <Pressable
                      key={i.id}
                      style={[styles.chip, ingredientId === i.id && styles.chipActive]}
                      onPress={() => setIngredientId(i.id)}
                    >
                      <Text style={[styles.chipText, ingredientId === i.id && styles.chipTextActive]}>{i.name}</Text>
                    </Pressable>
                  ))}
              </View>
            </View>
          ))}

          <Text style={[typography.label, { marginTop: spacing.md }]}>
            QUANTITY{ingredientId ? ` (${ingredientById.get(ingredientId)?.unit})` : ''}
          </Text>
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            style={styles.input}
            placeholder="0"
            placeholderTextColor={colors.inkMuted}
          />

          <Text style={[typography.label, { marginTop: spacing.md }]}>APPLIES</Text>
          <View style={styles.chipRow}>
            <Pressable
              style={[styles.chip, triggerType === 'base' && styles.chipActive]}
              onPress={() => {
                setTriggerType('base');
                setTriggerValue(null);
              }}
            >
              <Text style={[styles.chipText, triggerType === 'base' && styles.chipTextActive]}>Always</Text>
            </Pressable>
            {hasBase && (
              <Pressable
                style={[styles.chip, triggerType === 'rice_scoop' && styles.chipActive]}
                onPress={() => {
                  setTriggerType('rice_scoop');
                  setTriggerValue(null);
                }}
              >
                <Text style={[styles.chipText, triggerType === 'rice_scoop' && styles.chipTextActive]}>
                  Per rice scoop
                </Text>
              </Pressable>
            )}
            {(selectedItem.proteinOptions ?? []).map((p) => (
              <Pressable
                key={p}
                style={[styles.chip, triggerType === 'protein' && triggerValue === p && styles.chipActive]}
                onPress={() => {
                  setTriggerType('protein');
                  setTriggerValue(p);
                }}
              >
                <Text
                  style={[styles.chipText, triggerType === 'protein' && triggerValue === p && styles.chipTextActive]}
                >
                  Protein: {p}
                </Text>
              </Pressable>
            ))}
            {(selectedItem.addOns ?? []).map((a) => (
              <Pressable
                key={a.id}
                style={[styles.chip, triggerType === 'addon' && triggerValue === a.id && styles.chipActive]}
                onPress={() => {
                  setTriggerType('addon');
                  setTriggerValue(a.id);
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    triggerType === 'addon' && triggerValue === a.id && styles.chipTextActive,
                  ]}
                >
                  Add-on: {a.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.saveButton} onPress={addRow} disabled={busy}>
            <Text style={styles.saveButtonText}>{busy ? '…' : '+ Add to recipe'}</Text>
          </Pressable>
          {addMessage && <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]}>{addMessage}</Text>}

          <Text style={[typography.label, { marginTop: spacing.xl }]}>NUTRITION FROM RECIPE</Text>
          <Text style={typography.bodyMuted}>
            Sums "always used" + "per rice scoop" (at 1 scoop) + the {selectedItem.proteinOptions?.[0] ?? 'default'}{' '}
            protein ingredients — the same basis as "estimated for the default protein choice" on the dish's own
            page.
          </Text>
          <Pressable style={styles.smallButton} onPress={runCompute} disabled={computing}>
            <Text style={styles.smallButtonText}>{computing ? 'Computing…' : 'Compute'}</Text>
          </Pressable>

          {computedNutrition && (
            <View style={{ marginTop: spacing.sm }}>
              <View style={styles.statRow}>
                <Text style={typography.body}>Calories</Text>
                <Text style={typography.bodyMuted}>{computedNutrition.calories} kcal</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={typography.body}>Protein</Text>
                <Text style={typography.bodyMuted}>{computedNutrition.protein} g</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={typography.body}>Fiber</Text>
                <Text style={typography.bodyMuted}>{computedNutrition.fiber} g</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={typography.body}>Carbs</Text>
                <Text style={typography.bodyMuted}>{computedNutrition.carbs} g</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={typography.body}>Fat</Text>
                <Text style={typography.bodyMuted}>{computedNutrition.fat} g</Text>
              </View>
              <Pressable style={styles.saveButton} onPress={saveNutrition} disabled={busy}>
                <Text style={styles.saveButtonText}>{busy ? 'Saving…' : "Save as this dish's nutrition"}</Text>
              </Pressable>
            </View>
          )}
          {computeMessage && <Text style={[typography.bodyMuted, { marginTop: spacing.sm }]}>{computeMessage}</Text>}
        </View>
      )}
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

const MANUAL_SOURCES = ['Lieferando', 'Phone', 'Walk-in', 'Staff', 'Other'];

function OrdersSection() {
  const { fetchAllOrders, fetchAllProfiles, logManualOrder, cancelOrder } = useStore();
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

  const cancelOrRefund = async (order: Order) => {
    if (typeof window === 'undefined') return;
    const reason = window.prompt(`Cancel or mark "${order.id}" as returned — what's the reason?`);
    if (reason === null) return;
    await cancelOrder(order.id, reason.trim() || 'No reason given');
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
        <View key={order.id} style={styles.rowCard}>
          <Pressable style={{ flex: 1 }} onPress={() => setOpenReceipt(order)}>
            <Text style={typography.body}>
              {order.id} · {formatPrice(order.total)}
              {order.source !== 'website' && <Text style={styles.sourceTag}> · {order.source}</Text>}
              {order.status === 'cancelled' && <Text style={styles.cancelledTag}> · Cancelled/Returned</Text>}
            </Text>
            <Text style={typography.bodyMuted}>
              {(order.userId && emailById[order.userId]) ?? order.fulfillment.address ?? 'No address'} ·{' '}
              {new Date(order.placedAt).toLocaleString()}
            </Text>
            {order.status === 'cancelled' && order.cancellationReason && (
              <Text style={[typography.bodyMuted, { fontSize: 11, marginTop: 2 }]}>
                Reason: {order.cancellationReason}
              </Text>
            )}
          </Pressable>
          {order.status !== 'cancelled' && (
            <Pressable style={[styles.smallButton, styles.banButton]} onPress={() => cancelOrRefund(order)}>
              <Text style={styles.smallButtonText}>Cancel</Text>
            </Pressable>
          )}
        </View>
      ))}
      {orders.length === 0 && <Text style={typography.bodyMuted}>No orders yet.</Text>}
    </ScrollView>
  );
}

type DashboardPeriod = 'today' | 'week' | 'month';

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
};

const PERIOD_DAYS: Record<DashboardPeriod, number> = {
  today: 1,
  week: 7,
  month: 30,
};

function periodStart(period: DashboardPeriod): Date {
  const now = new Date();
  if (period === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  const days = PERIOD_DAYS[period];
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

// Menu-engineering quadrant — the classic popularity-vs-margin split,
// against the median of whatever's actually sold in the period rather
// than a fixed threshold, so it stays meaningful at any sales volume.
type MenuQuadrant = 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog';

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function DashboardSection() {
  const {
    fetchAllOrders,
    fetchInventoryItems,
    fetchInventoryMovements,
    fetchAllRecipeCosts,
    fetchAllMenuItemsAdmin,
    appSettings,
  } = useStore();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[] | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [recipeCosts, setRecipeCosts] = useState<RecipeCostRow[]>([]);
  const [menuItems, setMenuItems] = useState<AdminMenuItem[] | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>('week');

  useEffect(() => {
    fetchAllOrders().then(setOrders);
    fetchInventoryItems().then(setInventoryItems);
    fetchInventoryMovements().then(setMovements);
    fetchAllRecipeCosts().then(setRecipeCosts);
    fetchAllMenuItemsAdmin().then(setMenuItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!orders || !inventoryItems || !menuItems) {
    return <ActivityIndicator color={colors.forest} style={{ marginTop: spacing.xl }} />;
  }

  const start = periodStart(period);
  const inPeriod = (iso: string) => new Date(iso) >= start;

  const periodOrders = orders.filter((o) => inPeriod(o.placedAt));
  const cancelledOrders = periodOrders.filter((o) => o.status === 'cancelled');
  const staffOrders = periodOrders.filter((o) => o.source === 'staff');
  const revenueOrders = periodOrders.filter((o) => o.status !== 'cancelled' && o.source !== 'staff');

  const revenue = revenueOrders.reduce((sum, o) => sum + o.total, 0);
  const orderCount = revenueOrders.length;
  const aov = orderCount > 0 ? revenue / orderCount : 0;

  const dishStats = new Map<string, { name: string; qty: number; revenue: number }>();
  revenueOrders.forEach((o) => {
    o.lines.forEach((line) => {
      const key = line.item.id;
      const entry = dishStats.get(key) ?? { name: line.item.name, qty: 0, revenue: 0 };
      entry.qty += line.quantity;
      entry.revenue += lineUnitPrice(line) * line.quantity;
      dishStats.set(key, entry);
    });
  });
  const topDishes = Array.from(dishStats.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const inventoryById = new Map(inventoryItems.map((i) => [i.id, i]));
  const periodMovements = movements.filter((m) => inPeriod(m.createdAt));

  const cogs = periodMovements
    .filter((m) => m.type === 'used')
    .reduce((sum, m) => sum + (inventoryById.get(m.itemId)?.costPerUnit ?? 0) * m.quantity, 0);

  const wasteByIngredient = new Map<string, { name: string; unit: string; quantity: number; cost: number }>();
  let wasteCost = 0;
  periodMovements
    .filter((m) => m.type === 'waste')
    .forEach((m) => {
      const ing = inventoryById.get(m.itemId);
      const cost = (ing?.costPerUnit ?? 0) * m.quantity;
      wasteCost += cost;
      const entry = wasteByIngredient.get(m.itemId) ?? {
        name: ing?.name ?? 'Unknown ingredient',
        unit: ing?.unit ?? '',
        quantity: 0,
        cost: 0,
      };
      entry.quantity += m.quantity;
      entry.cost += cost;
      wasteByIngredient.set(m.itemId, entry);
    });
  const topWaste = Array.from(wasteByIngredient.values())
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 6);

  const proration = PERIOD_DAYS[period] / 7;
  const laborCost = appSettings.weeklyLaborCost * proration;
  const operatingCost = appSettings.weeklyOperatingCosts * proration;
  const netProfit = revenue - cogs - laborCost - operatingCost;

  const staffOrdersValue = staffOrders.reduce((sum, o) => sum + o.total, 0);
  const cancelledValue = cancelledOrders.reduce((sum, o) => sum + o.total, 0);

  const recipeCostsByItem = new Map<string, RecipeCostRow[]>();
  recipeCosts.forEach((r) => {
    const list = recipeCostsByItem.get(r.menuItemId) ?? [];
    list.push(r);
    recipeCostsByItem.set(r.menuItemId, list);
  });

  const menuEngineering = menuItems
    .map((item) => {
      const qty = dishStats.get(item.id)?.qty ?? 0;
      const rows = recipeCostsByItem.get(item.id) ?? [];
      const defaultProtein = item.proteinOptions?.[0];
      const cost = rows
        .filter(
          (r) =>
            r.triggerType === 'base' ||
            r.triggerType === 'rice_scoop' ||
            (r.triggerType === 'protein' && r.triggerValue === defaultProtein)
        )
        .reduce((sum, r) => sum + (r.costPerUnit ?? 0) * r.quantity, 0);
      return { item, qty, margin: item.price - cost, hasRecipe: rows.length > 0 };
    })
    .filter((r) => r.qty > 0);

  const medPop = median(menuEngineering.map((r) => r.qty));
  const medMargin = median(menuEngineering.map((r) => r.margin));
  const quadrantOf = (qty: number, margin: number): MenuQuadrant => {
    const popular = qty >= medPop;
    const profitable = margin >= medMargin;
    if (popular && profitable) return 'Star';
    if (popular && !profitable) return 'Plowhorse';
    if (!popular && profitable) return 'Puzzle';
    return 'Dog';
  };
  const menuEngineeringRows = menuEngineering
    .map((r) => ({ ...r, quadrant: quadrantOf(r.qty, r.margin) }))
    .sort((a, b) => b.qty - a.qty);
  const missingRecipeCount = menuEngineeringRows.filter((r) => !r.hasRecipe).length;

  const exportSalesCsv = () => {
    if (typeof document === 'undefined') return;
    const rows = [
      ['Date', 'Order ID', 'Address', 'Payment method', 'Source', 'Total (EUR)'],
      ...revenueOrders.map((o) => [
        new Date(o.placedAt).toLocaleString(),
        o.id,
        o.fulfillment.address ?? '',
        o.paymentMethod,
        o.source,
        o.total.toFixed(2),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planetary-eats-sales-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ScrollView contentContainerStyle={styles.sectionContent}>
      <View style={styles.privateBanner}>
        <Text style={styles.privateBannerText}>
          📊 Internal only — the business's own numbers, never shown to customers.
        </Text>
      </View>

      <View style={styles.tabRow}>
        {(Object.keys(PERIOD_LABELS) as DashboardPeriod[]).map((p) => (
          <Pressable key={p} style={[styles.tab, period === p && styles.tabActive]} onPress={() => setPeriod(p)}>
            <Text style={[styles.tabText, period === p && styles.tabTextActive]}>{PERIOD_LABELS[p]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={typography.label}>SALES & EXECUTIVE SUMMARY</Text>
      <View style={styles.statRow}>
        <Text style={typography.body}>Revenue</Text>
        <Text style={typography.bodyMuted}>{formatPrice(revenue)}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={typography.body}>Orders</Text>
        <Text style={typography.bodyMuted}>{orderCount}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={typography.body}>Average order value</Text>
        <Text style={typography.bodyMuted}>{formatPrice(aov)}</Text>
      </View>

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>TOP DISHES</Text>
      {topDishes.length === 0 && <Text style={typography.bodyMuted}>No sales in this period yet.</Text>}
      {topDishes.map((d) => (
        <View key={d.name} style={styles.statRow}>
          <Text style={[typography.body, { flex: 1 }]}>{d.name}</Text>
          <Text style={typography.bodyMuted}>
            {d.qty}× · {formatPrice(d.revenue)}
          </Text>
        </View>
      ))}

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
        PROFIT &amp; LOSS
      </Text>
      <Text style={[typography.bodyMuted, { fontSize: 11, marginBottom: spacing.sm }]}>
        Cost of goods is what was actually logged as "used" in Inventory during this period; labor and other
        operating costs are prorated from the weekly figures in Settings → Operations.
      </Text>
      <View style={styles.statRow}>
        <Text style={typography.body}>Revenue</Text>
        <Text style={typography.bodyMuted}>{formatPrice(revenue)}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={typography.body}>− Cost of goods (ingredients used)</Text>
        <Text style={typography.bodyMuted}>{formatPrice(cogs)}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={typography.body}>− Labor</Text>
        <Text style={typography.bodyMuted}>{formatPrice(laborCost)}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={typography.body}>− Other operating costs</Text>
        <Text style={typography.bodyMuted}>{formatPrice(operatingCost)}</Text>
      </View>
      <View style={[styles.statRow, { marginTop: spacing.xs }]}>
        <Text style={[typography.body, { fontWeight: '700' }]}>Net profit</Text>
        <Text style={{ fontWeight: '700', color: netProfit < 0 ? colors.danger : colors.forest }}>
          {formatPrice(netProfit)}
        </Text>
      </View>

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>MENU ENGINEERING</Text>
      <Text style={[typography.bodyMuted, { fontSize: 11, marginBottom: spacing.sm }]}>
        Stars sell well and pay well; Plowhorses sell well on thin margin; Puzzles are profitable but rarely
        ordered; Dogs do neither.
        {missingRecipeCount > 0
          ? ` ${missingRecipeCount} of the dishes below have no recipe defined yet — their margin shows as full price until you set one up in Recipes.`
          : ''}
      </Text>
      {menuEngineeringRows.length === 0 && <Text style={typography.bodyMuted}>No sales in this period yet.</Text>}
      {menuEngineeringRows.length > 0 && (
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>Dish</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>Sold</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>Margin</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>Type</Text>
        </View>
      )}
      {menuEngineeringRows.map((r) => (
        <View key={r.item.id} style={styles.tableRow}>
          <Text style={styles.tableCell}>{r.item.name}</Text>
          <Text style={styles.tableCell}>{r.qty}</Text>
          <Text style={[styles.tableCell, { color: r.margin < 0 ? colors.danger : colors.ink }]}>
            {formatPrice(r.margin)}
          </Text>
          <Text style={styles.tableCell}>{r.quadrant}</Text>
        </View>
      ))}

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>WASTE</Text>
      <View style={styles.statRow}>
        <Text style={typography.body}>Total waste cost</Text>
        <Text style={typography.bodyMuted}>{formatPrice(wasteCost)}</Text>
      </View>
      {topWaste.map((w) => (
        <View key={w.name} style={styles.statRow}>
          <Text style={[typography.body, { flex: 1 }]}>{w.name}</Text>
          <Text style={typography.bodyMuted}>
            {formatQty(w.quantity)} {w.unit} · {formatPrice(w.cost)}
          </Text>
        </View>
      ))}
      {topWaste.length === 0 && <Text style={typography.bodyMuted}>Nothing logged as waste this period.</Text>}

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
        CANCELLED / RETURNED ORDERS
      </Text>
      <View style={styles.statRow}>
        <Text style={typography.body}>Count</Text>
        <Text style={typography.bodyMuted}>{cancelledOrders.length}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={typography.body}>Value</Text>
        <Text style={typography.bodyMuted}>{formatPrice(cancelledValue)}</Text>
      </View>
      <Text style={[typography.bodyMuted, { fontSize: 11 }]}>
        Cancel or mark an order returned from the Orders tab — it shows up here automatically.
      </Text>

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
        EMPLOYEE / PERSONAL ORDERS
      </Text>
      <View style={styles.statRow}>
        <Text style={typography.body}>Count</Text>
        <Text style={typography.bodyMuted}>{staffOrders.length}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={typography.body}>Value given</Text>
        <Text style={typography.bodyMuted}>{formatPrice(staffOrdersValue)}</Text>
      </View>
      <Text style={[typography.bodyMuted, { fontSize: 11 }]}>
        Log one from Orders → "Log an order" with source "Staff" — excluded from revenue and shown here instead.
      </Text>

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
        SALES EXPORT
      </Text>
      <Text style={typography.bodyMuted}>
        A CSV of this period's revenue orders, for importing into your accounting software (Lexoffice, sevDesk,
        DATEV or similar all accept a plain CSV) — a direct live API connection needs picking a provider and its
        API key, which is a decision (and credential) only you can make.
      </Text>
      <Pressable style={styles.saveButton} onPress={exportSalesCsv}>
        <Text style={styles.saveButtonText}>Export {PERIOD_LABELS[period].toLowerCase()}'s sales (CSV)</Text>
      </Pressable>
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
  cancelledTag: {
    color: colors.danger,
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
  restockAmount: {
    fontWeight: '700',
    fontSize: 13,
    color: colors.danger,
    marginLeft: spacing.sm,
  },
  lowBadge: {
    backgroundColor: colors.danger,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: spacing.sm,
  },
  lowBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  stockEditor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stockInput: {
    width: 64,
    marginTop: 0,
    textAlign: 'right',
    paddingVertical: 6,
  },
  unitLabel: {
    fontSize: 12,
    color: colors.inkMuted,
    fontWeight: '600',
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
