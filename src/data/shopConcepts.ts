// Concept-only "eco shop" mockup — NOT a real product catalog. Placeholder
// items to show the idea of selling recycled/eco-friendly goods tied to
// each country on the globe. No real sourcing, pricing, or inventory yet.

export interface ShopConcept {
  id: string;
  country: string;
  flag: string;
  emoji: string;
  name: string;
  description: string;
  price: number; // placeholder only
}

export const shopConcepts: ShopConcept[] = [
  {
    id: 'furoshiki-cloth',
    country: 'Japan',
    flag: '🇯🇵',
    emoji: '🎀',
    name: 'Furoshiki Wrapping Cloth',
    description: 'Reusable recycled-cotton wrapping cloth, based on the traditional Japanese furoshiki.',
    price: 14,
  },
  {
    id: 'ocean-plastic-tote',
    country: 'Singapore',
    flag: '🇸🇬',
    emoji: '👜',
    name: 'Ocean Plastic Tote Bag',
    description: 'A tote woven from reclaimed ocean plastic collected around the Singapore Strait.',
    price: 18,
  },
  {
    id: 'upcycled-sari-scarf',
    country: 'India',
    flag: '🇮🇳',
    emoji: '🧣',
    name: 'Upcycled Sari Scarf',
    description: 'Handwoven scarf made from repurposed sari fabric offcuts.',
    price: 16,
  },
  {
    id: 'recycled-glass-bracelet',
    country: 'West Africa',
    flag: '🇸🇳',
    emoji: '📿',
    name: 'Recycled Glass Bead Bracelet',
    description: 'Beads hand-cast from recycled glass, in the West African beadmaking tradition.',
    price: 9,
  },
  {
    id: 'olive-wood-utensils',
    country: 'Greece',
    flag: '🇬🇷',
    emoji: '🥄',
    name: 'Olive Wood Utensil Set',
    description: 'Kitchen utensils carved from sustainably sourced olive wood offcuts.',
    price: 22,
  },
  {
    id: 'recycled-felt-coasters',
    country: 'Germany',
    flag: '🇩🇪',
    emoji: '🟫',
    name: 'Recycled Felt Coasters',
    description: 'Coaster set made from felt spun out of recycled PET bottles.',
    price: 12,
  },
  {
    id: 'beaded-keychain',
    country: 'Mexico',
    flag: '🇲🇽',
    emoji: '🔑',
    name: 'Huichol-Style Beaded Keychain',
    description: 'Keychain beaded with recycled glass seed beads, inspired by Huichol artisan work.',
    price: 7,
  },
];
