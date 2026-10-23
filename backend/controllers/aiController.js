const { generateText, validateAiConfig, AiServiceError } = require("../services/aiService");
const { getAiConfig } = require("../config/aiConfig");

// Simple in-memory rate limiter for the test endpoint to prevent abuse and unexpected API costs
// Map<userId, Array<timestampMs>>
const rateLimitMap = new Map();
const MAX_REQUESTS_PER_WINDOW = 5;
const WINDOW_MS = 60 * 1000; // 1 minute

function isRateLimited(userId) {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const timestamps = rateLimitMap.get(userId) || [];
  const recent = timestamps.filter((t) => t > windowStart);

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    rateLimitMap.set(userId, recent);
    return true;
  }

  recent.push(now);
  rateLimitMap.set(userId, recent);
  return false;
}

// Maximum allowed character length for integration test prompts
const MAX_TEST_PROMPT_LENGTH = 500;

/**
 * POST /api/ai/test
 * Sends a short test prompt to the configured AI provider and returns the response.
 * Requires authentication.
 */
async function testAiConnection(req, res) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  // Check rate limiting
  if (isRateLimited(userId)) {
    return res.status(429).json({
      success: false,
      message: "Rate limit exceeded for AI test requests. Please wait a minute before trying again.",
      code: "RATE_LIMIT_EXCEEDED",
    });
  }

  // Validate prompt input
  let prompt = req.body?.prompt;
  if (prompt !== undefined && prompt !== null) {
    if (typeof prompt !== "string") {
      return res.status(400).json({
        success: false,
        message: "Prompt must be a string.",
      });
    }

    prompt = prompt.trim();
    if (prompt.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Prompt cannot be empty.",
      });
    }

    if (prompt.length > MAX_TEST_PROMPT_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Test prompt cannot exceed ${MAX_TEST_PROMPT_LENGTH} characters.`,
      });
    }
  } else {
    // Default synthetic test prompt
    prompt = "SkillLens AI integration verification test. Please confirm receipt in one concise sentence.";
  }

  try {
    const result = await generateText({
      prompt,
      maxTokens: 150,
      temperature: 0.3,
      timeoutMs: 25000,
    });

    return res.status(200).json({
      success: true,
      data: {
        message: "AI service is working.",
        response: result.text,
        model: result.model,
      },
    });
  } catch (error) {
    if (error instanceof AiServiceError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while communicating with the AI service.",
    });
  }
}

/**
 * GET /api/ai/status
 * Returns safe status about AI service configuration without exposing keys.
 * Requires authentication.
 */
function getAiStatus(req, res) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const config = getAiConfig();
  const validation = validateAiConfig();

  return res.status(200).json({
    success: true,
    data: {
      provider: config.provider,
      configured: validation.valid,
      model: config.model,
    },
  });
}

// Clean up old rate limit entries every 10 minutes
setInterval(() => {
  const windowStart = Date.now() - WINDOW_MS;
  for (const [userId, timestamps] of rateLimitMap.entries()) {
    const valid = timestamps.filter((t) => t > windowStart);
    if (valid.length === 0) {
      rateLimitMap.delete(userId);
    } else {
      rateLimitMap.set(userId, valid);
    }
  }
}, 10 * 60 * 1000).unref();

module.exports = {
  testAiConnection,
  getAiStatus,
  // Export for testing
  isRateLimited,
  rateLimitMap,
  MAX_TEST_PROMPT_LENGTH,
};
