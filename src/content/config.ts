import { defineCollection, z } from 'astro:content';

const docs = defineCollection({
    schema: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        order: z.number().optional(),
        icon: z.string().optional(),
    }),
});

const pages = defineCollection({
    schema: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
    }),
});

const architectures = defineCollection({
    schema: z.object({
        title: z.string(),
        description: z.string(),
        domain: z.string(),
        difficulty: z.enum(['Básico', 'Intermedio', 'Avanzado']),
        icon: z.string(),
        order: z.number(),
        features: z.array(z.string()),
    }),
});

// English collections (same schemas, EN difficulty values)
const docsEn = defineCollection({
    schema: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        order: z.number().optional(),
        icon: z.string().optional(),
    }),
});

const pagesEn = defineCollection({
    schema: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
    }),
});

const architecturesEn = defineCollection({
    schema: z.object({
        title: z.string(),
        description: z.string(),
        domain: z.string(),
        difficulty: z.enum(['Basic', 'Intermediate', 'Advanced']),
        icon: z.string(),
        order: z.number(),
        features: z.array(z.string()),
    }),
});

export const collections = {
    docs,
    pages,
    architectures,
    'docs-en': docsEn,
    'pages-en': pagesEn,
    'architectures-en': architecturesEn,
};
