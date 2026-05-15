import OpenAI from "openai";
import { z } from "zod";
import { logAiUsage, extractUsageMetrics } from "./aiUsageLogger";
import {
  PROMPT_INJECTION_GUARD,
  wrapUntrusted,
  capAggregate,
} from "./promptSafety";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

// Export the OpenAI client for use in other services
export { openai };

export interface Note {
  id: string;
  content: string;
}

export interface AiContext {
  organizationId?: string;
  spaceId?: string;
  userId?: string;
}

export interface CategoryResult {
  noteId: string;
  category: string;
}

export interface CategorizationResponse {
  categories: CategoryResult[];
  summary: string;
}

// Validation schema for AI response
const categorizationResponseSchema = z.object({
  categories: z.array(z.object({
    noteId: z.string(),
    category: z.string(),
  })),
  summary: z.string(),
});

export async function categorizeNotes(
  notes: Note[], 
  context?: AiContext,
  maxRetries = 2
): Promise<CategorizationResponse> {
  if (notes.length === 0) {
    return {
      categories: [],
      summary: "No notes to categorize."
    };
  }

  const NOTE_CHAR_CAP = 2000;
  const noteLines = notes.map(
    (note, idx) =>
      `${idx + 1}. [ID: ${note.id}] ${wrapUntrusted(note.content, NOTE_CHAR_CAP)}`,
  );
  const { kept: keptNoteLines, dropped: droppedNotes, truncated } = capAggregate(
    noteLines,
  );

  const prompt = `You are an expert facilitator analyzing ideas from a collaborative envisioning session.

Your task: Analyze the following sticky notes and group them into meaningful categories/themes.

NOTES:
${keptNoteLines.join('\n')}${truncated ? `\n…[${droppedNotes} additional notes omitted to stay within prompt size limit]` : ''}

CRITICAL Instructions:
1. Identify 3-7 main themes/categories that emerge from these notes
2. You MUST assign EVERY SINGLE note to a category - no note should be left out
3. Use clear, concise category names (2-4 words max)
4. Provide a brief summary of the key themes discovered

Respond with valid JSON in this exact format:
{
  "categories": [
    { "noteId": "note-id-here", "category": "Category Name" }
  ],
  "summary": "Brief overview of the main themes identified"
}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: `You are an expert facilitator and thematic analyst. You excel at identifying patterns and grouping ideas into coherent categories. You ALWAYS categorize every single note provided.

${PROMPT_INJECTION_GUARD}`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 8192
      });

      const responseText = completion.choices[0].message.content;
      if (!responseText) {
        throw new Error("No response from OpenAI");
      }

      let parsedResult: unknown;
      try {
        parsedResult = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      const validationResult = categorizationResponseSchema.safeParse(parsedResult);
      if (!validationResult.success) {
        throw new Error(`Invalid response format: ${validationResult.error.message}`);
      }

      const result = validationResult.data;

      const categorizedIds = new Set(result.categories.map(c => c.noteId));
      const missingNotes = notes.filter(n => !categorizedIds.has(n.id));

      if (missingNotes.length > 0) {
        for (const note of missingNotes) {
          result.categories.push({
            noteId: note.id,
            category: "Uncategorized",
          });
        }
        result.summary += ` (${missingNotes.length} notes were automatically assigned to Uncategorized)`;
      }

      // Log AI usage
      const usage = extractUsageMetrics(completion);
      if (usage && context) {
        await logAiUsage({
          organizationId: context.organizationId,
          spaceId: context.spaceId,
          userId: context.userId,
          modelName: "gpt-5",
          operation: "categorization",
          usage,
          metadata: {
            noteCount: notes.length,
            categoryCount: new Set(result.categories.map(c => c.category)).size,
            attempt: attempt + 1,
          },
        });
      }

      return result;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Categorization attempt ${attempt + 1} failed:`, lastError.message);
      
      if (attempt === maxRetries) {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  throw new Error(`Failed to categorize notes after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`);
}

// Card Rewrite Interfaces
export interface RewriteVariation {
  version: number;
  content: string;
}

export interface RewriteResponse {
  variations: RewriteVariation[];
}

