import api from './api'

/**
 * SkillLens AI — AI API Service (Frontend Client)
 * Communicates with backend AI integration endpoints.
 * Credentials and provider secrets remain strictly on the backend.
 */

/**
 * Tests the connection to the configured AI provider.
 *
 * @param {string} [prompt] - Optional custom test prompt
 * @returns {Promise<{ success: boolean, data: { message: string, response: string, model: string } }>}
 */
export async function testAiConnection(prompt) {
  const payload = prompt ? { prompt } : {}
  const response = await api.post('/ai/test', payload, {
    timeout: 30000, // Allow up to 30s for LLM generation
  })
  return response.data
}

/**
 * Checks whether the AI provider is configured on the backend.
 *
 * @returns {Promise<{ success: boolean, data: { provider: string, configured: boolean, model: string } }>}
 */
export async function getAiStatus() {
  const response = await api.get('/ai/status')
  return response.data
}
