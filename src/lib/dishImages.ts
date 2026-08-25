// Local bundled dish photos — literal requires so Metro can statically
// bundle them. Extracted out of data/menu.ts so the menu-fetching code can
// stay data-source-agnostic: any menu_items row without an `image_url`
// (i.e. not yet given an admin-uploaded photo) falls back to its entry
// here, keyed by id. New dishes added purely through the admin panel won't
// have an entry here and will use `image_url` (or the emoji) instead.
/* eslint-disable @typescript-eslint/no-var-requires */
export const LOCAL_DISH_IMAGES: Record<string, any> = {
  'japanese-katsu-curry-bowl': require('../assets/dishes/japanese-katsu-curry-bowl.jpg'),
  'singaporean-hainanese-bowl': require('../assets/dishes/singaporean-hainanese-bowl.jpg'),
  'german-jagerschnitzel-bowl': require('../assets/dishes/german-jagerschnitzel-bowl.jpg'),
  'mediterranean-lemon-herb-bowl': require('../assets/dishes/mediterranean-lemon-herb-bowl.jpg'),
  'indian-butter-masala-bowl': require('../assets/dishes/indian-butter-masala-bowl.jpg'),
  'mexican-chipotle-barbacoa-bowl': require('../assets/dishes/mexican-chipotle-barbacoa-bowl.jpg'),
  'west-african-peanut-stew-bowl': require('../assets/dishes/west-african-peanut-stew-bowl.jpg'),
};
/* eslint-enable @typescript-eslint/no-var-requires */

// Resolves the single `dishImage` prop every screen already expects:
// an admin-uploaded photo (image_url, wrapped as {uri}) wins if present,
// otherwise fall back to the bundled local photo for that id, otherwise
// undefined (screens already fall back to the emoji when this is unset).
export function resolveDishImage(id: string, imageUrl?: string | null): any {
  if (imageUrl) return { uri: imageUrl };
  return LOCAL_DISH_IMAGES[id];
}
