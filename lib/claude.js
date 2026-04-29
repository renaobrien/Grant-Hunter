const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

async function ask(systemPrompt, userMessage, { useSearch = false } = {}) {
  const params = {
    model: MODEL,
    max_tokens: 16000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  };

  if (useSearch) {
    params.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
  }

  const response = await client.messages.create(params);

  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n');

  if (!text.trim()) {
    throw new Error(`No text in API response (stop_reason: ${response.stop_reason})`);
  }

  return { text, usage: response.usage };
}

module.exports = { ask, MODEL };
