// Shared by every payment endpoint (Checkout Session + Terminal card-present)
// so the "never trust a client-submitted price" logic lives in exactly one
// place. Recomputes each line's real unit price from `menu_items` (base
// price + any selected add-ons, looked up by id) — never from the order
// row's own stored price, which could in principle have been written by a
// tampered client before this ever runs.
async function computeOrderPricing(supabase, order) {
  const itemIds = [...new Set(order.lines.map((line) => line.item && line.item.id).filter(Boolean))];
  const { data: menuItems, error: menuError } = await supabase
    .from('menu_items')
    .select('id, name, price, add_ons')
    .in('id', itemIds);

  if (menuError || !menuItems) {
    throw new Error('Could not verify menu prices');
  }
  const menuById = new Map(menuItems.map((m) => [m.id, m]));

  let subtotal = 0;
  const lines = order.lines.map((line) => {
    const menuItem = menuById.get(line.item && line.item.id);
    if (!menuItem) {
      throw new Error(`Order references a menu item that no longer exists: ${line.item && line.item.id}`);
    }
    const addOnsTotal = (menuItem.add_ons || [])
      .filter((addOn) => (line.selectedAddOnIds || []).includes(addOn.id))
      .reduce((sum, addOn) => sum + Number(addOn.price), 0);
    const unitPrice = Number(menuItem.price) + addOnsTotal;
    subtotal += unitPrice * line.quantity;
    return { name: menuItem.name, unitPrice, quantity: line.quantity };
  });

  return { subtotal, lines };
}

module.exports = { computeOrderPricing };
