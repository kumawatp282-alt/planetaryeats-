// Internal business reference data, transcribed from the owner's own
// planning documents (Business Plan, Kitchen Assessment, Financial Model
// v2, Recipes). ADMIN-ONLY — this is confidential: food costs, margins,
// break-even and supplier prices must never render on a public page.
// Surfaced at /admin → Business so the owner can reference it on their
// phone (e.g. standing in METRO) instead of digging through PDFs.
//
// Every figure here is an ESTIMATE from those documents, dated August 2026.
// The documents themselves say to replace them with real quoted prices and
// to confirm all tax/legal/insurance figures with a Steuerberater and
// Rechtsanwalt. Treated as reference, never as settled fact.

export interface ChecklistItem {
  id: string;
  label: string;
  detail?: string;
  group: 'urgent' | 'compliance' | 'kitchen' | 'launch';
}

// Combines the Business Plan's compliance checklist (section 15) with the
// Kitchen Assessment's "red flags" and "next seven steps".
export const LAUNCH_CHECKLIST: ChecklistItem[] = [
  // Urgent — the Kitchen Assessment flags these as blocking
  {
    id: 'hood-clean',
    label: 'Professional hood + duct clean (VDI 2052), keep the certificate',
    detail: 'Heavy grease visible in your photos — fire risk and an automatic Gesundheitsamt fail. Est. €300–900. Do this before cooking anything for sale.',
    group: 'urgent',
  },
  {
    id: 'inventory-list',
    label: 'Get a written Inventarliste — confirm what equipment is actually yours',
    detail: 'Before selling or relying on anything. Taking over a lease often means the kit belongs to the landlord or previous operator.',
    group: 'urgent',
  },
  {
    id: 'test-equipment',
    label: 'Test every fridge/freezer holds temperature over several hours',
    detail: '≤5°C fridges, ≤-18°C freezers. Also: all range burners light, fryer thermostats accurate, saladette holds temp, hood actually pulls. A dead compressor costs more than the fridge.',
    group: 'urgent',
  },
  {
    id: 'storage-agreement',
    label: 'Negotiate refrigerated/frozen/dry storage allocation IN WRITING',
    detail: 'Your whole batch-prep model depends on it. One fridge shelf breaks the business.',
    group: 'urgent',
  },
  {
    id: 'peanut-allergen',
    label: 'Raise the peanut allergen question with the pizzeria',
    detail: 'You are introducing a major allergen into someone else\'s premises. They must know, agree, and update their own declarations. Needs dedicated storage, tools and a cleaning protocol.',
    group: 'urgent',
  },
  {
    id: 'lieferando-rates',
    label: 'Check your actual Lieferando commission — both self-delivery and platform-delivery',
    detail: 'This single number changes your pricing more than anything else. Model assumes ~32% platform vs ~15% self-delivery.',
    group: 'urgent',
  },

  // Compliance
  { id: 'gewerbeanmeldung', label: 'Gewerbeanmeldung (business registration)', group: 'compliance' },
  { id: 'steuer-erfassung', label: 'Fragebogen zur steuerlichen Erfassung', detail: 'Do this with your Steuerberater.', group: 'compliance' },
  { id: 'ifsg-belehrung', label: 'IfSG §43 Belehrung — you AND every employee, before first shift', group: 'compliance' },
  { id: 'gesundheitsamt', label: 'Gesundheitsamt registration as a new operator', detail: 'Usually required even in already-licensed premises.', group: 'compliance' },
  { id: 'haccp', label: 'Written HACCP concept', detail: 'Legally required. DEHOGA publishes guidance.', group: 'compliance' },
  { id: 'lucid', label: 'LUCID / Verpackungsregister registration + licensing', detail: 'Catches most delivery startups out; carries penalties.', group: 'compliance' },
  { id: 'allergen-declaration', label: 'Declare all 14 EU allergens', detail: 'Your menu has peanut, tree nuts, dairy, gluten, egg, soy, sesame, mustard, celery, sulphites.', group: 'compliance' },
  { id: 'betriebshaftpflicht', label: 'Betriebshaftpflicht + Produkthaftpflicht insurance', detail: 'Before you serve anyone. Product liability matters because of allergens.', group: 'compliance' },
  { id: 'bgn', label: 'BGN (Berufsgenossenschaft) registration', group: 'compliance' },
  { id: 'dguv-v3', label: 'DGUV V3 electrical inspection on inherited equipment', detail: 'Est. €150–500. Required for workplace safety and insurance.', group: 'compliance' },
  { id: 'waste-contracts', label: 'Waste disposal contracts (Restmüll, Bio, Altpapier, waste oil, grease trap)', group: 'compliance' },
  { id: 'pest-control', label: 'Pest control contract', group: 'compliance' },
  { id: 'temp-logs', label: 'Daily temperature & cooling logs in place', group: 'compliance' },
  { id: 'kitchen-agreement', label: 'Shared-kitchen agreement reviewed by a Rechtsanwalt', detail: 'Storage, equipment hours, utility split, allergens, damage liability, notice period.', group: 'compliance' },

  // Kitchen equipment gaps
  { id: 'rice-cookers', label: 'Buy 2× commercial rice cooker (8–15L)', detail: 'A pizzeria has zero rice capability. One plain, one for Hainanese. €120–300 used / €300–700 new.', group: 'kitchen' },
  { id: 'bain-marie', label: 'Buy hot bain-marie, 3–4 GN wells', detail: 'YOUR BIGGEST GAP. The saladette is a COLD well — nothing currently holds sauce at ≥63°C. €100–350 used / €250–600 new.', group: 'kitchen' },
  { id: 'immersion-blender', label: 'Buy long-shaft commercial immersion blender', detail: 'The paneer tomato-cashew base must go properly smooth. The veg cutter won\'t do this. €80–200 used.', group: 'kitchen' },
  { id: 'stockpots', label: 'Buy 2–3 heavy-bottom stockpots (20–40L)', detail: 'Thin bases scorch peanut and paneer. €50–150 used.', group: 'kitchen' },
  { id: 'gn-pans', label: 'Buy GN pans + lids (full set)', detail: '7 sauces × 3 sets. Most under-bought item — lids especially. €300–700.', group: 'kitchen' },
  { id: 'sell-pizza-oven', label: 'Sell the 2-deck pizza oven + meat slicer', detail: 'Useless for your menu. Est. €400–2,000 + €150–600 — likely funds your entire critical gap list. Confirm ownership first.', group: 'kitchen' },

  // Launch decisions
  { id: 'decide-format', label: 'Decide: delivery-only vs delivery + walk-in', detail: 'You have a street-facing shopfront with a serving counter. Walk-in takes 0% commission vs 25–35%. Decide before locking menu pricing.', group: 'launch' },
  { id: 'resolve-paneer', label: 'Resolve the Butter Bowl naming: paneer or chicken?', detail: 'Your linked recipe and spice inventory are both Paneer Butter Masala, but the site lists chicken/tofu/egg. Decide before printing anything.', group: 'launch' },
  { id: 'katsu-decision', label: 'Decide on Katsu: fried for pickup only, or curry-over-grilled for delivery', detail: 'Fried katsu goes soggy in a sealed box within 10–15 min. The fryer is already installed, so this is a menu decision, not an equipment one.', group: 'launch' },
  { id: 'real-prices', label: 'Walk METRO and replace every estimated ingredient price with a real one', group: 'launch' },
  { id: 'check-competitors', label: 'Check comparable bowl prices on Lieferando in Freising before locking prices', group: 'launch' },
  { id: 'trial-run', label: 'Trial run: cook all 7 bowls at batch scale, time assembly, cost actual yield', group: 'launch' },
];

