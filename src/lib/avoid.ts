/**
 * Matches foods against the things you said to avoid (You → Health). Each common choice covers
 * the foods people usually mean by it: "Dairy" catches laban and halloumi, "Shellfish" catches
 * prawns. Anything you typed yourself matches as a whole word. Matching is on the food's name,
 * so it is a reminder, not a guarantee: always check labels for allergies.
 */

const RULES: Record<string, RegExp> = {
  tuna: /\btuna\b/i,
  shellfish:
    /\b(shrimps?|prawns?|crabs?|lobsters?|mussels?|oysters?|clams?|scallops?|squid|calamari|octopus|shellfish|seafood)\b/i,
  peanuts: /\bpeanuts?\b|\bsatay\b/i,
  'tree nuts':
    /\b(almonds?|cashews?|walnuts?|pecans?|pistachios?|hazelnuts?|macadamias?|brazil nuts?|pine nuts?|praline|marzipan|nutella|baklava)\b/i,
  dairy:
    /\b(milk|milkshake|cheese|cheesy|yogh?urt|laban|labneh|cream|creamy|butter(?!nut)|whey|ghee|paneer|halloumi|feta|mozzarella|cheddar|parmesan|ricotta|ice cream|latte|cappuccino|flat white|karak|kunafa|muhalabia|custard|kefir|skyr|quark)\b/i,
  gluten:
    /\b(wheat|bread|breads|toast|pasta|spaghetti|noodles?|flour|couscous|bulgur|barley|rye|khubz|pitta?|wraps?|tortillas?|pizza|cakes?|biscuits?|cookies?|crackers?|croissants?|bagels?|muffins?|buns?|burgers?|harees|jareesh|thareed|margoog|mutabbaq|chebab|kibbeh|tabbouleh|seitan|beer|cereal|granola|weetabix|bran)\b/i,
  eggs: /\b(eggs?|omelett?e|frittata|shakshuka|mayonnaise|mayo|meringue|balaleet|quiche)\b/i,
  grapefruit: /\bgrapefruit\b/i,
  'fried food':
    /\b(fried|deep-fried|fries|chips|crisps|tempura|nuggets?|luqaimat|samosas?|sambousa|falafel|pakoras?|bhajis?|doughnuts?|donuts?|churros?)\b/i,
  'fizzy drinks':
    /\b(cola|coke|soda|fizzy|lemonade|sprite|fanta|pepsi|7up|mountain dew|energy drink|red bull|monster)\b/i,
  'added sugar':
    /\b(sugar|sugary|syrup|candy|sweets?|chocolate|cakes?|biscuits?|cookies?|doughnuts?|donuts?|ice cream|jam|honey|vimto|kunafa|luqaimat|umm ali|muhalabia|baklava|soft drink|cola|lemonade|frappuccino|milkshake|dessert|brownies?|cheesecake)\b/i,
  'caffeine late':
    /\b(coffee|espresso|latte|cappuccino|americano|macchiato|mocha|flat white|tea|karak|qahwa|cola|coke|pepsi|energy drink|red bull|monster|matcha)\b/i,
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The avoid choices a food name hits. `hour` lets "Caffeine late" apply only after 2 pm. */
export function avoidHits(name: string, avoid: readonly string[], hour = 12): string[] {
  const out: string[] = [];
  for (const term of avoid) {
    const key = term.trim().toLowerCase();
    if (!key) continue;
    if (key === 'caffeine late' && hour < 14) continue;
    const rule = RULES[key] ?? new RegExp(`\\b${escape(key)}s?\\b`, 'i');
    // Peanut butter is a peanut food, not dairy; nut milks are not dairy either.
    if (
      key === 'dairy' &&
      /\b(peanut|almond|oat|soy|soya|coconut|rice|cashew)\s+(butter|milk|yogh?urt|cream)\b/i.test(
        name,
      ) &&
      !/\b(cheese|laban|whey|ghee)\b/i.test(name)
    )
      continue;
    if (rule.test(name)) out.push(term);
  }
  return out;
}
