import OpenAI from "openai";
import { z } from "zod";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

export interface Note {
  id: string;
  content: string;
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

export async function categorizeNotes(notes: Note[], maxRetries = 2): Promise<CategorizationResponse> {
  if (notes.length === 0) {
    return {
      categories: [],
      summary: "No notes to categorize."
    };
  }

  const prompt = `You are an expert facilitator analyzing ideas from a collaborative envisioning session. 

Your task: Analyze the following sticky notes and group them into meaningful categories/themes.

NOTES:
${notes.map((note, idx) => `${idx + 1}. [ID: ${note.id}] ${note.content}`).join('\n')}

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
            content: "You are an expert facilitator and thematic analyst. You excel at identifying patterns and grouping ideas into coherent categories. You ALWAYS categorize every single note provided."
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

      const noteIds = new Set(notes.map(n => n.id));
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
