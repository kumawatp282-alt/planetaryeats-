// Planetary Eats menu — now admin-editable, backed by Supabase (see
// supabase/menu_schema.sql). `fetchMenu`/`getMenuItem` are the only two
// functions every screen reads through; the rest of the app never touches
// where the data actually comes from, which is what makes this swap safe.
//
// FALLBACK_MENU_ITEMS below is today's menu at the time this migration
// shipped — used only if the Supabase query fails, so the site never goes
// menu-less over a transient DB hiccup. It is not the source of truth.

import { supabase } from '../lib/supabase';
import { resolveDishImage } from '../lib/dishImages';

export type Category = 'Bowls' | 'Drinks' | 'Desserts';

export interface AddOn {
  id: string;
  name: string;
  price: number; // in EUR
}

export interface Origin {
  flag: string; // flag emoji
  country: string;
  landmark: string; // emoji fallback badge
  region: 'asia' | 'europe-africa' | 'americas';
  lat: number; // real coordinates — places the pin on the 3D globe
  long: number;
  history: string; // a real historical fact about the landmark/region
}

export interface Nutrition {
  calories: number; // kcal, with the default (first) protein option
  protein: number; // g
  fiber: number; // g
  carbs: number; // g
  fat: number; // g
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number; // in EUR
  category: Category;
  emoji: string; // stand-in for a product photo until real assets exist
  dishImage?: any; // real product photo — falls back to `emoji` when not set
  tags?: string[];
  allergens?: string[]; // admin-entered — see item page's Allergens section
  ingredients?: string; // short free-text description of what's inside
  proteinOptions?: string[]; // free choice included in the price; first is the default
  addOns?: AddOn[]; // paid extras
  origin?: Origin; // bowls only — powers the globe explorer on the home screen
  nutrition?: Nutrition; // PLACEHOLDER-CHECK: estimated, not lab-verified — swap for real values when available
  groupId?: string; // items served from the same outside stop — only the one with `origin` gets a globe pin; the rest are offered as choices inside that pin's pop-out
  groupLabel?: string; // shown above the choices, e.g. "Chili Döner Freising"
}

export const categories: Category[] = ['Bowls', 'Drinks', 'Desserts'];

export function rowToMenuItem(row: any): MenuItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    category: row.category,
    emoji: row.emoji,
    dishImage: resolveDishImage(row.id, row.image_url),
    tags: row.tags && row.tags.length > 0 ? row.tags : undefined,
    allergens: row.allergens && row.allergens.length > 0 ? row.allergens : undefined,
    ingredients: row.ingredients ?? undefined,
    proteinOptions: row.protein_options ?? undefined,
    addOns: row.add_ons ?? undefined,
    origin: row.origin ?? undefined,
    nutrition: row.nutrition ?? undefined,
    groupId: row.group_id ?? undefined,
    groupLabel: row.group_label ?? undefined,
  };
}

export async function fetchMenu(): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error || !data || data.length === 0) {
    return FALLBACK_MENU_ITEMS;
  }
  return data.map(rowToMenuItem);
}

export async function getMenuItem(id: string): Promise<MenuItem | undefined> {
  const { data, error } = await supabase.from('menu_items').select('*').eq('id', id).maybeSingle();
  if (error || !data) {
    return FALLBACK_MENU_ITEMS.find((item) => item.id === id);
  }
  return rowToMenuItem(data);
}

// "Make it yours" extras — same list under every bowl on the printed menu.
const BOWL_ADD_ONS: AddOn[] = [
  { id: 'extra-chicken', name: 'Extra Chicken', price: 3.5 },
  { id: 'extra-tofu', name: 'Extra Tofu', price: 3.0 },
  { id: 'extra-egg', name: 'Extra Egg', price: 1.5 },
  { id: 'extra-rice', name: 'Extra Rice', price: 2.0 },
  { id: 'extra-sauce', name: 'Extra Sauce', price: 1.5 },
];

const BOWL_PROTEIN_OPTIONS = ['Chicken', 'Tofu', 'Egg'];

