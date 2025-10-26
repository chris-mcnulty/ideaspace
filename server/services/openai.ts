import OpenAI from "openai";

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

export async function categorizeNotes(notes: Note[]): Promise<CategorizationResponse> {
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

Instructions:
1. Identify 3-7 main themes/categories that emerge from these notes
2. Assign each note to the most relevant category
3. Use clear, concise category names (2-4 words max)
4. Provide a brief summary of the key themes discovered

Respond with valid JSON in this exact format:
{
  "categories": [
    { "noteId": "note-id-here", "category": "Category Name" }
  ],
  "summary": "Brief overview of the main themes identified"
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: "You are an expert facilitator and thematic analyst. You excel at identifying patterns and grouping ideas into coherent categories."
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

  const result = JSON.parse(responseText) as CategorizationResponse;
  return result;
}
