import { z } from 'zod';

export const testStepSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('navigate'),
    url: z.string().min(1),
    waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
  }),
  z.object({ action: z.literal('click'), query: z.string().min(1) }),
  z.object({
    action: z.literal('type'),
    query: z.string().min(1),
    value: z.string(),
  }),
  z.object({ action: z.literal('press'), key: z.string().min(1) }),
  z.object({
    action: z.literal('scroll'),
    direction: z.enum(['up', 'down', 'left', 'right']),
  }),
  z.object({
    action: z.literal('wait'),
    condition: z.enum(['element', 'url', 'networkIdle', 'timeout']),
    query: z.string().optional(),
    value: z.string().optional(),
    match: z.enum(['equals', 'contains']).optional(),
    durationMs: z.number().int().min(100).optional(),
  }),
  z.object({
    action: z.literal('screenshot'),
    fullPage: z.boolean().optional(),
  }),
  z.object({ action: z.literal('assert.exists'), query: z.string().min(1), soft: z.boolean().optional() }),
  z.object({
    action: z.literal('assert.text'),
    contains: z.string().min(1),
    match: z.enum(['contains', 'equals']).optional(),
    soft: z.boolean().optional(),
  }),
  z.object({
    action: z.literal('assert.url'),
    url: z.string().min(1),
    match: z.enum(['equals', 'contains']).optional(),
    soft: z.boolean().optional(),
  }),
  z.object({
    action: z.literal('assert.network'),
    url: z.string().min(1),
    status: z.union([z.number().int(), z.string()]),
    soft: z.boolean().optional(),
  }),
]);

export type ParsedTestStep = z.infer<typeof testStepSchema>;