const FALLBACK_MENU_ITEMS: MenuItem[] = [
  {
    id: 'japanese-katsu-curry-bowl',
    name: 'Japanese Katsu Curry Bowl',
    description: 'Golden crispy chicken or tofu with rich Japanese curry, rice and fresh salad.',
    price: 14.9,
    category: 'Bowls',
    emoji: '🍛',
    dishImage: resolveDishImage('japanese-katsu-curry-bowl'),
    tags: ['Mild'],
    allergens: ['Gluten', 'Egg', 'Soy'],
    ingredients: 'Chicken katsu (flour, egg and panko-breaded, fried) or tofu, S&B Japanese curry sauce, steamed rice, fresh salad.',
    proteinOptions: BOWL_PROTEIN_OPTIONS,
    addOns: BOWL_ADD_ONS,
    origin: {
      flag: '🇯🇵',
      country: 'Japan',
      landmark: '⛩️',
      region: 'asia',
      lat: 35.36,
      long: 138.73,
      history:
        "Mount Fuji has been a sacred pilgrimage site for over a thousand years and last erupted in 1707. Its near-perfect cone inspired countless artworks, most famously Hokusai's 'The Great Wave.'",
    },
    nutrition: { calories: 690, protein: 32, fiber: 5, carbs: 78, fat: 24 },
  },
  {
    id: 'singaporean-hainanese-bowl',
    name: 'Singaporean Hainanese Bowl',
    description: 'Tender chicken or tofu with fragrant rice, ginger-scallion sauce and cucumber salad.',
    price: 14.9,
    category: 'Bowls',
    emoji: '🍚',
    dishImage: resolveDishImage('singaporean-hainanese-bowl'),
    tags: ['Mild'],
    ingredients: 'Poached chicken or tofu, ginger-garlic rice cooked in chicken stock, scallion oil, cucumber, chilli sauce on the side.',
    proteinOptions: BOWL_PROTEIN_OPTIONS,
    addOns: BOWL_ADD_ONS,
    origin: {
      flag: '🇸🇬',
      country: 'Singapore',
      landmark: '🦁',
      region: 'asia',
      lat: 1.28,
      long: 103.86,
      history:
        'Marina Bay was mostly reclaimed land, turned from swampy port waters into a financial and entertainment core starting in the 1970s. Marina Bay Sands, completed in 2010, became an instant icon of the skyline.',
    },
    nutrition: { calories: 620, protein: 34, fiber: 3, carbs: 68, fat: 18 },
  },
  {
    id: 'indian-butter-masala-bowl',
    name: 'Indian Butter Masala Bowl',
    description: 'Creamy butter masala with basmati rice, your choice of protein and fresh salad.',
    price: 14.9,
    category: 'Bowls',
    emoji: '🍲',
    dishImage: resolveDishImage('indian-butter-masala-bowl'),
    tags: ['Medium'],
    allergens: ['Dairy', 'Tree Nuts'],
    ingredients: 'Tomato-cashew-butter masala sauce finished with cream, basmati rice, fresh salad. (Source recipe uses paneer — see naming note.)',
    proteinOptions: BOWL_PROTEIN_OPTIONS,
    addOns: BOWL_ADD_ONS,
    origin: {
      flag: '🇮🇳',
      country: 'India',
      landmark: '🕌',
      region: 'asia',
      lat: 27.17,
      long: 78.04,
      history:
        'The Taj Mahal was commissioned in 1632 by Mughal emperor Shah Jahan as a mausoleum for his wife Mumtaz Mahal. It took roughly 20,000 workers over two decades to complete.',
    },
    nutrition: { calories: 640, protein: 30, fiber: 6, carbs: 62, fat: 26 },
  },
  {
    id: 'west-african-peanut-stew-bowl',
    name: 'West African Peanut Stew Bowl',
    description: 'A rich peanut and tomato stew with rice, your choice of protein and vegetables.',
    price: 14.9,
    category: 'Bowls',
    emoji: '🥘',
    dishImage: resolveDishImage('west-african-peanut-stew-bowl'),
    tags: ['Medium'],
    allergens: ['Peanut', 'Celery'],
    ingredients: 'Peanut butter and tomato stew with sweet potato, spinach and stock, your choice of protein, over rice.',
    proteinOptions: BOWL_PROTEIN_OPTIONS,
    addOns: BOWL_ADD_ONS,
    origin: {
      flag: '🇸🇳',
      country: 'West Africa',
      landmark: '🥁',
      region: 'europe-africa',
      lat: 13.91,
      long: -4.55,
      history:
        'The Great Mosque of Djenné, first built in the 13th century, is the largest mud-brick building in the world. Each year the community holds a festival to re-plaster its walls, a tradition central to keeping it standing.',
    },
    nutrition: { calories: 660, protein: 28, fiber: 8, carbs: 58, fat: 30 },
  },
  {
    id: 'mediterranean-lemon-herb-bowl',
    name: 'Mediterranean Lemon Herb Bowl',
    description: 'Herb-infused rice with lemon-marinated chicken or tofu, fresh salad and tzatziki.',
    price: 14.9,
    category: 'Bowls',
    emoji: '🥗',
    dishImage: resolveDishImage('mediterranean-lemon-herb-bowl'),
    tags: ['Mild'],
    allergens: ['Dairy'],
    ingredients: 'Lemon-oregano marinated protein, rice or potato, cucumber-tomato-olive salad with feta, tzatziki sauce.',
    proteinOptions: BOWL_PROTEIN_OPTIONS,
    addOns: BOWL_ADD_ONS,
    origin: {
      flag: '🇬🇷',
      country: 'Greece',
      landmark: '🏛️',
      region: 'europe-africa',
      lat: 36.46,
      long: 25.38,
      history:
        "Santorini's cliffs were shaped by one of the largest volcanic eruptions in human history, around 1600 BCE. The island's famous white-and-blue architecture partly traces back to a 1938 law mandating whitewashed buildings.",
    },
    nutrition: { calories: 560, protein: 33, fiber: 7, carbs: 52, fat: 20 },
  },
  {
    id: 'german-jagerschnitzel-bowl',
    name: 'German Jägerschnitzel Bowl',
    description: 'Crispy schnitzel or tofu with mushroom sauce, rice and fresh seasonal salad.',
    price: 14.9,
    category: 'Bowls',
    emoji: '🍖',
    dishImage: resolveDishImage('german-jagerschnitzel-bowl'),
    tags: ['Mild'],
    allergens: ['Dairy', 'Soy', 'Celery', 'Sulphites'],
    ingredients: 'Mushroom Jägersauce (bacon, red wine, cream, chicken broth, soy sauce) over schnitzel or tofu, with rice or potato.',
    proteinOptions: BOWL_PROTEIN_OPTIONS,
    addOns: BOWL_ADD_ONS,
    origin: {
      flag: '🇩🇪',
      country: 'Germany',
      landmark: '🏰',
      region: 'europe-africa',
      lat: 47.56,
      long: 10.75,
      history:
        'Neuschwanstein was commissioned by King Ludwig II of Bavaria in 1869 as a private retreat, and he lived there only briefly before his death in 1886. It later inspired Disney’s Sleeping Beauty Castle.',
    },
    nutrition: { calories: 710, protein: 36, fiber: 4, carbs: 60, fat: 32 },
  },
  {
    id: 'mexican-chipotle-barbacoa-bowl',
    name: 'Mexican Chipotle Barbacoa Bowl',
    description: 'Smoky chipotle-braised chicken or tofu with lime rice, black beans and pico de gallo.',
    price: 14.9,
    category: 'Bowls',
    emoji: '🌮',
    dishImage: resolveDishImage('mexican-chipotle-barbacoa-bowl'),
    tags: ['Medium'],
    allergens: ['Dairy'],
    ingredients: 'Chipotle-marinated protein, lime rice, black beans, pico de gallo, with sour cream and cheese.',
    proteinOptions: BOWL_PROTEIN_OPTIONS,
    addOns: BOWL_ADD_ONS,
    origin: {
      flag: '🇲🇽',
      country: 'Mexico',
      landmark: '🌵',
      region: 'americas',
      lat: 20.68,
      long: -88.57,
      history:
        'Chichen Itza was one of the largest Maya cities, flourishing between roughly 600 and 1200 CE. Its main pyramid is a precise solar calendar — on the equinoxes, sunlight creates a shadow that appears to slither down the staircase.',
    },
    nutrition: { calories: 630, protein: 35, fiber: 9, carbs: 56, fat: 22 },
  },

  // Partner restaurant items — Chili Döner Freising's own fixed menu.
  {
    id: 'chili-doner',
    name: 'Döner',
    description: 'Grilled turkey or chicken döner in flatbread with salad, from Chili Döner Freising.',
    price: 7.0,
    category: 'Bowls',
    emoji: '🥙',
    tags: ['From Chili Döner Freising'],
    groupId: 'chili-doner-freising',
    groupLabel: 'Chili Döner Freising',
    origin: {
      flag: '🇹🇷',
      country: 'Turkey',
      landmark: '🎈',
      region: 'europe-africa',
      lat: 38.64,
      long: 34.83,
      history:
        "Cappadocia's fairy chimneys formed over millions of years as wind and rain eroded soft volcanic rock, and its cave dwellers carved entire underground cities into it to shelter from invaders. Today it's one of the world's most photographed hot-air-balloon rides at sunrise.",
    },
    nutrition: { calories: 550, protein: 28, fiber: 3, carbs: 48, fat: 26 },
  },
  {
    id: 'chili-durum',
    name: 'Dürüm',
    description: 'Döner meat wrapped in soft flatbread, from Chili Döner Freising.',
    price: 6.0,
    category: 'Bowls',
    emoji: '🌯',
    tags: ['From Chili Döner Freising'],
    groupId: 'chili-doner-freising',
    groupLabel: 'Chili Döner Freising',
    nutrition: { calories: 520, protein: 26, fiber: 3, carbs: 46, fat: 22 },
  },
  {
    id: 'chili-falafelteller',
    name: 'Falafelteller',
    description: 'Crispy falafel with hummus, salad and sauces, from Chili Döner Freising.',
    price: 6.5,
    category: 'Bowls',
    emoji: '🧆',
    tags: ['From Chili Döner Freising', 'Vegetarian'],
    groupId: 'chili-doner-freising',
    groupLabel: 'Chili Döner Freising',
    nutrition: { calories: 480, protein: 16, fiber: 8, carbs: 52, fat: 22 },
  },

  // Partner restaurant items — 7 Days Freising's own fixed pizza/pasta menu.
  {
    id: 'sevendays-pizza-7days',
    name: 'Pizza 7 Days',
    description: 'Tomato sauce, mozzarella, rocket, chicken breast, cherry tomatoes and parmesan — the house specialty from 7 Days Freising.',
    price: 12.5,
    category: 'Bowls',
    emoji: '🍕',
    tags: ['From 7 Days Freising'],
    groupId: '7-days-freising',
    groupLabel: '7 Days Freising',
    origin: {
      flag: '🇮🇹',
      country: 'Italy',
      landmark: '🏟️',
      region: 'europe-africa',
      lat: 41.89,
      long: 12.49,
      history:
        "The Colosseum was completed in 80 CE under Emperor Titus and could seat up to 80,000 spectators for gladiatorial contests and public spectacles. Its network of arches and vaulted concrete became a blueprint for stadiums for the next two thousand years.",
    },
    nutrition: { calories: 850, protein: 42, fiber: 5, carbs: 90, fat: 30 },
  },
  {
    id: 'sevendays-margherita',
    name: 'Pizza Margherita',
    description: 'Classic tomato sauce and mozzarella, from 7 Days Freising.',
    price: 8.9,
    category: 'Bowls',
    emoji: '🍕',
    tags: ['From 7 Days Freising', 'Vegetarian'],
    groupId: '7-days-freising',
    groupLabel: '7 Days Freising',
    nutrition: { calories: 780, protein: 32, fiber: 4, carbs: 95, fat: 28 },
  },
  {
    id: 'sevendays-carbonara',
    name: 'Carbonara',
    description: 'Pasta with cream, egg and bacon, from 7 Days Freising.',
    price: 11.5,
    category: 'Bowls',
    emoji: '🍝',
    tags: ['From 7 Days Freising'],
    groupId: '7-days-freising',
    groupLabel: '7 Days Freising',
    nutrition: { calories: 820, protein: 30, fiber: 4, carbs: 78, fat: 38 },
  },

  { id: 'coca-cola', name: 'Coca-Cola', description: 'Classic Coca-Cola, served ice cold.', price: 2.5, category: 'Drinks', emoji: '🥤' },
  { id: 'coca-cola-zero', name: 'Coca-Cola Zero', description: 'All the taste, zero sugar.', price: 2.5, category: 'Drinks', emoji: '🥤' },
  { id: 'fanta', name: 'Fanta', description: 'Sparkling orange soft drink.', price: 2.5, category: 'Drinks', emoji: '🍊' },
  { id: 'sprite', name: 'Sprite', description: 'Crisp lemon-lime soft drink.', price: 2.5, category: 'Drinks', emoji: '🥤' },
  { id: 'mezzo-mix', name: 'Mezzo Mix', description: 'Cola and orange soda blend.', price: 2.5, category: 'Drinks', emoji: '🥤' },
  { id: 'fuze-tea-peach', name: 'Fuze Tea Peach', description: 'Iced tea with peach flavour.', price: 2.7, category: 'Drinks', emoji: '🍑' },
  { id: 'fuze-tea-lemon', name: 'Fuze Tea Lemon', description: 'Iced tea with lemon flavour.', price: 2.7, category: 'Drinks', emoji: '🍋' },
  { id: 'still-water', name: 'Still Water', description: 'Still mineral water.', price: 2.0, category: 'Drinks', emoji: '💧' },
  { id: 'sparkling-water', name: 'Sparkling Water', description: 'Sparkling mineral water.', price: 2.0, category: 'Drinks', emoji: '🫧' },

  {
    id: 'chocolate-brownie',
    name: 'Chocolate Brownie',
    description: 'Rich, fudgy and decadently chocolatey.',
    price: 4.5,
    category: 'Desserts',
    emoji: '🍫',
  },
  {
    id: 'carrot-cake',
    name: 'Carrot Cake',
    description: 'Moist carrot cake with cream cheese frosting.',
    price: 4.5,
    category: 'Desserts',
    emoji: '🍰',
  },
  {
    id: 'mochi-ice-cream',
    name: 'Mochi Ice Cream',
    description: 'Soft mochi with creamy ice cream filling.',
    price: 5.0,
    category: 'Desserts',
    emoji: '🍡',
  },
];
