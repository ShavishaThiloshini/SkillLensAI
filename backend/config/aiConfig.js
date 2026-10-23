/**
 * SkillLens AI — AI Provider Configuration
 * Encapsulates environment configuration for external AI services.
 * Keeps credentials server-side and never exposes secrets.
 */

function getAiConfig() {
  const apiKey = (process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "").trim();
  const model = (process.env.AI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
  const parsedTimeout = parseInt(process.env.AI_TIMEOUT_MS, 10);
  const timeoutMs = !isNaN(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 30000;

  return {
    provider: "openai",
    apiKey,
    model: model || "gpt-4o-mini",
    timeoutMs,
    isConfigured: Boolean(apiKey),
  };
}

/**
 * Validates whether the required AI configuration is present.
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAiConfig() {
  const config = getAiConfig();
  if (!config.apiKey) {
    return {
      valid: false,
      error: "AI service is not configured. Missing API key.",
    };
  }
  return { valid: true };
}

module.exports = {
  getAiConfig,
  validateAiConfig,
};
