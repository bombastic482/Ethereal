/**
 * Halal filter: hides pork and pork products, gelatin sweets and alcohol by name. Names in the
 * database are descriptive ("Sausage, pork, grilled", "Bacon King (Burger King)"), so a word
 * list on the name is reliable; a plant, poultry or beef qualifier next to the word lets the
 * item through ("Turkey bacon", "Sausage, chicken", "Vegan Sausage Roll").
 */
const BLOCK =
  /\b(pork|bacon|ham|gammon|prosciutto|pancetta|chorizo|salami|pepperoni|lard|lardons|black pudding|mortadella|bratwurst|frankfurters?|hot dogs?|wine|beer|lager|cider|pale ale|ipa|vodka|gin|whisky|whiskey|rum|tequila|liqueur|prosecco|champagne|sangria|gelatine?|gummy|gummies|marshmallows?|haribo|jelly babies|wine gums|percy pigs|sausages?|spam|carnitas|guanciale|nduja|jam[óo]n|iberico|speck|kielbasa|andouille|luncheon meat|crackling|scratchings|pigs? in blankets|char siu|tonkotsu|tonkatsu|feijoada|cochinita|boerewors|pork pie)\b/i;
const QUALIFIER =
  'turkey|chicken|beef|lamb|vegan|vegetarian|veggie|plant-based|tempeh|tofu|quorn|mycoprotein|soy';
const ALLOW = new RegExp(
  `\\b(${QUALIFIER}) (bacon|sausages?|hot dogs?|ham)\\b|\\b(bacon|sausages?|ham), (${QUALIFIER})\\b|\\bvinegar\\b|alcohol-free|non-alcoholic|\\b0\\.0%`,
  'i',
);

/** True when nothing in the name marks it as pork, gelatin or alcohol. */
export function isHalalFriendly(name: string): boolean {
  if (!BLOCK.test(name)) return true;
  if (/\bpork\b/i.test(name)) return false;
  return ALLOW.test(name);
}

/** A recipe is halal-friendly when its name and every ingredient are. */
export function recipeIsHalalFriendly(recipeName: string, ingredientNames: string[]): boolean {
  return isHalalFriendly(recipeName) && ingredientNames.every(isHalalFriendly);
}
