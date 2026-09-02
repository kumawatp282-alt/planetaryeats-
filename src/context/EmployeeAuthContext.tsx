// Kitchen-staff and rider "kiosk" login — a short code, not email/password,
// and NOT Supabase Auth (this browser has no `auth.uid()` at all). Every
// action goes through a `security definer` RPC in supabase/staff_schema.sql
// that re-derives authorization from a server-minted session token; this
// context is just a thin client around those calls, plus a localStorage
// cache of {token, employee} so a kiosk survives a page refresh.
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type EmployeeRole = 'kitchen' | 'rider';

export interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
}

export interface EmployeeShift {
  id: string;
  clockIn: string;
  clockOut: string | null;
}

// What a rider sees before claiming — no address/customer name yet.
export interface RiderOrderSummary {
  id: string;
  lat: number;
  long: number;
  total: number;
  placedAt: string;
}

// What a rider sees once they've claimed it — address included.
export interface RiderClaimedOrder {
  id: string;
  address: string;
  lat: number;
  long: number;
  total: number;
  pickedUpAt: string | null;
  placedAt: string;
}

export interface StaffOrderLine {
  item: { id: string; name: string; price: number };
  quantity: number;
}

const STORAGE_KEY = 'pe_employee_session_v1';

interface EmployeeAuthContextValue {
  employee: Employee | null;
  loading: boolean;
  login: (code: string) => Promise<{ error: string | null }>;
  logout: () => void;
  currentShift: EmployeeShift | null;
  refreshShift: () => Promise<void>;
  clockIn: () => Promise<{ error: string | null }>;
  clockOut: () => Promise<{ error: string | null }>;
  logStaffOrder: (lines: StaffOrderLine[], total: number) => Promise<{ error: string | null }>;
  riderAvailableOrders: () => Promise<RiderOrderSummary[]>;
  riderMyOrders: () => Promise<RiderClaimedOrder[]>;
  riderClaimOrder: (orderId: string) => Promise<{ error: string | null }>;
  riderMarkPickedUp: (orderId: string) => Promise<{ error: string | null }>;
  riderMarkDelivered: (orderId: string) => Promise<{ error: string | null }>;
}

const EmployeeAuthContext = createContext<EmployeeAuthContextValue | undefined>(undefined);

// The plaintext code never leaves this device unhashed except over TLS to
// this one RPC call — the server only ever stores/compares the hash.
export async function hashEmployeeCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function EmployeeAuthProvider({ children }: { children: React.ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentShift, setCurrentShift] = useState<EmployeeShift | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { token: string; employee: Employee };
        setToken(saved.token);
        setEmployee(saved.employee);
      }
    } catch {
      // corrupt/blocked storage — just start signed out
    }
    setLoading(false);
  }, []);

  const persist = (nextToken: string | null, nextEmployee: Employee | null) => {
    if (typeof window === 'undefined') return;
    if (nextToken && nextEmployee) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: nextToken, employee: nextEmployee }));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  const login = async (code: string) => {
    const { data, error } = await supabase.rpc('employee_login', { p_code: code.trim() });
    if (error || !data || data.length === 0) {
      return { error: error?.message ?? 'Invalid code.' };
    }
    const row = data[0];
    const nextEmployee: Employee = { id: row.employee_id, name: row.name, role: row.role };
    setToken(row.token);
    setEmployee(nextEmployee);
    persist(row.token, nextEmployee);
    return { error: null };
  };

  const logout = () => {
    if (token) supabase.rpc('employee_logout', { p_token: token }).then();
    setToken(null);
    setEmployee(null);
    setCurrentShift(null);
    persist(null, null);
  };

  const refreshShift = async () => {
    if (!token) return;
    const { data } = await supabase.rpc('employee_current_shift', { p_token: token });
    const row = Array.isArray(data) ? data[0] : data;
    setCurrentShift(row && row.id ? { id: row.id, clockIn: row.clock_in, clockOut: row.clock_out } : null);
  };

  const clockIn = async () => {
    if (!token) return { error: 'Not signed in.' };
    const { error } = await supabase.rpc('employee_clock_in', { p_token: token });
    if (!error) await refreshShift();
    return { error: error?.message ?? null };
  };

  const clockOut = async () => {
    if (!token) return { error: 'Not signed in.' };
    const { error } = await supabase.rpc('employee_clock_out', { p_token: token });
    if (!error) await refreshShift();
    return { error: error?.message ?? null };
  };

  const logStaffOrder = async (lines: StaffOrderLine[], total: number) => {
    if (!token) return { error: 'Not signed in.' };
    const { error } = await supabase.rpc('employee_log_staff_order', {
      p_token: token,
      p_lines: lines,
      p_total: total,
    });
    return { error: error?.message ?? null };
  };

  const riderAvailableOrders = async (): Promise<RiderOrderSummary[]> => {
    if (!token) return [];
    const { data, error } = await supabase.rpc('rider_available_orders', { p_token: token });
    if (error || !data) return [];
    return data.map((row: any) => ({
      id: row.id,
      lat: Number(row.lat),
      long: Number(row.long),
      total: Number(row.total),
      placedAt: row.placed_at,
    }));
  };

  const riderMyOrders = async (): Promise<RiderClaimedOrder[]> => {
    if (!token) return [];
    const { data, error } = await supabase.rpc('rider_my_orders', { p_token: token });
    if (error || !data) return [];
    return data.map((row: any) => ({
      id: row.id,
      address: row.address ?? '',
      lat: Number(row.lat),
      long: Number(row.long),
      total: Number(row.total),
      pickedUpAt: row.picked_up_at,
      placedAt: row.placed_at,
    }));
  };

  const riderClaimOrder = async (orderId: string) => {
    if (!token) return { error: 'Not signed in.' };
    const { error } = await supabase.rpc('rider_claim_order', { p_token: token, p_order_id: orderId });
    return { error: error?.message ?? null };
  };

  const riderMarkPickedUp = async (orderId: string) => {
    if (!token) return { error: 'Not signed in.' };
    const { error } = await supabase.rpc('rider_update_order', {
      p_token: token,
      p_order_id: orderId,
      p_event: 'picked_up',
    });
    return { error: error?.message ?? null };
  };

  const riderMarkDelivered = async (orderId: string) => {
    if (!token) return { error: 'Not signed in.' };
    const { error } = await supabase.rpc('rider_update_order', {
      p_token: token,
      p_order_id: orderId,
      p_event: 'delivered',
    });
    return { error: error?.message ?? null };
  };

  const value: EmployeeAuthContextValue = {
    employee,
    loading,
    login,
    logout,
    currentShift,
    refreshShift,
    clockIn,
    clockOut,
    logStaffOrder,
    riderAvailableOrders,
    riderMyOrders,
    riderClaimOrder,
    riderMarkPickedUp,
    riderMarkDelivered,
  };

  return <EmployeeAuthContext.Provider value={value}>{children}</EmployeeAuthContext.Provider>;
}

export function useEmployeeAuth(): EmployeeAuthContextValue {
  const ctx = useContext(EmployeeAuthContext);
  if (!ctx) throw new Error('useEmployeeAuth must be used within an EmployeeAuthProvider');
  return ctx;
}