// From the Business Plan's cost-per-dish table (section 9).
export interface DishCost {
  name: string;
  rawIngredients: number;
  waste: number;
  packaging: number;
  total: number;
}

export const DISH_COSTS: DishCost[] = [
  { name: 'Hainanese Bowl', rawIngredients: 1.56, waste: 0.13, packaging: 0.53, total: 2.22 },
  { name: 'Peanut Bowl', rawIngredients: 1.87, waste: 0.15, packaging: 0.53, total: 2.55 },
  { name: 'Chipotle Bowl', rawIngredients: 2.14, waste: 0.17, packaging: 0.53, total: 2.84 },
  { name: 'Katsu Bowl', rawIngredients: 2.14, waste: 0.17, packaging: 0.53, total: 2.84 },
  { name: 'Mediterranean Bowl', rawIngredients: 2.2, waste: 0.18, packaging: 0.53, total: 2.91 },
  { name: 'Butter Bowl', rawIngredients: 2.22, waste: 0.18, packaging: 0.53, total: 2.93 },
  { name: 'German Bowl', rawIngredients: 2.33, waste: 0.19, packaging: 0.53, total: 3.04 },
];

// From the Financial Model's "Cost Per Plate" tab — the sheet itself calls
// this the most important table in the workbook.
export interface VolumeRow {
  bowlsPerDay: number;
  trueCostLean: number;
  trueCostHigh: number;
  netProfitPlatform: number;
  netProfitSelfDelivery: number;
}

