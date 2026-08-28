// Central app state: cart (in-memory) + order history (real, backed by Supabase).
// Cart intentionally stays client-only — there's no reason to persist an
// in-progress cart server-side. Orders are real rows tied to the signed-in
// user; placing one requires being logged in (enforced in checkout.tsx).

import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { AddOn, MenuItem, Nutrition, Origin, rowToMenuItem } from '../data/menu';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import {
  DEFAULT_RESTAURANT,
  distanceKm,
  geocodeAddress,
  DEFAULT_DELIVERY_RADIUS_KM,
  extractPostcode,
} from '../lib/delivery';
import { OpeningHours } from '../lib/openingHours';

const DEFAULT_OPENING_HOURS: OpeningHours = {
  mon: { open: '11:00', close: '21:30', closed: false },
  tue: { open: '11:00', close: '21:30', closed: false },
  wed: { open: '11:00', close: '21:30', closed: false },
  thu: { open: '11:00', close: '21:30', closed: false },
  fri: { open: '11:00', close: '21:30', closed: false },
  sat: { open: '12:00', close: '21:30', closed: false },
  sun: { open: '12:00', close: '21:00', closed: false },
};

export interface CartLine {
  lineId: string;
  item: MenuItem;
  quantity: number;
  selectedProtein?: string;
  selectedAddOnIds: string[];
  riceScoops?: number; // "build your bowl" base portion, 1-3 — a preference, not priced
}

export type OrderStatus = 'placed' | 'preparing' | 'out_for_delivery' | 'delivered';

export interface FulfillmentDetails {
  method: 'delivery' | 'pickup';
  address?: string;
  lat?: number; // delivery only — resolved during the address check, saved for analytics (heat map)
  long?: number;
}

export interface Order {
  id: string;
  userId: string | null; // null for admin-logged manual orders (Lieferando, phone, walk-in)
  lines: CartLine[];
  total: number;
  status: OrderStatus;
  fulfillment: FulfillmentDetails;
  paymentMethod: string;
  placedAt: string; // ISO timestamp
  source: string; // 'website' (default) | 'lieferando' | 'phone' | 'walk-in' | ...
}

// A single thing the customer ate that didn't come from a Planetary Eats
// order — their own private log, never visible to the business.
export interface NutritionEntry {
  id: string;
  label: string;
  calories: number;
  protein: number;
  fiber: number;
}

export interface NutritionGoals {
  calories: number | null;
  protein: number | null;
}

// What the admin's "log an order" form submits — no customer account, so
// no cart lines, just what's needed for records and the heat map.
export interface ManualOrderInput {
  total: number;
  address: string;
  lat?: number;
  long?: number;
  source: string;
  placedAt: string; // ISO timestamp
}

export type DeliveryCheckStatus = 'idle' | 'checking' | 'ok' | 'too-far' | 'not-found' | 'closed-area';

export interface AppSettings {
  restaurantName: string;
  restaurantLat: number;
  restaurantLong: number;
  deliveryRadiusKm: number;
  closedPostcodes: string[];
  openingHours: OpeningHours;
  minimumOrderValue: number;
  promoCode: string; // '' disables the promo code field entirely
  promoDiscount: number; // fraction, e.g. 0.1 = 10% off
}

export interface AdminProfile {
  id: string;
  email: string;
  isAdmin: boolean;
  banned: boolean;
  createdAt: string;
  birthYear: number | null;
}

// Everything a MenuItem has, plus the admin-only bookkeeping fields the
// customer-facing type doesn't need: the raw uploaded-photo URL (MenuItem
// only ever exposes the already-resolved `dishImage`), whether it's
// visible to customers, and its position in the list.
export interface AdminMenuItem extends MenuItem {
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

// Kitchen inventory — admin-only stock tracking. Par-level model: par_level
// is the target stock when fully stocked, reorder_threshold is the point
// below which it's flagged as running low.
export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  parLevel: number;
  reorderThreshold: number;
  notes: string | null;
  updatedAt: string;
}