// Validation schema for rewrite response
const rewriteResponseSchema = z.object({
  variations: z.array(z.object({
    version: z.number(),
    content: z.string(),
  })),
});

/**
 * Generate AI-powered variations of a card's content
 * @param content - The original card content
 * @param category - Optional category to maintain context
 * @param count - Number of variations to generate (1-3, defaults to 3)
 * @param context - AI usage tracking context (organizationId, spaceId, userId)
 * @param maxRetries - Maximum retry attempts
 * @returns Array of rewritten variations
 */
export async function rewriteCard(
  content: string, 
  category?: string | null, 
  count: number = 3,
  context?: AiContext,
  maxRetries = 2
): Promise<RewriteResponse> {
  if (count < 1 || count > 3) {
    throw new Error("Count must be between 1 and 3");
  }

  const categoryContext = category ? `\nCategory/Theme: ${wrapUntrusted(category, 200)}` : "";

  const prompt = `You are an expert facilitator helping to clarify and improve ideas from a collaborative envisioning session.

Your task: Generate ${count} alternative ways to express the following idea. Keep the same core meaning and theme, but improve clarity, conciseness, or perspective.${categoryContext}

ORIGINAL IDEA:
${wrapUntrusted(content, 4000)}

CRITICAL Instructions:
1. Generate exactly ${count} variations
2. Each variation should maintain the same core message and category
3. Variations should be clear, concise, and professional
4. Keep variations between 10-100 words
5. Number each version (1, 2, 3)
6. Make each variation distinct in phrasing or emphasis

Respond with valid JSON in this exact format:
{
  "variations": [
    { "version": 1, "content": "First variation..." },
    { "version": 2, "content": "Second variation..." },
    { "version": 3, "content": "Third variation..." }
  ]
}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: `You are an expert facilitator and communication specialist. You excel at rephrasing ideas clearly while preserving their core meaning and intent.

${PROMPT_INJECTION_GUARD}`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2048
      });

      const responseText = completion.choices[0].message.content;
      if (!responseText) {
        throw new Error("No response from OpenAI");
      }

      let parsedResult: unknown;
      try {
        parsedResult = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      const validationResult = rewriteResponseSchema.safeParse(parsedResult);
      if (!validationResult.success) {
        throw new Error(`Invalid response format: ${validationResult.error.message}`);
      }

      const result = validationResult.data;

      // Ensure we have the requested number of variations
      if (result.variations.length !== count) {
        throw new Error(`Expected ${count} variations but got ${result.variations.length}`);
      }

      // Log AI usage
      const usage = extractUsageMetrics(completion);
      if (usage && context) {
        await logAiUsage({
          organizationId: context.organizationId,
          spaceId: context.spaceId,
          userId: context.userId,
          modelName: "gpt-5",
          operation: "rewrite",
          usage,
          metadata: {
            variationCount: count,
            hasCategory: !!category,
            attempt: attempt + 1,
          },
        });
      }

      return result;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Rewrite attempt ${attempt + 1} failed:`, lastError.message);
      
      if (attempt === maxRetries) {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  throw new Error(`Failed to rewrite card after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`);
}

// Suggest New Ideas Interfaces
export interface IdeaSuggestion {
  content: string;
  rationale?: string;
}

export interface SuggestIdeasResponse {
  suggestions: IdeaSuggestion[];
}

const suggestIdeasResponseSchema = z.object({
  suggestions: z.array(z.object({
    content: z.string().min(1),
    rationale: z.string().optional(),
  })),
});

export interface SuggestIdeasParams {
  workspaceName: string;
  workspacePurpose: string;
  existingIdeas: string[];
  knowledgeBaseSnippets?: string[];
  count?: number; // Target number of suggestions (5-10), defaults to 8
}

/**
 * Generate net-new idea suggestions for a facilitator. The model is grounded
 * in the workspace purpose, existing ideas (so we don't duplicate them) and
 * (optionally) snippets pulled from the workspace's knowledge base.
 */