export const TRUE_COST_BY_VOLUME: VolumeRow[] = [
  { bowlsPerDay: 20, trueCostLean: 7.75, trueCostHigh: 11.26, netProfitPlatform: -2.46, netProfitSelfDelivery: -0.25 },
  { bowlsPerDay: 30, trueCostLean: 6.1, trueCostHigh: 8.44, netProfitPlatform: 0.36, netProfitSelfDelivery: 2.57 },
  { bowlsPerDay: 35, trueCostLean: 5.63, trueCostHigh: 7.64, netProfitPlatform: 1.17, netProfitSelfDelivery: 3.37 },
  { bowlsPerDay: 40, trueCostLean: 5.27, trueCostHigh: 7.03, netProfitPlatform: 1.78, netProfitSelfDelivery: 3.98 },
  { bowlsPerDay: 50, trueCostLean: 4.78, trueCostHigh: 6.18, netProfitPlatform: 2.62, netProfitSelfDelivery: 4.82 },
  { bowlsPerDay: 60, trueCostLean: 4.45, trueCostHigh: 5.62, netProfitPlatform: 3.19, netProfitSelfDelivery: 5.39 },
  { bowlsPerDay: 80, trueCostLean: 4.04, trueCostHigh: 4.92, netProfitPlatform: 3.89, netProfitSelfDelivery: 6.09 },
  { bowlsPerDay: 100, trueCostLean: 3.79, trueCostHigh: 4.49, netProfitPlatform: 4.31, netProfitSelfDelivery: 6.52 },
];

export const KEY_NUMBERS = {
  avgFoodCostPerBowl: 2.8,
  recommendedMenuPrice: 12.95,
  breakEvenBowlsLow: 16,
  breakEvenBowlsHigh: 28,
  monthlyOperatingLow: 2572,
  monthlyOperatingHigh: 4400,
  oneOffLaunchLow: 9562,
  oneOffLaunchHigh: 28091,
  minimumStart: 5185,
  platformCommission: 0.32,
  selfDeliveryCommission: 0.15,
};

// From the Business Plan's ingredient price table (section 8), German
// wholesale estimates at METRO/Selgros level, netto. The nine marked
// `missing: true` were flagged as needed by the recipes but absent from
// the owner's own inventory sheet.
export interface IngredientPrice {
  name: string;
  unit: string;
  price: number;
  missing?: boolean;
}

