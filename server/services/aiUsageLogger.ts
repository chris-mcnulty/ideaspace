import { db } from "../db";
import { aiUsageLog, type InsertAiUsageLog } from "../../shared/schema";

/**
 * AI Usage Logger Service
 * Tracks OpenAI API usage for monitoring and cost management
 */

// GPT-5 pricing (as of August 2025)
const GPT5_INPUT_COST_PER_1M = 5.00; // $5.00 per 1M input tokens
const GPT5_OUTPUT_COST_PER_1M = 15.00; // $15.00 per 1M output tokens

interface UsageMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface LogUsageParams {
  organizationId?: string;
  spaceId?: string;
  userId?: string;
  modelName: string;
  operation: string;
  usage: UsageMetrics;
  metadata?: Record<string, any>;
}

/**
 * Calculate estimated cost in cents based on token usage
 */
function calculateCost(modelName: string, usage: UsageMetrics): number {
  if (modelName === "gpt-5") {
    const inputCost = (usage.promptTokens / 1_000_000) * GPT5_INPUT_COST_PER_1M;
    const outputCost = (usage.completionTokens / 1_000_000) * GPT5_OUTPUT_COST_PER_1M;
    const totalDollars = inputCost + outputCost;
    return Math.round(totalDollars * 100); // Convert to cents
  }
  return 0;
}

/**
 * Log AI usage to database
 */
export async function logAiUsage(params: LogUsageParams): Promise<void> {
  const {
    organizationId,
    spaceId,
    userId,
    modelName,
    operation,
    usage,
    metadata,
  } = params;

  const estimatedCostCents = calculateCost(modelName, usage);

  const logEntry: InsertAiUsageLog = {
    organizationId: organizationId || null,
    spaceId: spaceId || null,
    userId: userId || null,
    modelName,
    operation,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    estimatedCostCents,
    metadata: metadata || null,
  };

  try {
    await db.insert(aiUsageLog).values(logEntry);
  } catch (error) {
    // Log errors but don't throw - usage tracking shouldn't break the main flow
    console.error("[AI Usage Logger] Failed to log usage:", error);
  }
}

/**
 * Helper to extract usage from OpenAI response
 */
export function extractUsageMetrics(response: any): UsageMetrics | null {
  if (!response?.usage) {
    return null;
  }

  return {
    promptTokens: response.usage.prompt_tokens || 0,
    completionTokens: response.usage.completion_tokens || 0,
    totalTokens: response.usage.total_tokens || 0,
  };
}
