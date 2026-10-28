/** Social cards for the top-level pages that are not tools, guides or recipes (see og/pages). */
import { chains } from './chains-build';
import type { OgCard } from './og';
import { builtRecipes } from './recipes-build';
import { TOOLS } from './tools';

const chainItems = chains.reduce((s, c) => s + c.items.length, 0);
const quick = builtRecipes.filter((r) => r.minutes <= 15).length;
const plant = builtRecipes.filter((r) => r.diet === 'vegan' || r.diet === 'vegetarian').length;

export const OG_PAGES: Record<string, OgCard> = {
  'eating-out': {
    kicker: 'Eating out',
    title: `The leanest order at ${chains.length} chains`,
    stats: [
      { label: 'chains', value: String(chains.length) },
      { label: 'menu items', value: String(chainItems) },
      { label: 'ranked by', value: 'P / kcal' },
      { label: 'to log', value: '1 tap' },
    ],
  },
  recipes: {
    kicker: 'Starter recipes',
    title: `${builtRecipes.length} high-protein recipes that fit your numbers`,
    stats: [
      { label: 'recipes', value: String(builtRecipes.length) },
      { label: 'in 15 minutes', value: String(quick) },
      { label: 'plant-based', value: String(plant) },
      { label: 'price', value: 'Free' },
    ],
  },
  tools: {
    kicker: 'Free calculators',
    title: `${TOOLS.length} weight-loss calculators sharing one profile`,
    summary:
      'Calories and TDEE, goal timeline, macros, BMI, body fat, protein, ideal weight and water. Private, instant, no sign-up.',
  },
  guides: {
    kicker: 'Guides',
    title: 'Weight loss explained without the nonsense',
    summary:
      'Plain-English, evidence-based guides on deficits, protein, plateaus, training while dieting and the habits that make it stick.',
  },
  compare: {
    kicker: 'Ethereal vs the big apps',
    title: 'Free, private, and honest about the maths',
    stats: [
      { label: 'price', value: 'Free' },
      { label: 'account', value: 'None' },
      { label: 'your data', value: 'On device' },
      { label: 'ads', value: 'Zero' },
    ],
  },
  about: {
    kicker: 'About & methodology',
    title: 'Every formula on the site, documented',
    summary:
      'Mifflin-St Jeor, Katch-McArdle, exponentially smoothed trends, a two-week check: what Ethereal computes and the evidence behind it.',
  },
  changelog: {
    kicker: "What's new",
    title: 'Ethereal ships often',
    summary:
      'Recipes and planning, importing from other apps, the weekly review, eating out, search and fixes. Everything is live at the same address.',
  },
};