export interface InventoryItemInput {
  id?: string; // present -> update, absent -> insert
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  parLevel: number;
  reorderThreshold: number;
  notes: string | null;
}

// A logged stock change — what actually moved, not just the running total.
// 'used' and 'waste' are kept separate so waste is visible on its own, and
// both feed the "next week" usage-rate estimate; 'restock' doesn't (a
// delivery isn't a sign you'll need more, it's why you won't).
export interface InventoryMovement {
  id: string;
  itemId: string;
  type: 'restock' | 'used' | 'waste';
  quantity: number;
  note: string | null;
  createdAt: string;
}

// What the editor form actually submits — a plain, JSON-shaped version of
// AdminMenuItem's editable fields (no dishImage — that's derived, never
// written directly).
export interface MenuItemInput {
  id: string;
  name: string;
  description: string;
  price: number;
  category: MenuItem['category'];
  emoji: string;
  imageUrl: string | null;
  tags: string[];
  allergens: string[];
  ingredients: string | null;
  proteinOptions: string[] | null;
  addOns: AddOn[] | null;
  origin: Origin | null;
  nutrition: Nutrition | null;
  groupId: string | null;
  groupLabel: string | null;
  isActive: boolean;
  sortOrder: number;
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  restaurantName: DEFAULT_RESTAURANT.name,
  restaurantLat: DEFAULT_RESTAURANT.lat,
  restaurantLong: DEFAULT_RESTAURANT.long,
  deliveryRadiusKm: DEFAULT_DELIVERY_RADIUS_KM,
  closedPostcodes: [],
  openingHours: DEFAULT_OPENING_HOURS,
  minimumOrderValue: 0,
  promoCode: 'WORLD10',
  promoDiscount: 0.1,
};

interface StoreState {
  cart: CartLine[];
  orders: Order[];
  ordersLoading: boolean;
  fulfillmentMethod: 'delivery' | 'pickup';
  deliveryAddress: string;
  deliveryCoords: { lat: number; long: number } | null;
  deliveryCheckStatus: DeliveryCheckStatus;
  deliveryDistanceKm: number | null;
  appSettings: AppSettings;
}

type StoreAction =
  | {
      type: 'ADD_TO_CART';
      item: MenuItem;
      quantity: number;
      selectedProtein?: string;
      selectedAddOnIds: string[];
      riceScoops?: number;
    }
  | { type: 'UPDATE_QUANTITY'; lineId: string; quantity: number }
  | { type: 'REMOVE_FROM_CART'; lineId: string }
  | { type: 'CLEAR_CART' }
  | { type: 'PREPEND_ORDER'; order: Order }
  | { type: 'SET_ORDERS'; orders: Order[] }
  | { type: 'SET_ORDERS_LOADING'; loading: boolean }
  | { type: 'SET_ORDER_STATUS'; orderId: string; status: OrderStatus }
  | { type: 'SET_FULFILLMENT_METHOD'; method: 'delivery' | 'pickup' }
  | { type: 'SET_DELIVERY_ADDRESS_TEXT'; address: string }
  | {
      type: 'SET_DELIVERY_CHECK_RESULT';
      address: string;
      coords: { lat: number; long: number } | null;
      status: DeliveryCheckStatus;
      distanceKm: number | null;
    }
  | { type: 'SET_DELIVERY_CHECKING' }
  | { type: 'SET_APP_SETTINGS'; settings: AppSettings };

const DELIVERY_FEE = 2.99;

const initialState: StoreState = {
  cart: [],
  orders: [],
  ordersLoading: false,
  fulfillmentMethod: 'delivery',
  deliveryAddress: '',
  deliveryCoords: null,
  deliveryCheckStatus: 'idle',
  deliveryDistanceKm: null,
  appSettings: DEFAULT_APP_SETTINGS,
};

const STATUS_SEQUENCE: OrderStatus[] = ['placed', 'preparing', 'out_for_delivery', 'delivered'];