export const INGREDIENT_PRICES: IngredientPrice[] = [
  { name: 'Yellow Onions', unit: 'kg', price: 1.0 },
  { name: 'Red Onions', unit: 'kg', price: 1.2 },
  { name: 'Tomatoes', unit: 'kg', price: 2.5 },
  { name: 'Potatoes', unit: 'kg', price: 1.2, missing: true },
  { name: 'Sweet Potatoes', unit: 'kg', price: 2.2 },
  { name: 'Garlic', unit: 'kg', price: 5.0 },
  { name: 'Ginger', unit: 'kg', price: 5.5 },
  { name: 'Cucumbers', unit: 'kg', price: 1.8 },
  { name: 'Mushrooms', unit: 'kg', price: 4.0 },
  { name: 'Spinach', unit: 'kg', price: 4.5 },
  { name: 'Romaine Lettuce', unit: 'kg', price: 3.0 },
  { name: 'Jalapeños', unit: 'kg', price: 7.0 },
  { name: 'Spring Onions', unit: 'kg', price: 5.0 },
  { name: 'Fresh Coriander', unit: 'kg', price: 12.0 },
  { name: 'Fresh Dill', unit: 'kg', price: 14.0 },
  { name: 'Lemons', unit: 'kg', price: 2.2 },
  { name: 'Limes', unit: 'kg', price: 3.5 },
  { name: 'Chicken Breast', unit: 'kg', price: 7.5 },
  { name: 'Chicken Thighs', unit: 'kg', price: 5.5 },
  { name: 'Firm Tofu', unit: 'kg', price: 6.0 },
  { name: 'Paneer', unit: 'kg', price: 9.0, missing: true },
  { name: 'Eggs', unit: 'each', price: 0.3 },
  { name: 'Bacon / Speck', unit: 'kg', price: 8.0, missing: true },
  { name: 'Butter', unit: 'kg', price: 8.5 },
  { name: 'Fresh Cream', unit: 'L', price: 3.2 },
  { name: 'Greek Yogurt', unit: 'kg', price: 3.5 },
  { name: 'Feta Cheese', unit: 'kg', price: 8.0 },
  { name: 'Sour Cream', unit: 'kg', price: 2.8 },
  { name: 'Monterey Jack / Cheddar', unit: 'kg', price: 8.5 },
  { name: 'Basmati Rice', unit: 'kg', price: 2.2 },
  { name: 'Jasmine Rice', unit: 'kg', price: 2.0 },
  { name: 'Japanese Rice', unit: 'kg', price: 3.5 },
  { name: 'Panko', unit: 'kg', price: 4.0 },
  { name: 'Plain Flour', unit: 'kg', price: 0.9 },
  { name: 'Peanut Butter', unit: 'kg', price: 5.5 },
  { name: 'Cashews', unit: 'kg', price: 12.0 },
  { name: 'Black Beans', unit: 'kg', price: 2.5 },
  { name: 'Sweet Corn', unit: 'kg', price: 2.5 },
  { name: 'Corn Starch', unit: 'kg', price: 2.0, missing: true },
  { name: 'Golden Curry Roux', unit: 'kg', price: 18.0 },
  { name: 'Chipotle in Adobo', unit: 'kg', price: 12.0 },
  { name: 'Hainanese Chilli Sauce', unit: 'kg', price: 8.0 },
  { name: 'Tomato Paste', unit: 'kg', price: 3.5 },
  { name: 'Kalamata Olives', unit: 'kg', price: 9.0 },
  { name: 'Red Wine (cooking)', unit: 'L', price: 4.0, missing: true },
  { name: 'Chicken Stock (paste)', unit: 'kg', price: 8.0 },
  { name: 'Vegetable Stock (paste)', unit: 'kg', price: 7.0 },
  { name: 'Soy Sauce', unit: 'L', price: 3.0 },
  { name: 'Worcestershire', unit: 'L', price: 6.0 },
  { name: 'Sunflower Oil', unit: 'L', price: 2.2 },
  { name: 'Canola Oil', unit: 'L', price: 2.3 },
  { name: 'Olive Oil', unit: 'L', price: 7.5 },
  { name: 'Sesame Oil', unit: 'L', price: 12.0 },
  { name: 'Salt', unit: 'kg', price: 0.6 },
  { name: 'Black Pepper', unit: 'kg', price: 15.0 },
  { name: 'White Pepper', unit: 'kg', price: 16.0 },
  { name: 'Turmeric', unit: 'kg', price: 9.0 },
  { name: 'Cumin', unit: 'kg', price: 10.0 },
  { name: 'Ground Coriander', unit: 'kg', price: 9.0, missing: true },
  { name: 'Garam Masala', unit: 'kg', price: 14.0 },
  { name: 'Shahi Paneer Masala', unit: 'kg', price: 16.0 },
  { name: 'Kasuri Methi', unit: 'kg', price: 20.0 },
  { name: 'Chili Powder', unit: 'kg', price: 9.0 },
  { name: 'Cayenne', unit: 'kg', price: 12.0 },
  { name: 'Dried Oregano', unit: 'kg', price: 14.0 },
  { name: 'Paprika', unit: 'kg', price: 8.0 },
  { name: 'Bay Leaf', unit: 'kg', price: 30.0, missing: true },
  { name: 'Cloves', unit: 'kg', price: 30.0, missing: true },
  { name: 'Cardamom', unit: 'kg', price: 60.0, missing: true },
  { name: 'Sesame Seeds', unit: 'kg', price: 6.0 },
  { name: 'Bowl + lid', unit: 'each', price: 0.35 },
  { name: 'Bag, cutlery, seal', unit: 'each', price: 0.12 },
];

