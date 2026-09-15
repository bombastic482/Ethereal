import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const TOOL_SLUGS = [
  'bmi',
  'calories',
  'macros',
  'ideal-weight',
  'body-fat',
  'timeline',
  'water',
  'protein',
] as const;

const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string().min(10).max(90),
    description: z.string().min(80).max(170),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.enum(['Fundamentals', 'Nutrition', 'Training', 'Mindset']),
    tags: z.array(z.string()).min(1).max(6),
    relatedTools: z.array(z.enum(TOOL_SLUGS)).default([]),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { guides };
