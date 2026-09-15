export type ToolIcon = 'scale' | 'flame' | 'pie' | 'target' | 'ruler' | 'calendar' | 'drop' | 'egg';

export interface ToolMeta {
  slug: string;
  name: string;
  short: string;
  description: string;
  icon: ToolIcon;
  keywords: string[];
  /** Order on the home page. */
  order: number;
  featured?: boolean;
}

export const TOOLS: readonly ToolMeta[] = [
  {
    slug: 'calories',
    name: 'Calorie Calculator',
    short: 'Calories & TDEE',
    description:
      'Find your maintenance calories (TDEE) and a safe daily target to lose weight at the pace you choose. Mifflin-St Jeor, Harris-Benedict and Katch-McArdle.',
    icon: 'flame',
    keywords: [
      'tdee calculator',
      'calorie deficit calculator',
      'maintenance calories',
      'bmr calculator',
    ],
    order: 1,
    featured: true,
  },
  {
    slug: 'timeline',
    name: 'Weight-Loss Timeline',
    short: 'Goal date',
    description:
      'See exactly when you will reach your goal weight, week by week, with a projection that adapts as your metabolism changes.',
    icon: 'calendar',
    keywords: ['weight loss timeline', 'weight loss date calculator', 'how long to lose weight'],
    order: 2,
    featured: true,
  },
  {
    slug: 'macros',
    name: 'Macro Calculator',
    short: 'Protein, carbs, fat',
    description:
      'Turn your calorie target into daily grams of protein, carbs and fat with proven presets or a protein-first custom split.',
    icon: 'pie',
    keywords: ['macro calculator', 'macronutrient calculator', 'iifym calculator'],
    order: 3,
    featured: true,
  },
  {
    slug: 'bmi',
    name: 'BMI Calculator',
    short: 'Body mass index',
    description:
      'Calculate your BMI, see where it sits on the WHO scale and get the healthy weight range for your height.',
    icon: 'scale',
    keywords: ['bmi calculator', 'body mass index', 'healthy weight range'],
    order: 4,
  },
  {
    slug: 'body-fat',
    name: 'Body-Fat Calculator',
    short: 'US Navy method',
    description:
      'Estimate body-fat percentage from a tape measure using the U.S. Navy method, plus your lean and fat mass.',
    icon: 'ruler',
    keywords: ['body fat calculator', 'navy body fat', 'body fat percentage'],
    order: 5,
  },
  {
    slug: 'protein',
    name: 'Protein Calculator',
    short: 'Daily protein',
    description:
      'Get an evidence-based daily protein target for fat loss, maintenance or muscle gain, split across your meals.',
    icon: 'egg',
    keywords: ['protein calculator', 'how much protein', 'protein intake'],
    order: 6,
  },
  {
    slug: 'ideal-weight',
    name: 'Ideal Weight Calculator',
    short: 'Reference weights',
    description:
      'Compare the Devine, Robinson, Miller and Hamwi formulas with the BMI-based healthy range for your height.',
    icon: 'target',
    keywords: ['ideal weight calculator', 'ideal body weight', 'ibw'],
    order: 7,
  },
  {
    slug: 'water',
    name: 'Water Intake Calculator',
    short: 'Daily hydration',
    description:
      'A daily water target based on your weight, exercise and climate, with the reasoning behind it.',
    icon: 'drop',
    keywords: ['water intake calculator', 'how much water should i drink', 'hydration calculator'],
    order: 8,
  },
];

export const toolBySlug = (slug: string): ToolMeta | undefined =>
  TOOLS.find((t) => t.slug === slug);
export const toolHref = (slug: string): string => `/tools/${slug}/`;