// Sauce/protein/produce shelf life, from the Business Plan (section 5).
export interface ShelfLifeRow {
  item: string;
  fridge: string;
  freezer: string;
  note?: string;
}

export const SHELF_LIFE: ShelfLifeRow[] = [
  { item: 'Katsu curry (roux)', fridge: '4–5 days', freezer: '2–3 mo', note: 'Improves on day 2. Your most forgiving sauce.' },
  { item: 'Paneer base (no dairy)', fridge: '3–4 days', freezer: '2–3 mo', note: 'Store base and dairy separately — best prep move on your menu.' },
  { item: 'Paneer, finished with cream', fridge: '2–3 days', freezer: 'No', note: 'Dairy splits on freeze-thaw.' },
  { item: 'Peanut stew', fridge: '3–4 days', freezer: '2–3 mo', note: 'ALLERGEN: segregate. Tightens cold — thin with stock.' },
  { item: 'Jägersauce base (no cream)', fridge: '3–4 days', freezer: '1–2 mo', note: 'Finish with cream at service.' },
  { item: 'Tzatziki', fridge: '3–4 days', freezer: 'No', note: 'Salt and squeeze the cucumber or it waters out by day 2.' },
  { item: 'Chipotle marinade', fridge: '5–7 days', freezer: '3 mo', note: 'High acid, keeps well.' },
  { item: 'Hainanese chilli sauce', fridge: '1–2 weeks', freezer: 'No', note: 'Longest-lived item on your line.' },
  { item: 'Raw chicken', fridge: '1–2 days', freezer: '6–9 mo', note: 'Bottom shelf always, below ready-to-eat.' },
  { item: 'Cooked chicken', fridge: '3–4 days', freezer: '2–3 mo' },
  { item: 'Firm tofu, opened', fridge: '3–5 days', freezer: '3 mo', note: 'In fresh water, changed daily.' },
  { item: 'Paneer, opened', fridge: '3–5 days', freezer: '1–2 mo' },
  { item: 'Cooked rice', fridge: 'Same day', freezer: '—', note: 'Bacillus cereus risk is real. Cool fast, hold hot, or discard. Never reheat twice.' },
  { item: 'Chopped garlic in oil', fridge: 'Use fast', freezer: '—', note: 'Botulism risk — never store at room temperature.' },
];

export const FOOD_SAFETY_RULES = [
  'Danger zone 5–63°C. Cool 63°C → 21°C within 2 hours, then → 5°C within 4 more.',
  'Hot holding ≥63°C. Cold holding ≤5°C.',
  'Date-label everything: item, date made, discard date, initials. Unlabelled is discarded.',
  'Cool in shallow pans (5cm hotel pans), not deep pots. A 30L pot will not cool in time.',
  'Reheat once, to 74°C. Anything reheated and unsold gets discarded.',
  'Hot-hold max 4 hours for peanut and Jäger — refresh from a backup batch.',
];