export async function suggestIdeas(
  params: SuggestIdeasParams,
  context?: AiContext,
  maxRetries = 2,
): Promise<SuggestIdeasResponse> {
  const target = Math.max(5, Math.min(10, params.count ?? 8));

  const IDEA_CHAR_CAP = 1000;
  const KB_CHAR_CAP = 4000;

  const existingLines = params.existingIdeas
    .slice(0, 200)
    .map((c, i) => `${i + 1}. ${wrapUntrusted(c, IDEA_CHAR_CAP)}`);
  const cappedExisting = capAggregate(existingLines, 30000);
  const existingBlock = existingLines.length
    ? `EXISTING IDEAS (do NOT duplicate these — your suggestions must be net-new):
${cappedExisting.kept.join('\n')}${cappedExisting.truncated ? `\n…[${cappedExisting.dropped} additional ideas omitted]` : ''}`
    : 'EXISTING IDEAS: (none yet)';

  const kbLines = (params.knowledgeBaseSnippets ?? [])
    .slice(0, 8)
    .map((s, i) => `[${i + 1}] ${wrapUntrusted(s, KB_CHAR_CAP)}`);
  const cappedKb = capAggregate(kbLines, 24000);
  const kbBlock = kbLines.length
    ? `RELEVANT KNOWLEDGE BASE SNIPPETS (use these to ground your suggestions in the organization's context):
${cappedKb.kept.join('\n\n')}`
    : '';

  const prompt = `You are an expert facilitator helping to expand a collaborative envisioning session with fresh, high-quality ideas.

WORKSPACE: ${wrapUntrusted(params.workspaceName, 200)}
PURPOSE: ${wrapUntrusted(params.workspacePurpose, 2000)}

${existingBlock}

${kbBlock}

Your task: Propose ${target} NEW idea suggestions that the cohort has not already raised. Each suggestion must:
1. Be directly relevant to the workspace purpose
2. Be distinctly different from every existing idea (no rephrasing of existing ones)
3. Be specific and actionable, not generic platitudes
4. Be 10-40 words, written as a concrete idea statement (not a question)
5. Cover diverse angles — don't cluster suggestions around a single theme

Respond with valid JSON in this exact format:
{
  "suggestions": [
    { "content": "Concrete idea statement here.", "rationale": "1-sentence reason this is worth exploring." }
  ]
}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: `You are an expert facilitator and ideation specialist. You generate net-new, diverse, concrete ideas that build on what a cohort has already produced — never duplicating their existing ideas.

${PROMPT_INJECTION_GUARD}`,
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 8192,
      });

      const responseText = completion.choices[0].message.content;
      if (!responseText) {
        throw new Error("No response from OpenAI");
      }

      let parsedResult: unknown;
      try {
        parsedResult = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      const validationResult = suggestIdeasResponseSchema.safeParse(parsedResult);
      if (!validationResult.success) {
        throw new Error(`Invalid response format: ${validationResult.error.message}`);
      }

      // Deduplicate against existing ideas (case-insensitive, normalized)
      const norm = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
      const existingNorm = new Set(params.existingIdeas.map(norm));
      const seen = new Set<string>();
      const filtered: IdeaSuggestion[] = [];
      for (const s of validationResult.data.suggestions) {
        const key = norm(s.content);
        if (!key || existingNorm.has(key) || seen.has(key)) continue;
        seen.add(key);
        filtered.push({ content: s.content.trim(), rationale: s.rationale?.trim() || undefined });
      }

      const usage = extractUsageMetrics(completion);
      if (usage && context) {
        await logAiUsage({
          organizationId: context.organizationId,
          spaceId: context.spaceId,
          userId: context.userId,
          modelName: "gpt-5",
          operation: "suggest_ideas",
          usage,
          metadata: {
            existingIdeaCount: params.existingIdeas.length,
            kbSnippetCount: params.knowledgeBaseSnippets?.length ?? 0,
            requested: target,
            returned: filtered.length,
            duplicatesFiltered: validationResult.data.suggestions.length - filtered.length,
            attempt: attempt + 1,
          },
        });
      }

      return { suggestions: filtered };

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Suggest ideas attempt ${attempt + 1} failed:`, lastError.message);

      if (attempt === maxRetries) break;

      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  throw new Error(`Failed to suggest ideas after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`);
}
