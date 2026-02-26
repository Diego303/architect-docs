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

export const collections = { docs, pages, architectures };
