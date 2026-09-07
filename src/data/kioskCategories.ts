// Shared between app/kiosk.tsx and the admin's Kiosk Home editor.
//
// The shared `menu_items.category` column only has 3 values platform-wide
// (Bowls/Drinks/Desserts, used by the admin dashboard's math too), so all
// 70+ Zam Zam dishes (döner, burgers, pasta, salads...) live under one
// "Bowls" value. This is a kiosk-only, client-side re-bucketing (keyed off
// item id, since the real category can't change) into real categories for
// a McDonald's-style browsing UI. It has no effect on the admin dashboard
// or the regular site.
import { MenuItem } from './menu';

export interface KioskCategory {
  key: string;
  label: string;
  emoji: string;
  color: string;
}

export const KIOSK_CATEGORIES: KioskCategory[] = [
  { key: 'doner', label: 'Döner & Dürüm', emoji: '🥙', color: '#E8531F' },
  { key: 'chicken', label: 'Chicken', emoji: '🍗', color: '#E0951A' },
  { key: 'burgers', label: 'Burgers', emoji: '🍔', color: '#8B5A2B' },
  { key: 'wings', label: 'Wings & Nuggets', emoji: '🍤', color: '#D6401F' },
  { key: 'falafel', label: 'Falafel & Veggie', emoji: '🧆', color: '#6C9A34' },
  { key: 'pasta', label: 'Pasta', emoji: '🍝', color: '#D9A62B' },
  { key: 'salads', label: 'Salads', emoji: '🥗', color: '#3F9142' },
  { key: 'sides', label: 'Sides & Extras', emoji: '🍟', color: '#D98E1E' },
  { key: 'drinks', label: 'Drinks', emoji: '🥤', color: '#1F6FB2' },
  { key: 'desserts', label: 'Desserts', emoji: '🍰', color: '#C22568' },
];

export function kioskCategoryKey(item: MenuItem): string {
  const id = item.id;
  if (id.includes('insalata')) return 'salads';
  if (id.includes('pasta')) return 'pasta';
  if (id.includes('burger')) return 'burgers';
  if (id.includes('wings') || id.includes('nuggets')) return 'wings';
  if (id.includes('falafel')) return 'falafel';
  if (id.includes('drehspiess')) return 'doner';
  if (id.includes('schnitzel') || id.includes('haehnchen-menu') || id.includes('haehnchen') || id.includes('hahnchen')) return 'chicken';
  if (item.category === 'Drinks') return 'drinks';
  if (item.category === 'Desserts') return 'desserts';
  return 'sides';
}
