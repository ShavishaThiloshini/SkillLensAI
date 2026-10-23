const OpenAI = require("openai");
const { getAiConfig, validateAiConfig } = require("../config/aiConfig");

/**
 * SkillLens AI — Custom AI Service Error
 */
class AiServiceError extends Error {
  constructor(message, statusCode = 500, code = "AI_SERVICE_ERROR", originalError = null) {
    super(message);
    this.name = "AiServiceError";
    this.statusCode = statusCode;
    this.code = code;
    // Keep internal details server-side only; never leak outside
    this.internalCode = originalError?.code || originalError?.type || null;
  }
}

// Singleton cached client
let clientInstance = null;

/**
 * Returns an OpenAI API client instance, caching it across calls.
 * Allows injecting a mock client for testing via setClient().
 */
function getClient() {
  if (clientInstance) {
    return clientInstance;
  }

  const config = getAiConfig();
  if (!config.apiKey) {
    throw new AiServiceError(
      "AI service is not configured. Missing API key.",
      503,
      "MISSING_API_KEY"
    );
  }

  clientInstance = new OpenAI({
    apiKey: config.apiKey,
    timeout: config.timeoutMs,
    maxRetries: 1, // Single fast retry for transient network glitches
  });

  return clientInstance;
}

/**
 * Allows injecting a custom or mock client for automated testing.
 */
function setClient(mockClient) {
  clientInstance = mockClient;
}

/**
 * Resets the client instance so next call initializes fresh configuration.
 */
function resetClient() {
  clientInstance = null;
}

/**
 * Normalizes provider errors into safe, consistent AiServiceError instances.
 * Prevents leaking private credentials, raw traces, or internal error schemas.
 */
function normalizeProviderError(err) {
  // Already normalized
  if (err instanceof AiServiceError) {
    return err;
  }

  const status = err.status || err.statusCode;
  const errCode = err.code || err.type;
  const errMsg = (err.message || "").toLowerCase();

  // Authentication Failure (Invalid API Key)
  if (status === 401 || err.name === "AuthenticationError" || errMsg.includes("api key") || errMsg.includes("incorrect api key")) {
    return new AiServiceError(
      "AI provider authentication failed. Please check backend API key configuration.",
      502,
      "PROVIDER_AUTHENTICATION_ERROR",
      err
    );
  }

  // Rate Limiting or Quota Exceeded
  if (status === 429 || err.name === "RateLimitError" || errCode === "insufficient_quota" || errMsg.includes("quota")) {
    return new AiServiceError(
      "AI provider rate limit reached or quota exceeded. Please try again shortly.",
      429,
      "RATE_LIMIT_EXCEEDED",
      err
    );
  }

  // Request Timeout
  if (
    err.name === "APIConnectionTimeoutError" ||
    errCode === "ETIMEDOUT" ||
    err.name === "AbortError" ||
    errMsg.includes("timed out") ||
    errMsg.includes("timeout")
  ) {
    return new AiServiceError(
      "AI request timed out. Please try again.",
      504,
      "REQUEST_TIMEOUT",
      err
    );
  }

  // Network / Connection Error
  if (
    err.name === "APIConnectionError" ||
    errCode === "ECONNREFUSED" ||
    errCode === "ENOTFOUND" ||
    errCode === "EAI_AGAIN" ||
    errMsg.includes("connection error") ||
    errMsg.includes("enotfound")
  ) {
    return new AiServiceError(
      "Unable to reach the AI provider. Please verify network connectivity.",
      502,
      "NETWORK_ERROR",
      err
    );
  }

  // Provider Service Down / 5xx
  if (status >= 500 && status < 600) {
    return new AiServiceError(
      "The external AI provider is currently experiencing issues. Please try again later.",
      502,
      "PROVIDER_SERVER_ERROR",
      err
    );
  }

  // Generic fallback
  return new AiServiceError(
    "An unexpected error occurred while communicating with the AI provider.",
    500,
    "AI_SERVICE_ERROR",
    err
  );
}

/**
 * Reusable function to send a text-based request to the configured AI provider.
 *
 * @param {string|object} options - Prompt string or options object:
 *   - prompt: string (required)
 *   - systemPrompt?: string
 *   - model?: string
 *   - temperature?: number (0.0 to 2.0)
 *   - maxTokens?: number
 *   - timeoutMs?: number
 * @returns {Promise<{ success: boolean, text: string, model: string, usage: object }>}
 */
async function generateText(options) {
  const opts = typeof options === "string" ? { prompt: options } : options || {};
  const { prompt, systemPrompt, temperature = 0.2, maxTokens = 1000 } = opts;

  // Validate prompt
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    throw new AiServiceError("Prompt is required and must be a non-empty string.", 400, "INVALID_PROMPT");
  }

  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length > 30000) {
    throw new AiServiceError("Prompt exceeds maximum allowed length of 30,000 characters.", 400, "PROMPT_TOO_LONG");
  }

  const config = getAiConfig();
  const modelToUse = (opts.model || config.model || "gpt-4o-mini").trim();
  const requestTimeout = typeof opts.timeoutMs === "number" && opts.timeoutMs > 0 ? opts.timeoutMs : config.timeoutMs;

  const messages = [];
  if (systemPrompt && typeof systemPrompt === "string" && systemPrompt.trim()) {
    messages.push({
      role: "system",
      content: systemPrompt.trim(),
    });
  }
  messages.push({
    role: "user",
    content: trimmedPrompt,
  });

  try {
    const client = getClient();

    const response = await client.chat.completions.create(
      {
        model: modelToUse,
        messages,
        temperature: Math.min(Math.max(temperature, 0), 2),
        max_tokens: maxTokens,
      },
      {
        timeout: requestTimeout,
      }
    );

    const completionText = response?.choices?.[0]?.message?.content;
    if (typeof completionText !== "string" || !completionText.trim()) {
      throw new AiServiceError(
        "AI provider returned an empty or invalid response.",
        502,
        "EMPTY_RESPONSE"
      );
    }

    return {
      success: true,
      text: completionText.trim(),
      model: response.model || modelToUse,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
  } catch (err) {
    // Sanitize logging: do not log the prompt or response
    console.error("[AiService] Provider call failed:", err.name || "Error", err.code || "");
    throw normalizeProviderError(err);
  }
}

module.exports = {
  generateText,
  validateAiConfig,
  getClient,
  setClient,
  resetClient,
  AiServiceError,
};
