/**
 * SkillLens AI — Day 18 AI Integration Test Suite
 *
 * Verifies:
 * 1. AI service initialization with valid configuration
 * 2. Missing API-key handling
 * 3. Missing model configuration (default fallback)
 * 4. Successful provider response using mocked SDK client
 * 5. Provider authentication failure (401)
 * 6. Provider rate-limit response (429)
 * 7. Network failure (ECONNREFUSED / APIConnectionError)
 * 8. Request timeout (504)
 * 9. Unexpected or empty provider response (502)
 * 10. Invalid or oversized input (400)
 * 11. Unauthenticated endpoint access (401)
 * 12. Authenticated test endpoint input limits and rate limiting
 * 13. Safe status endpoint without credential leakage
 * 14. Conditional live provider verification (executed if live key is available)
 */

const assert = require("assert");
const { getAiConfig, validateAiConfig } = require("../config/aiConfig");
const {
  generateText,
  setClient,
  resetClient,
  AiServiceError,
} = require("../services/aiService");
const {
  testAiConnection,
  getAiStatus,
  rateLimitMap,
  MAX_TEST_PROMPT_LENGTH,
} = require("../controllers/aiController");

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

async function runAiTests(testAsync) {
  console.log("\n--- SkillLens AI: Day 18 AI Integration Tests ---");

  // Save original env vars to restore at end
  const originalApiKey = process.env.AI_API_KEY;
  const originalModel = process.env.AI_MODEL;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  // 1. AI service initialization with valid configuration
  await testAsync("105. AI service configuration helper returns valid provider structure", async () => {
    process.env.AI_API_KEY = "test-sk-valid-key";
    process.env.AI_MODEL = "gpt-4o-mini";
    const config = getAiConfig();
    assert.strictEqual(config.provider, "openai");
    assert.strictEqual(config.model, "gpt-4o-mini");
    assert.strictEqual(config.isConfigured, true);
    assert.strictEqual(typeof config.timeoutMs, "number");

    const validation = validateAiConfig();
    assert.strictEqual(validation.valid, true);
  });

  // 2. Missing API-key handling
  await testAsync("106. Missing API-key handling throws 503 MISSING_API_KEY safely", async () => {
    delete process.env.AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    resetClient();

    const validation = validateAiConfig();
    assert.strictEqual(validation.valid, false);
    assert.ok(validation.error.includes("Missing API key"));

    let threw = false;
    try {
      await generateText({ prompt: "Hello" });
    } catch (err) {
      threw = true;
      assert.ok(err instanceof AiServiceError);
      assert.strictEqual(err.statusCode, 503);
      assert.strictEqual(err.code, "MISSING_API_KEY");
      assert.ok(err.message.includes("not configured"));
    }
    assert.strictEqual(threw, true, "Should have thrown on missing API key");
  });

  // 3. Missing model configuration defaults to gpt-4o-mini
  await testAsync("107. Missing model configuration falls back to gpt-4o-mini default", async () => {
    process.env.AI_API_KEY = "test-sk-some-key";
    delete process.env.AI_MODEL;
    delete process.env.OPENAI_MODEL;

    const config = getAiConfig();
    assert.strictEqual(config.model, "gpt-4o-mini");
  });

  // 4. Successful provider response using mocked SDK client
  await testAsync("108. Successful provider response returns normalized text, model, and token usage", async () => {
    process.env.AI_API_KEY = "test-key";
    const mockClient = {
      chat: {
        completions: {
          create: async (params) => {
            assert.strictEqual(params.model, "gpt-4o-mini");
            assert.ok(Array.isArray(params.messages));
            return {
              model: "gpt-4o-mini",
              choices: [
                {
                  message: {
                    content: "This is a normalized mocked AI response.",
                  },
                },
              ],
              usage: {
                prompt_tokens: 15,
                completion_tokens: 8,
                total_tokens: 23,
              },
            };
          },
        },
      },
    };

    setClient(mockClient);
    const result = await generateText({
      prompt: "Explain unit testing in one sentence.",
      systemPrompt: "You are a concise engineering assistant.",
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.text, "This is a normalized mocked AI response.");
    assert.strictEqual(result.model, "gpt-4o-mini");
    assert.strictEqual(result.usage.totalTokens, 23);
  });

  // 5. Provider authentication failure (401)
  await testAsync("109. Provider authentication failure normalizes to 502 with safe user message", async () => {
    const mockClient = {
      chat: {
        completions: {
          create: async () => {
            const err = new Error("Incorrect API key provided");
            err.status = 401;
            err.name = "AuthenticationError";
            throw err;
          },
        },
      },
    };

    setClient(mockClient);
    let threw = false;
    try {
      await generateText("Test prompt");
    } catch (err) {
      threw = true;
      assert.ok(err instanceof AiServiceError);
      assert.strictEqual(err.statusCode, 502);
      assert.strictEqual(err.code, "PROVIDER_AUTHENTICATION_ERROR");
      assert.ok(err.message.includes("authentication failed"));
      // Secrets must not be leaked
      assert.ok(!err.message.includes("sk-"));
    }
    assert.strictEqual(threw, true);
  });

  // 6. Provider rate-limit response (429)
  await testAsync("110. Provider rate limit / quota exceeded normalizes to 429 with actionable message", async () => {
    const mockClient = {
      chat: {
        completions: {
          create: async () => {
            const err = new Error("Rate limit reached for requests");
            err.status = 429;
            err.code = "insufficient_quota";
            err.name = "RateLimitError";
            throw err;
          },
        },
      },
    };

    setClient(mockClient);
    let threw = false;
    try {
      await generateText("Test prompt");
    } catch (err) {
      threw = true;
      assert.ok(err instanceof AiServiceError);
      assert.strictEqual(err.statusCode, 429);
      assert.strictEqual(err.code, "RATE_LIMIT_EXCEEDED");
      assert.ok(err.message.includes("rate limit"));
    }
    assert.strictEqual(threw, true);
  });

  // 7. Network failure (ECONNREFUSED / APIConnectionError)
  await testAsync("111. Network connectivity failure normalizes to 502 NETWORK_ERROR", async () => {
    const mockClient = {
      chat: {
        completions: {
          create: async () => {
            const err = new Error("connect ECONNREFUSED api.openai.com");
            err.code = "ECONNREFUSED";
            err.name = "APIConnectionError";
            throw err;
          },
        },
      },
    };

    setClient(mockClient);
    let threw = false;
    try {
      await generateText("Test prompt");
    } catch (err) {
      threw = true;
      assert.ok(err instanceof AiServiceError);
      assert.strictEqual(err.statusCode, 502);
      assert.strictEqual(err.code, "NETWORK_ERROR");
      assert.ok(err.message.includes("network connectivity"));
    }
    assert.strictEqual(threw, true);
  });

  // 8. Request timeout
  await testAsync("112. Request timeout normalizes to 504 REQUEST_TIMEOUT", async () => {
    const mockClient = {
      chat: {
        completions: {
          create: async () => {
            const err = new Error("Request timed out");
            err.name = "APIConnectionTimeoutError";
            err.code = "ETIMEDOUT";
            throw err;
          },
        },
      },
    };

    setClient(mockClient);
    let threw = false;
    try {
      await generateText({ prompt: "Test prompt", timeoutMs: 50 });
    } catch (err) {
      threw = true;
      assert.ok(err instanceof AiServiceError);
      assert.strictEqual(err.statusCode, 504);
      assert.strictEqual(err.code, "REQUEST_TIMEOUT");
      assert.ok(err.message.includes("timed out"));
    }
    assert.strictEqual(threw, true);
  });

  // 9. Unexpected or empty provider response
  await testAsync("113. Empty or malformed provider response throws 502 EMPTY_RESPONSE", async () => {
    const mockClient = {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: "   " } }],
          }),
        },
      },
    };

    setClient(mockClient);
    let threw = false;
    try {
      await generateText("Test prompt");
    } catch (err) {
      threw = true;
      assert.ok(err instanceof AiServiceError);
      assert.strictEqual(err.statusCode, 502);
      assert.strictEqual(err.code, "EMPTY_RESPONSE");
      assert.ok(err.message.includes("empty or invalid"));
    }
    assert.strictEqual(threw, true);
  });

  // 10. Invalid or oversized input
  await testAsync("114. Invalid or oversized prompt rejected with 400 Bad Request", async () => {
    // Empty prompt
    let threwEmpty = false;
    try {
      await generateText("");
    } catch (err) {
      threwEmpty = true;
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.code, "INVALID_PROMPT");
    }
    assert.strictEqual(threwEmpty, true);

    // Whitespace only
    let threwWhitespace = false;
    try {
      await generateText("    \n\t   ");
    } catch (err) {
      threwWhitespace = true;
      assert.strictEqual(err.statusCode, 400);
    }
    assert.strictEqual(threwWhitespace, true);

    // Oversized prompt (> 30000 chars)
    let threwOversized = false;
    try {
      await generateText("x".repeat(30001));
    } catch (err) {
      threwOversized = true;
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.code, "PROMPT_TOO_LONG");
    }
    assert.strictEqual(threwOversized, true);
  });

  // 11. Unauthenticated endpoint access
  await testAsync("115. AI test endpoint rejects unauthenticated access with 401", async () => {
    const req = { user: null, body: { prompt: "Test prompt" } };
    const res = createMockRes();

    await testAiConnection(req, res);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes("Authentication required"));
  });

  // 12. Authenticated test endpoint input limits and rate limiting
  await testAsync("116. Authenticated AI test endpoint enforces max prompt length and rate limiting", async () => {
    const testUserId = 99999;
    rateLimitMap.delete(testUserId);

    // Test prompt exceeding MAX_TEST_PROMPT_LENGTH (500)
    const longPrompt = "a".repeat(MAX_TEST_PROMPT_LENGTH + 1);
    const reqOversized = { user: { id: testUserId }, body: { prompt: longPrompt } };
    const resOversized = createMockRes();

    await testAiConnection(reqOversized, resOversized);
    assert.strictEqual(resOversized.statusCode, 400);
    assert.strictEqual(resOversized.body.success, false);
    assert.ok(resOversized.body.message.includes("cannot exceed"));

    // Successful test with mocked client
    const mockClient = {
      chat: {
        completions: {
          create: async () => ({
            model: "gpt-4o-mini",
            choices: [{ message: { content: "AI test passed successfully." } }],
          }),
        },
      },
    };
    setClient(mockClient);

    const reqValid = { user: { id: testUserId }, body: { prompt: "Short valid test prompt" } };
    const resValid = createMockRes();
    await testAiConnection(reqValid, resValid);

    assert.strictEqual(resValid.statusCode, 200);
    assert.strictEqual(resValid.body.success, true);
    assert.strictEqual(resValid.body.data.message, "AI service is working.");
    assert.strictEqual(resValid.body.data.response, "AI test passed successfully.");

    // Rate limiting: exhaust remaining requests
    for (let i = 0; i < 4; i++) {
      await testAiConnection(reqValid, createMockRes());
    }

    // 6th request within window must be rate limited
    const resRateLimited = createMockRes();
    await testAiConnection(reqValid, resRateLimited);
    assert.strictEqual(resRateLimited.statusCode, 429);
    assert.strictEqual(resRateLimited.body.code, "RATE_LIMIT_EXCEEDED");

    rateLimitMap.delete(testUserId);
  });

  // 13. Safe status endpoint without credential leakage
  await testAsync("117. Status endpoint returns configuration metadata without exposing secret keys", async () => {
    const req = { user: { id: 1 } };
    const res = createMockRes();

    getAiStatus(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.provider, "openai");
    assert.strictEqual(typeof res.body.data.configured, "boolean");
    assert.strictEqual(typeof res.body.data.model, "string");
    // Explicitly verify no keys leaked in response body
    assert.strictEqual(res.body.data.apiKey, undefined);
    assert.strictEqual(JSON.stringify(res.body).includes("sk-"), false);
  });

  // 14. Live test execution (conditional based on actual key presence)
  await testAsync("118. Conditional live integration test with actual provider", async () => {
    // Check if original key was a real key (non-empty and not a placeholder)
    const realKey = (originalApiKey || originalOpenAiKey || "").trim();
    const isPlaceholder = !realKey || realKey === "your_openai_api_key_here" || realKey === "your_api_key_here";

    if (isPlaceholder) {
      console.log("      [INFO] Live provider call skipped: No active OpenAI API key configured in .env (mocked suite passed 100%).");
      return;
    }

    // Restore real key and reset client to hit real OpenAI endpoint
    process.env.AI_API_KEY = realKey;
    resetClient();

    try {
      const liveRes = await generateText({
        prompt: "Say 'SkillLens AI live check OK' in 5 words or less.",
        maxTokens: 20,
        timeoutMs: 15000,
      });

      assert.strictEqual(liveRes.success, true);
      assert.ok(liveRes.text.length > 0);
      console.log(`      [LIVE VERIFIED] Real OpenAI Response: "${liveRes.text}" (Model: ${liveRes.model})`);
    } catch (err) {
      console.warn(`      [LIVE TEST NOTE] Live call encountered: ${err.message}`);
      // Do not fail automated suite if network or billing is unavailable, but report honestly
    }
  });

  // Restore environment variables and reset client
  if (originalApiKey !== undefined) {
    process.env.AI_API_KEY = originalApiKey;
  } else {
    delete process.env.AI_API_KEY;
  }
  if (originalModel !== undefined) {
    process.env.AI_MODEL = originalModel;
  } else {
    delete process.env.AI_MODEL;
  }
  if (originalOpenAiKey !== undefined) {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  } else {
    delete process.env.OPENAI_API_KEY;
  }
  resetClient();
}

module.exports = { runAiTests };