// Two lines are "the same" if they're the same item with the same
// customization — that's what should merge quantities instead of creating
// a second line.
function lineKey(
  itemId: string,
  selectedProtein: string | undefined,
  selectedAddOnIds: string[],
  riceScoops: number | undefined
): string {
  return [itemId, selectedProtein ?? '', [...selectedAddOnIds].sort().join(','), riceScoops ?? ''].join('|');
}

export function lineUnitPrice(line: Pick<CartLine, 'item' | 'selectedAddOnIds'>): number {
  const addOnsTotal = (line.item.addOns ?? [])
    .filter((addOn) => line.selectedAddOnIds.includes(addOn.id))
    .reduce((sum, addOn) => sum + addOn.price, 0);
  return line.item.price + addOnsTotal;
}

function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + lineUnitPrice(line) * line.quantity, 0);
}

function storeReducer(state: StoreState, action: StoreAction): StoreState {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const key = lineKey(action.item.id, action.selectedProtein, action.selectedAddOnIds, action.riceScoops);
      const existing = state.cart.find(
        (line) => lineKey(line.item.id, line.selectedProtein, line.selectedAddOnIds, line.riceScoops) === key
      );
      const cart = existing
        ? state.cart.map((line) =>
            line.lineId === existing.lineId ? { ...line, quantity: line.quantity + action.quantity } : line
          )
        : [
            ...state.cart,
            {
              lineId: `${action.item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              item: action.item,
              quantity: action.quantity,
              selectedProtein: action.selectedProtein,
              selectedAddOnIds: action.selectedAddOnIds,
              riceScoops: action.riceScoops,
            },
          ];
      return { ...state, cart };
    }
    case 'UPDATE_QUANTITY': {
      const cart = state.cart
        .map((line) => (line.lineId === action.lineId ? { ...line, quantity: action.quantity } : line))
        .filter((line) => line.quantity > 0);
      return { ...state, cart };
    }
    case 'REMOVE_FROM_CART':
      return { ...state, cart: state.cart.filter((line) => line.lineId !== action.lineId) };
    case 'CLEAR_CART':
      return { ...state, cart: [] };
    case 'PREPEND_ORDER':
      return { ...state, cart: [], orders: [action.order, ...state.orders] };
    case 'SET_ORDERS':
      return { ...state, orders: action.orders, ordersLoading: false };
    case 'SET_ORDERS_LOADING':
      return { ...state, ordersLoading: action.loading };
    case 'SET_ORDER_STATUS': {
      const orders = state.orders.map((order) =>
        order.id === action.orderId ? { ...order, status: action.status } : order
      );
      return { ...state, orders };
    }
    case 'SET_FULFILLMENT_METHOD':
      return { ...state, fulfillmentMethod: action.method };
    case 'SET_DELIVERY_ADDRESS_TEXT':
      return { ...state, deliveryAddress: action.address, deliveryCheckStatus: 'idle', deliveryDistanceKm: null };
    case 'SET_DELIVERY_CHECKING':
      return { ...state, deliveryCheckStatus: 'checking' };
    case 'SET_DELIVERY_CHECK_RESULT':
      return {
        ...state,
        deliveryAddress: action.address,
        deliveryCoords: action.coords,
        deliveryCheckStatus: action.status,
        deliveryDistanceKm: action.distanceKm,
      };
    case 'SET_APP_SETTINGS':
      return { ...state, appSettings: action.settings };
    default:
      return state;
  }
}

interface StoreContextValue extends StoreState {
  addToCart: (
    item: MenuItem,
    quantity?: number,
    selectedProtein?: string,
    selectedAddOnIds?: string[],
    riceScoops?: number
  ) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeFromCart: (lineId: string) => void;
  clearCart: () => void;
  placeOrder: (fulfillment: FulfillmentDetails, paymentMethod: string) => Promise<Order | null>;
  logManualOrder: (input: ManualOrderInput) => Promise<{ error: string | null }>;
  advanceOrderStatus: (orderId: string) => void;
  cartSubtotal: number;
  cartCount: number;
  deliveryFee: number;
  setFulfillmentMethod: (method: 'delivery' | 'pickup') => void;
  setDeliveryAddressText: (address: string) => void;
  checkDeliveryAddress: (address: string) => Promise<void>;
  // Admin-only — each of these relies on Supabase RLS to actually restrict
  // access; a non-admin calling them just gets an empty/error result back.
  updateAppSettings: (
    changes: Partial<
      Pick<
        AppSettings,
        | 'deliveryRadiusKm'
        | 'closedPostcodes'
        | 'restaurantName'
        | 'openingHours'
        | 'minimumOrderValue'
        | 'promoCode'
        | 'promoDiscount'
      >
    >
  ) => Promise<{ error: string | null }>;
  fetchAllOrders: () => Promise<Order[]>;
  fetchAllProfiles: () => Promise<AdminProfile[]>;
  setUserBanned: (userId: string, banned: boolean) => Promise<{ error: string | null }>;
  setUserAdmin: (userId: string, isAdmin: boolean) => Promise<{ error: string | null }>;
  setUserAdminByEmail: (email: string, isAdmin: boolean) => Promise<{ error: string | null }>;
  fetchAllMenuItemsAdmin: () => Promise<AdminMenuItem[]>;
  upsertMenuItem: (input: MenuItemInput) => Promise<{ error: string | null }>;
  setMenuItemActive: (id: string, active: boolean) => Promise<{ error: string | null }>;
  deleteMenuItem: (id: string) => Promise<{ error: string | null }>;
  uploadDishPhoto: (file: File) => Promise<{ url: string | null; error: string | null }>;
  fetchChecklistState: () => Promise<Record<string, boolean>>;
  setChecklistItem: (itemId: string, done: boolean) => Promise<{ error: string | null }>;
  fetchInventoryItems: () => Promise<InventoryItem[]>;
  upsertInventoryItem: (input: InventoryItemInput) => Promise<{ error: string | null }>;
  setInventoryStock: (id: string, currentStock: number) => Promise<{ error: string | null }>;
  deleteInventoryItem: (id: string) => Promise<{ error: string | null }>;
  fetchInventoryMovements: () => Promise<InventoryMovement[]>;
  logInventoryMovement: (
    itemId: string,
    type: InventoryMovement['type'],
    quantity: number,
    currentStock: number,
    note?: string
  ) => Promise<{ error: string | null }>;
  // Customer's own private nutrition tracking — scoped to the signed-in
  // user by RLS; the business never reads these.
  fetchNutritionLog: (isoDate: string) => Promise<NutritionEntry[]>;
  addNutritionEntry: (
    isoDate: string,
    entry: Omit<NutritionEntry, 'id'>
  ) => Promise<{ error: string | null }>;
  deleteNutritionEntry: (id: string) => Promise<{ error: string | null }>;
  fetchNutritionGoals: () => Promise<NutritionGoals>;
  updateNutritionGoals: (goals: NutritionGoals) => Promise<{ error: string | null }>;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

function rowToOrder(row: any): Order {
  return {
    id: row.id,
    userId: row.user_id,
    lines: row.lines,
    total: Number(row.total),
    status: row.status,
    fulfillment: row.fulfillment,
    paymentMethod: row.payment_method,
    placedAt: row.placed_at,
    source: row.source ?? 'website',
  };
}

function rowToAdminProfile(row: any): AdminProfile {
  return {
    id: row.id,
    email: row.email ?? '(no email)',
    isAdmin: Boolean(row.is_admin),
    banned: Boolean(row.banned),
    createdAt: row.created_at,
    birthYear: row.birth_year ?? null,
  };
}

function rowToAdminMenuItem(row: any): AdminMenuItem {
  return {
    ...rowToMenuItem(row),
    imageUrl: row.image_url ?? null,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

function rowToInventoryItem(row: any): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    currentStock: Number(row.current_stock),
    parLevel: Number(row.par_level),
    reorderThreshold: Number(row.reorder_threshold),
    notes: row.notes ?? null,
    updatedAt: row.updated_at,
  };
}

function rowToInventoryMovement(row: any): InventoryMovement {
  return {
    id: row.id,
    itemId: row.item_id,
    type: row.type,
    quantity: Number(row.quantity),
    note: row.note ?? null,
    createdAt: row.created_at,
  };
}

function menuItemInputToRow(input: MenuItemInput) {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    price: input.price,
    category: input.category,
    emoji: input.emoji,
    image_url: input.imageUrl,
    tags: input.tags,
    allergens: input.allergens,
    ingredients: input.ingredients,
    protein_options: input.proteinOptions,
    add_ons: input.addOns,
    origin: input.origin,
    nutrition: input.nutrition,
    group_id: input.groupId,
    group_label: input.groupLabel,
    is_active: input.isActive,
    sort_order: input.sortOrder,
  };
}

const DELIVERY_STORAGE_KEY = 'pe_fulfillment_v1';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(storeReducer, initialState);
  const { user } = useAuth();

  // Hydrate the last-used delivery address/method from localStorage — web
  // only, and only after mount, since the static export pre-renders this
  // component in Node where `window` doesn't exist.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(DELIVERY_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        fulfillmentMethod?: 'delivery' | 'pickup';
        deliveryAddress?: string;
        deliveryCoords?: { lat: number; long: number } | null;
      };
      if (saved.fulfillmentMethod) {
        dispatch({ type: 'SET_FULFILLMENT_METHOD', method: saved.fulfillmentMethod });
      }
      if (saved.deliveryAddress && saved.deliveryCoords) {
        // Coordinates are already known — recompute distance locally
        // instead of re-geocoding on every reload. Uses today's default
        // radius; if admin settings haven't loaded yet this can be off by
        // whatever the admin changed it to, corrected as soon as they
        // re-check — this is a UX convenience check, not a security gate.
        const km = distanceKm(
          DEFAULT_RESTAURANT.lat,
          DEFAULT_RESTAURANT.long,
          saved.deliveryCoords.lat,
          saved.deliveryCoords.long
        );
        dispatch({
          type: 'SET_DELIVERY_CHECK_RESULT',
          address: saved.deliveryAddress,
          coords: saved.deliveryCoords,
          status: km <= DEFAULT_DELIVERY_RADIUS_KM ? 'ok' : 'too-far',
          distanceKm: km,
        });
      }
    } catch {
      // corrupt/blocked storage — just start fresh
    }
  }, []);

  // Load admin-editable settings (delivery radius, restaurant location,
  // closed postcodes) — public SELECT via RLS, no auth required.
  useEffect(() => {
    supabase
      .from('app_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        dispatch({
          type: 'SET_APP_SETTINGS',
          settings: {
            restaurantName: data.restaurant_name,
            restaurantLat: Number(data.restaurant_lat),
            restaurantLong: Number(data.restaurant_long),
            deliveryRadiusKm: Number(data.delivery_radius_km),
            closedPostcodes: data.closed_postcodes ?? [],
            openingHours: data.opening_hours ?? DEFAULT_OPENING_HOURS,
            minimumOrderValue: Number(data.minimum_order_value ?? 0),
            promoCode: data.promo_code ?? 'WORLD10',
            promoDiscount: Number(data.promo_discount ?? 0.1),
          },
        });
      });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        DELIVERY_STORAGE_KEY,
        JSON.stringify({
          fulfillmentMethod: state.fulfillmentMethod,
          deliveryAddress: state.deliveryAddress,
          deliveryCoords: state.deliveryCoords,
        })
      );
    } catch {
      // ignore — private browsing / storage full, not worth failing over
    }
  }, [state.fulfillmentMethod, state.deliveryAddress, state.deliveryCoords]);

  useEffect(() => {
    if (!user) {
      dispatch({ type: 'SET_ORDERS', orders: [] });
      return;
    }
    dispatch({ type: 'SET_ORDERS_LOADING', loading: true });
    supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('placed_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          dispatch({ type: 'SET_ORDERS', orders: data.map(rowToOrder) });
        } else {
          dispatch({ type: 'SET_ORDERS_LOADING', loading: false });
        }
      });
  }, [user]);

  const value = useMemo<StoreContextValue>(() => {
    return {
      ...state,
      addToCart: (item, quantity = 1, selectedProtein, selectedAddOnIds = [], riceScoops) =>
        dispatch({ type: 'ADD_TO_CART', item, quantity, selectedProtein, selectedAddOnIds, riceScoops }),
      updateQuantity: (lineId, quantity) => dispatch({ type: 'UPDATE_QUANTITY', lineId, quantity }),
      removeFromCart: (lineId) => dispatch({ type: 'REMOVE_FROM_CART', lineId }),
      clearCart: () => dispatch({ type: 'CLEAR_CART' }),
      placeOrder: async (fulfillment, paymentMethod) => {
        if (state.cart.length === 0 || !user) return null;
        const order: Order = {
          id: `PE-${Math.floor(100000 + Math.random() * 900000)}`,
          userId: user.id,
          lines: state.cart,
          total: cartTotal(state.cart) + (fulfillment.method === 'delivery' ? DELIVERY_FEE : 0),
          status: 'placed',
          fulfillment,
          paymentMethod,
          placedAt: new Date().toISOString(),
          source: 'website',
        };
        const { error } = await supabase.from('orders').insert({
          id: order.id,
          user_id: user.id,
          lines: order.lines,
          total: order.total,
          status: order.status,
          fulfillment: order.fulfillment,
          payment_method: order.paymentMethod,
          placed_at: order.placedAt,
          source: order.source,
        });
        if (error) return null;
        dispatch({ type: 'PREPEND_ORDER', order });
        return order;
      },
      logManualOrder: async (input) => {
        const id = `PE-M-${Math.floor(100000 + Math.random() * 900000)}`;
        const { error } = await supabase.from('orders').insert({
          id,
          user_id: null,
          lines: [],
          total: input.total,
          status: 'delivered',
          fulfillment: {
            method: 'delivery',
            address: input.address,
            lat: input.lat,
            long: input.long,
          },
          payment_method: 'n/a',
          placed_at: input.placedAt,
          source: input.source,
        });
        return { error: error?.message ?? null };
      },
      advanceOrderStatus: (orderId) => {
        const order = state.orders.find((o) => o.id === orderId);
        if (!order) return;
        const nextIndex = Math.min(STATUS_SEQUENCE.indexOf(order.status) + 1, STATUS_SEQUENCE.length - 1);
        const nextStatus = STATUS_SEQUENCE[nextIndex];
        dispatch({ type: 'SET_ORDER_STATUS', orderId, status: nextStatus });
        supabase.from('orders').update({ status: nextStatus }).eq('id', orderId).then();
      },
      cartSubtotal: cartTotal(state.cart),
      cartCount: state.cart.reduce((sum, line) => sum + line.quantity, 0),
      deliveryFee: DELIVERY_FEE,
      setFulfillmentMethod: (method) => dispatch({ type: 'SET_FULFILLMENT_METHOD', method }),
      setDeliveryAddressText: (address) => dispatch({ type: 'SET_DELIVERY_ADDRESS_TEXT', address }),
      checkDeliveryAddress: async (address) => {
        const trimmed = address.trim();
        if (!trimmed) return;
        dispatch({ type: 'SET_DELIVERY_CHECKING' });
        const result = await geocodeAddress(trimmed);
        if (!result) {
          dispatch({ type: 'SET_DELIVERY_CHECK_RESULT', address: trimmed, coords: null, status: 'not-found', distanceKm: null });
          return;
        }
        const { restaurantLat, restaurantLong, deliveryRadiusKm, closedPostcodes } = state.appSettings;
        const km = distanceKm(restaurantLat, restaurantLong, result.lat, result.long);
        const postcode = extractPostcode(result.placeName);
        const isClosedArea = Boolean(postcode && closedPostcodes.includes(postcode));
        dispatch({
          type: 'SET_DELIVERY_CHECK_RESULT',
          address: trimmed,
          coords: { lat: result.lat, long: result.long },
          status: isClosedArea ? 'closed-area' : km <= deliveryRadiusKm ? 'ok' : 'too-far',
          distanceKm: km,
        });
      },
      updateAppSettings: async (changes) => {
        const payload: Record<string, unknown> = {};
        if (changes.deliveryRadiusKm !== undefined) payload.delivery_radius_km = changes.deliveryRadiusKm;
        if (changes.closedPostcodes !== undefined) payload.closed_postcodes = changes.closedPostcodes;
        if (changes.restaurantName !== undefined) payload.restaurant_name = changes.restaurantName;
        if (changes.openingHours !== undefined) payload.opening_hours = changes.openingHours;
        if (changes.minimumOrderValue !== undefined) payload.minimum_order_value = changes.minimumOrderValue;
        if (changes.promoCode !== undefined) payload.promo_code = changes.promoCode;
        if (changes.promoDiscount !== undefined) payload.promo_discount = changes.promoDiscount;
        const { error } = await supabase.from('app_settings').update(payload).eq('id', 1);
        if (error) return { error: error.message };
        dispatch({ type: 'SET_APP_SETTINGS', settings: { ...state.appSettings, ...changes } });
        return { error: null };
      },
      fetchAllOrders: async () => {
        const { data, error } = await supabase.from('orders').select('*').order('placed_at', { ascending: false });
        if (error || !data) return [];
        return data.map(rowToOrder);
      },
      fetchAllProfiles: async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });
        if (error || !data) return [];
        return data.map(rowToAdminProfile);
      },
      setUserBanned: async (userId, banned) => {
        const { error } = await supabase.from('profiles').update({ banned }).eq('id', userId);
        return { error: error?.message ?? null };
      },
      setUserAdmin: async (userId, isAdminValue) => {
        const { error } = await supabase.from('profiles').update({ is_admin: isAdminValue }).eq('id', userId);
        return { error: error?.message ?? null };
      },
      setUserAdminByEmail: async (email, isAdminValue) => {
        const { data, error: findError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email.trim())
          .maybeSingle();
        if (findError) return { error: findError.message };
        if (!data) return { error: 'No account found with that email — they need to sign up first.' };
        const { error } = await supabase.from('profiles').update({ is_admin: isAdminValue }).eq('id', data.id);
        return { error: error?.message ?? null };
      },
      fetchAllMenuItemsAdmin: async () => {
        const { data, error } = await supabase
          .from('menu_items')
          .select('*')
          .order('sort_order', { ascending: true });
        if (error || !data) return [];
        return data.map(rowToAdminMenuItem);
      },
      upsertMenuItem: async (input) => {
        const { error } = await supabase.from('menu_items').upsert(menuItemInputToRow(input));
        return { error: error?.message ?? null };
      },
      setMenuItemActive: async (id, active) => {
        const { error } = await supabase.from('menu_items').update({ is_active: active }).eq('id', id);
        return { error: error?.message ?? null };
      },
      deleteMenuItem: async (id) => {
        const { error } = await supabase.from('menu_items').delete().eq('id', id);
        return { error: error?.message ?? null };
      },
      uploadDishPhoto: async (file) => {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from('dish-photos').upload(path, file, { upsert: false });
        if (error) return { url: null, error: error.message };
        const { data } = supabase.storage.from('dish-photos').getPublicUrl(path);
        return { url: data.publicUrl, error: null };
      },
      fetchChecklistState: async () => {
        const { data, error } = await supabase.from('launch_checklist').select('item_id, done');
        if (error || !data) return {};
        const map: Record<string, boolean> = {};
        data.forEach((row: any) => {
          map[row.item_id] = row.done;
        });
        return map;
      },
      setChecklistItem: async (itemId, done) => {
        const { error } = await supabase
          .from('launch_checklist')
          .upsert({ item_id: itemId, done, updated_at: new Date().toISOString() });
        return { error: error?.message ?? null };
      },
      fetchInventoryItems: async () => {
        const { data, error } = await supabase
          .from('inventory_items')
          .select('*')
          .order('category', { ascending: true })
          .order('name', { ascending: true });
        if (error || !data) return [];
        return data.map(rowToInventoryItem);
      },
      upsertInventoryItem: async (input) => {
        const payload = {
          name: input.name,
          category: input.category,
          unit: input.unit,
          current_stock: input.currentStock,
          par_level: input.parLevel,
          reorder_threshold: input.reorderThreshold,
          notes: input.notes,
          updated_at: new Date().toISOString(),
        };
        const { error } = input.id
          ? await supabase.from('inventory_items').update(payload).eq('id', input.id)
          : await supabase.from('inventory_items').insert(payload);
        return { error: error?.message ?? null };
      },
      setInventoryStock: async (id, currentStock) => {
        const { error } = await supabase
          .from('inventory_items')
          .update({ current_stock: currentStock, updated_at: new Date().toISOString() })
          .eq('id', id);
        return { error: error?.message ?? null };
      },
      deleteInventoryItem: async (id) => {
        const { error } = await supabase.from('inventory_items').delete().eq('id', id);
        return { error: error?.message ?? null };
      },
      fetchInventoryMovements: async () => {
        // 60 days covers "this week" plus the trailing-4-week average the
        // next-week estimate uses, without the table growing unbounded in
        // what the admin panel pulls down on every load.
        const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from('inventory_movements')
          .select('*')
          .gte('created_at', cutoff)
          .order('created_at', { ascending: false });
        if (error || !data) return [];
        return data.map(rowToInventoryMovement);
      },
      logInventoryMovement: async (itemId, type, quantity, currentStock, note) => {
        const { error: insertError } = await supabase.from('inventory_movements').insert({
          item_id: itemId,
          type,
          quantity,
          note: note?.trim() || null,
        });
        if (insertError) return { error: insertError.message };
        const delta = type === 'restock' ? quantity : -quantity;
        const newStock = Math.max(currentStock + delta, 0);
        const { error: updateError } = await supabase
          .from('inventory_items')
          .update({ current_stock: newStock, updated_at: new Date().toISOString() })
          .eq('id', itemId);
        return { error: updateError?.message ?? null };
      },
      fetchNutritionLog: async (isoDate) => {
        if (!user) return [];
        const { data, error } = await supabase
          .from('nutrition_log')
          .select('id, label, calories, protein, fiber')
          .eq('eaten_on', isoDate)
          .order('created_at', { ascending: true });
        if (error || !data) return [];
        return data.map((row: any) => ({
          id: row.id,
          label: row.label,
          calories: Number(row.calories),
          protein: Number(row.protein),
          fiber: Number(row.fiber),
        }));
      },
      addNutritionEntry: async (isoDate, entry) => {
        if (!user) return { error: 'Not signed in.' };
        const { error } = await supabase.from('nutrition_log').insert({
          user_id: user.id,
          label: entry.label,
          calories: entry.calories,
          protein: entry.protein,
          fiber: entry.fiber,
          eaten_on: isoDate,
        });
        return { error: error?.message ?? null };
      },
      deleteNutritionEntry: async (id) => {
        const { error } = await supabase.from('nutrition_log').delete().eq('id', id);
        return { error: error?.message ?? null };
      },
      fetchNutritionGoals: async () => {
        if (!user) return { calories: null, protein: null };
        const { data, error } = await supabase
          .from('profiles')
          .select('daily_calorie_goal, daily_protein_goal')
          .eq('id', user.id)
          .maybeSingle();
        if (error || !data) return { calories: null, protein: null };
        return { calories: data.daily_calorie_goal ?? null, protein: data.daily_protein_goal ?? null };
      },
      updateNutritionGoals: async (goals) => {
        if (!user) return { error: 'Not signed in.' };
        const { error } = await supabase
          .from('profiles')
          .update({ daily_calorie_goal: goals.calories, daily_protein_goal: goals.protein })
          .eq('id', user.id);
        return { error: error?.message ?? null };
      },
    };
  }, [state, user]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within a StoreProvider');
  return ctx;
}
