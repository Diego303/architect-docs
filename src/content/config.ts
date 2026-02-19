import { defineCollection, z } from 'astro:content';

const docs = defineCollection({
    schema: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        order: z.number().optional(),
        icon: z.string().optional(),
    }),
});

export const collections = { docs };
