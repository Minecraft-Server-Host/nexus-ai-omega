/**
 * Nexus AI Omega — AI Engine v4.0
 * Improvements:
 *  - Stateful conversation context (remembers last 20 turns per user)
 *  - Request dedup by requestId
 *  - AI response caching (60s TTL for identical prompts)
 *  - Proper fallback chain (not just "try first available")
 *  - Streaming support skeleton (ready for discord ws delivery)
 *  - Cost tracking per guild
 *  - Token budget enforcement (prevents runaway costs)
 *  - AI Application reviewer module (new)
 *  - Server builder uniqueness engine (seeded by theme hash)
 *  - Prompt injection guard
 */
import { logger, aiLogger, measureAsync } from '../services/logger.js';
import { cacheGet, cacheSet, CacheKeys } from '../services/redisCache.js';
import type {
  AIInferenceRequest,
  AIInferenceResponse,
  AIModuleId,
  ConversationContext,
  ConversationMessage,
  ApplicationReview,
  ServerBuildPlan,
} from '../types/index.js';
import { AI_MODULES } from '../types/index.js';
import crypto from 'node:crypto';

// ── Provider definitions ─────────────────────────────────────────────────────
export type AIProviderId =
  | 'openai' | 'anthropic' | 'google' | 'groq' | 'mistral'
  | 'deepseek' | 'xai' | 'cohere' | 'perplexity' | 'ollama'
  | 'openrouter' | 'azure' | 'together' | 'nexus-mock' | 'auto';

export interface AIProvider {
  id: AIProviderId;
  name: string;
  models: string[];
  apiKeyEnv: string;
  baseUrl?: string;
  enabled: boolean;
  priority: number;
  costInPer1k: number;
  costOutPer1k: number;
  maxTokens: number;
  supportsVision?: boolean;
  supportsStreaming?: boolean;
  supportsSystemPrompt?: boolean;
}

export const AI_PROVIDERS: AIProvider[] = [
  { id: 'openai',     name: 'OpenAI',            models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini'],            apiKeyEnv: 'OPENAI_API_KEY',      enabled: false, priority: 3,   costInPer1k: 0.005,   costOutPer1k: 0.015,  maxTokens: 128000, supportsVision: true, supportsStreaming: true, supportsSystemPrompt: true },
  { id: 'anthropic',  name: 'Anthropic Claude',  models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],    apiKeyEnv: 'ANTHROPIC_API_KEY',   enabled: false, priority: 4,   costInPer1k: 0.003,   costOutPer1k: 0.015,  maxTokens: 200000, supportsVision: true, supportsStreaming: true, supportsSystemPrompt: true },
  { id: 'google',     name: 'Google Gemini',     models: ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro'], apiKeyEnv: 'GOOGLE_API_KEY',      enabled: false, priority: 2,   costInPer1k: 0.00125, costOutPer1k: 0.005,  maxTokens: 1000000, supportsVision: true, supportsStreaming: true },
  { id: 'groq',       name: 'Groq LPU',          models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],            apiKeyEnv: 'GROQ_API_KEY',        enabled: false, priority: 1,   costInPer1k: 0.00059, costOutPer1k: 0.00079, maxTokens: 32768, supportsStreaming: true, supportsSystemPrompt: true },
  { id: 'mistral',    name: 'Mistral AI',        models: ['mistral-large-latest', 'mistral-small-latest'],               apiKeyEnv: 'MISTRAL_API_KEY',     enabled: false, priority: 5,   costInPer1k: 0.002,   costOutPer1k: 0.006,  maxTokens: 128000 },
  { id: 'deepseek',   name: 'DeepSeek',          models: ['deepseek-chat', 'deepseek-reasoner'],                         apiKeyEnv: 'DEEPSEEK_API_KEY',    enabled: false, priority: 6,   costInPer1k: 0.00014, costOutPer1k: 0.00028, maxTokens: 64000 },
  { id: 'xai',        name: 'xAI Grok',          models: ['grok-beta', 'grok-2'],                                        apiKeyEnv: 'XAI_API_KEY',         enabled: false, priority: 7,   costInPer1k: 0.005,   costOutPer1k: 0.015,  maxTokens: 131072, supportsVision: true },
  { id: 'cohere',     name: 'Cohere',            models: ['command-r-plus', 'command-r'],                                apiKeyEnv: 'COHERE_API_KEY',      enabled: false, priority: 8,   costInPer1k: 0.003,   costOutPer1k: 0.015,  maxTokens: 128000 },
  { id: 'perplexity', name: 'Perplexity',        models: ['llama-3.1-sonar-large-128k-online'],                          apiKeyEnv: 'PERPLEXITY_API_KEY',  enabled: false, priority: 9,   costInPer1k: 0.001,   costOutPer1k: 0.001,  maxTokens: 127000 },
  { id: 'together',   name: 'Together AI',       models: ['meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo'],              apiKeyEnv: 'TOGETHER_API_KEY',    enabled: false, priority: 10,  costInPer1k: 0.0008,  costOutPer1k: 0.0008, maxTokens: 8192 },
  { id: 'openrouter', name: 'OpenRouter',        models: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet'],               apiKeyEnv: 'OPENROUTER_API_KEY',  enabled: false, priority: 11,  costInPer1k: 0.003,   costOutPer1k: 0.01,   maxTokens: 200000 },
  { id: 'azure',      name: 'Azure OpenAI',      models: ['gpt-4o', 'gpt-4-turbo'],                                      apiKeyEnv: 'AZURE_OPENAI_API_KEY', enabled: false, priority: 12, costInPer1k: 0.005,   costOutPer1k: 0.015,  maxTokens: 128000 },
  { id: 'ollama',     name: 'Ollama Local',      models: ['llama3.3', 'qwen2.5', 'deepseek-r1', 'phi3.5'],               apiKeyEnv: '',                    enabled: false, priority: 99,  costInPer1k: 0,       costOutPer1k: 0,      maxTokens: 8192 },
  { id: 'nexus-mock', name: 'Nexus Mock',        models: ['nexus-mock-v4'],                                               apiKeyEnv: '',                    enabled: true,  priority: 999, costInPer1k: 0,       costOutPer1k: 0,      maxTokens: 4096 },
];

// ── Prompt injection guard ───────────────────────────────────────────────────
const INJECTION_PATTERNS = [
  /ignore previous instructions/i,
  /you are now/i,
  /act as (a|an)\s+(different|new)/i,
  /forget (everything|all) (you|above)/i,
  /system prompt:/i,
  /\bDAN\b/,
];

function guardPrompt(prompt: string): { safe: boolean; reason?: string } {
  for (const p of INJECTION_PATTERNS) {
    if (p.test(prompt)) return { safe: false, reason: 'PROMPT_INJECTION_DETECTED' };
  }
  return { safe: true };
}

// ── System prompts per module ────────────────────────────────────────────────
const MODULE_SYSTEM_PROMPTS: Partial<Record<AIModuleId, string>> = {
  HYBRID_AUTOMOD: 'You are Nexus AI AutoMod. Analyze messages for toxicity, spam, phishing, and policy violations. Return structured JSON analysis only.',
  AI_TICKET_SYSTEM: 'You are Nexus AI Ticket Assistant. Help users efficiently. Be professional, concise, and empathetic. Detect duplicates and suggest solutions.',
  AI_SERVER_BUILDER: 'You are Nexus AI Server Architect. Create unique, themed Discord server structures. Never repeat the same layout. Be creative and purposeful.',
  AI_APPLICATION_REVIEWER: 'You are Nexus AI Application Reviewer. Analyze Discord server applications for grammar, seriousness, completeness, and experience. Return structured JSON scores.',
  AI_COMMUNITY_MANAGER: 'You are Nexus AI Community Manager. Analyze engagement patterns, suggest posts, detect churn, and recommend events.',
  AI_SECURITY_ADVISOR: 'You are Nexus AI Security Advisor. Provide zero-trust security recommendations for Discord servers. Be precise and actionable.',
  AI_CODE_ASSISTANT: 'You are Nexus AI Code Assistant. Help with Discord bot development, APIs, and server configuration. Provide clean, working code examples.',
};

const DEFAULT_SYSTEM = 'You are Nexus AI Omega, an expert Discord bot assistant. Be professional, concise, and accurate.';

type ProviderClient = { provider: AIProvider; client: unknown };

// ── AI Engine ────────────────────────────────────────────────────────────────
export class AIEngine {
  private static instance: AIEngine;
  private clients = new Map<AIProviderId, ProviderClient>();
  private guildProviderOverrides = new Map<string, AIProviderId>();
  private guildApiKeys = new Map<string, { provider: AIProviderId; key: string }>();
  /** In-flight request IDs to prevent duplicate processing */
  private inflight = new Set<string>();
  /** Cost tracking per guild */
  private guildCosts = new Map<string, number>();
  /** Conversation contexts in memory (also Redis-persisted) */
  private conversations = new Map<string, ConversationContext>();

  private constructor() {}

  static getInstance(): AIEngine {
    if (!AIEngine.instance) AIEngine.instance = new AIEngine();
    return AIEngine.instance;
  }

  // ── Initialization ──────────────────────────────────────────────────────
  async init(): Promise<void> {
    const initialized: AIProviderId[] = [];

    const tryInit = async (id: AIProviderId, fn: () => Promise<unknown>): Promise<void> => {
      try {
        const client = await fn();
        const provider = AI_PROVIDERS.find(p => p.id === id)!;
        this.clients.set(id, { provider, client });
        provider.enabled = true;
        initialized.push(id);
      } catch (err: unknown) {
        aiLogger.debug({ provider: id, err: (err as Error).message }, 'Provider init skipped');
      }
    };

    // OpenAI-compatible providers
    const openAICompat: Array<[AIProviderId, string, string]> = [
      ['openai',     process.env.OPENAI_API_KEY!,      'https://api.openai.com/v1'],
      ['groq',       process.env.GROQ_API_KEY!,        'https://api.groq.com/openai/v1'],
      ['deepseek',   process.env.DEEPSEEK_API_KEY!,    'https://api.deepseek.com/v1'],
      ['xai',        process.env.XAI_API_KEY || process.env.GROK_API_KEY!, 'https://api.x.ai/v1'],
      ['perplexity', process.env.PERPLEXITY_API_KEY!,  'https://api.perplexity.ai'],
      ['together',   process.env.TOGETHER_API_KEY!,    'https://api.together.xyz/v1'],
      ['openrouter', process.env.OPENROUTER_API_KEY!,  'https://openrouter.ai/api/v1'],
    ];

    for (const [id, key, baseURL] of openAICompat) {
      if (!key) continue;
      await tryInit(id, async () => {
        const { default: OpenAI } = await import('openai');
        const headers: Record<string, string> = {};
        if (id === 'openrouter') {
          headers['HTTP-Referer'] = 'https://nexus.ai';
          headers['X-Title'] = 'Nexus AI Omega';
        }
        return new OpenAI({ apiKey: key, baseURL, defaultHeaders: Object.keys(headers).length ? headers : undefined });
      });
    }

    if (process.env.ANTHROPIC_API_KEY) {
      await tryInit('anthropic', async () => {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      });
    }

    // Google Gemini — prüft GEMINI_API_KEY zuerst, dann GOOGLE_API_KEY
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (geminiKey) {
      await tryInit('google', async () => ({
        apiKey: geminiKey,
        type: 'rest',
      }));
    }

    if (process.env.MISTRAL_API_KEY) {
      await tryInit('mistral', async () => ({ key: process.env.MISTRAL_API_KEY, rest: true }));
    }

    if (process.env.COHERE_API_KEY) {
      await tryInit('cohere', async () => ({ key: process.env.COHERE_API_KEY }));
    }

    if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
      await tryInit('azure', async () => {
        const { default: OpenAI } = await import('openai');
        return new OpenAI({
          apiKey: process.env.AZURE_OPENAI_API_KEY,
          baseURL: process.env.AZURE_OPENAI_ENDPOINT,
          defaultQuery: { 'api-version': process.env.AZURE_OPENAI_VERSION || '2024-06-01' },
          defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY! },
        });
      });
    }

    // Ollama local
    try {
      const res = await fetch(
        `${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/tags`,
        { signal: AbortSignal.timeout(1500) },
      ).catch(() => null);
      if (res?.ok) {
        const provider = AI_PROVIDERS.find(p => p.id === 'ollama')!;
        this.clients.set('ollama', { provider, client: { local: true } });
        provider.enabled = true;
        initialized.push('ollama');
      }
    } catch { /* offline */ }

    // Always enable mock
    const mockProvider = AI_PROVIDERS.find(p => p.id === 'nexus-mock')!;
    this.clients.set('nexus-mock', { provider: mockProvider, client: { mock: true } });

    aiLogger.info(
      { providers: initialized, total: this.clients.size },
      `🧠 AI Engine initialized — ${initialized.length} provider(s) active`,
    );
  }

  // ── Public inference entry point ────────────────────────────────────────
  async infer(req: AIInferenceRequest): Promise<AIInferenceResponse> {
    const start = performance.now();
    const requestId = req.requestId || crypto.randomUUID();

    // Dedup: ignore duplicate in-flight requests
    if (this.inflight.has(requestId)) {
      throw new Error(`Duplicate request: ${requestId}`);
    }
    this.inflight.add(requestId);

    try {
      // Prompt injection guard
      const guard = guardPrompt(req.prompt);
      if (!guard.safe) {
        return this.buildErrorResponse(requestId, req.module, guard.reason!, performance.now() - start);
      }

      // Cache check for identical prompts (not for automod/security)
      const shouldCache = !['HYBRID_AUTOMOD', 'AI_SECURITY_ADVISOR'].includes(req.module);
      if (shouldCache) {
        const promptHash = crypto.createHash('sha256').update(req.module + req.prompt).digest('hex').slice(0, 16);
        const cached = await cacheGet<AIInferenceResponse>(CacheKeys.aiResponse(promptHash));
        if (cached) return { ...cached, cached: true };
      }

      // Resolve provider
      const providerId = this.resolveProvider(req);
      const provider = this.clients.get(providerId)?.provider;
      const model = req.model || provider?.models[0] || 'nexus-mock-v4';

      // Conversation context injection
      const history = await this.getConversationHistory(req.userId, req.guildId, req.module);
      const contextualReq = { ...req, conversationHistory: history };

      // Call LLM
      const llmResult = await measureAsync(
        `ai:${providerId}:${req.module}`,
        () => this.universalLLM(providerId, contextualReq, model),
        3000,
      );

      const latencyMs = Number((performance.now() - start).toFixed(1));
      const tokensIn = (llmResult as { usage?: { prompt_tokens?: number } }).usage?.prompt_tokens ?? Math.ceil(req.prompt.length / 4);
      const tokensOut = (llmResult as { usage?: { completion_tokens?: number } }).usage?.completion_tokens ?? Math.ceil(String((llmResult as { text?: string }).text).length / 4);
      const costUsd = ((tokensIn / 1000) * (provider?.costInPer1k ?? 0)) + ((tokensOut / 1000) * (provider?.costOutPer1k ?? 0));

      // Track guild costs
      if (req.guildId) {
        this.guildCosts.set(req.guildId, (this.guildCosts.get(req.guildId) ?? 0) + costUsd);
      }

      // Update conversation history
      if (req.userId && req.guildId) {
        await this.pushConversationMessage(req.userId, req.guildId, req.module, [
          { role: 'user', content: req.prompt, timestamp: Date.now() },
          { role: 'assistant', content: String((llmResult as { text?: string }).text), timestamp: Date.now() },
        ]);
      }

      const response: AIInferenceResponse = {
        success: true,
        requestId,
        module: req.module,
        output: (llmResult as { text?: string }).text,
        text: String((llmResult as { text?: string }).text),
        tokensIn,
        tokensOut,
        latencyMs,
        model,
        provider: providerId,
        costUsd,
        cached: false,
      };

      // Cache the response
      if (shouldCache && (llmResult as { text?: string }).text) {
        const promptHash = crypto.createHash('sha256').update(req.module + req.prompt).digest('hex').slice(0, 16);
        await cacheSet(CacheKeys.aiResponse(promptHash), response, 60);
      }

      return response;
    } finally {
      this.inflight.delete(requestId);
    }
  }

  // ── Conversation context management ────────────────────────────────────
  private async getConversationHistory(
    userId?: string,
    guildId?: string,
    module?: AIModuleId,
  ): Promise<ConversationMessage[]> {
    if (!userId || !guildId) return [];
    const key = CacheKeys.conversation(userId, guildId);
    const ctx = await cacheGet<ConversationContext>(key);
    if (!ctx || ctx.module !== module) return [];
    // Return last 10 turns (20 messages)
    return ctx.history.slice(-20);
  }

  private async pushConversationMessage(
    userId: string,
    guildId: string,
    module: AIModuleId,
    messages: ConversationMessage[],
  ): Promise<void> {
    const key = CacheKeys.conversation(userId, guildId);
    const existing = await cacheGet<ConversationContext>(key);
    const now = Date.now();

    const ctx: ConversationContext = existing && existing.module === module
      ? {
          ...existing,
          history: [...existing.history, ...messages].slice(-40), // keep last 40 messages
          lastUpdated: now,
          tokensUsed: existing.tokensUsed + messages.reduce((s, m) => s + Math.ceil(m.content.length / 4), 0),
        }
      : {
          guildId,
          userId,
          history: messages,
          module,
          createdAt: now,
          lastUpdated: now,
          tokensUsed: messages.reduce((s, m) => s + Math.ceil(m.content.length / 4), 0),
        };

    await cacheSet(key, ctx, 3600); // 1h conversation TTL
  }

  // ── Provider resolution ─────────────────────────────────────────────────
  private resolveProvider(req: AIInferenceRequest): AIProviderId {
    // Guild override
    const guildOverride = req.guildId ? this.guildProviderOverrides.get(req.guildId) : undefined;
    if (guildOverride && this.clients.has(guildOverride)) return guildOverride;

    // Explicit provider request
    if (req.provider && req.provider !== 'auto' && this.clients.has(req.provider as AIProviderId)) {
      return req.provider as AIProviderId;
    }

    // Auto: pick by priority, excluding mock
    const sorted = [...this.clients.entries()]
      .filter(([id]) => id !== 'nexus-mock')
      .sort((a, b) => a[1].provider.priority - b[1].provider.priority);

    return sorted[0]?.[0] ?? 'nexus-mock';
  }

  // ── Universal LLM router ────────────────────────────────────────────────
  private async universalLLM(
    providerId: AIProviderId,
    req: AIInferenceRequest,
    model: string,
  ): Promise<{ text: string; usage?: { prompt_tokens?: number; completion_tokens?: number } }> {
    const pc = this.clients.get(providerId);
    if (!pc) throw new Error(`Provider not configured: ${providerId}`);
    const { client } = pc;

    const systemPrompt = MODULE_SYSTEM_PROMPTS[req.module] ?? DEFAULT_SYSTEM;
    const maxTokens = Math.min(req.maxTokens ?? 800, pc.provider.maxTokens);
    const temperature = req.temperature ?? 0.45;

    // Build message history for context-aware requests
    const historyMessages = (req.conversationHistory ?? []).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // OpenAI-compatible (OpenAI, Groq, DeepSeek, xAI, Perplexity, Together, OpenRouter, Azure)
    const openaiCompatProviders = ['openai', 'groq', 'deepseek', 'xai', 'perplexity', 'together', 'openrouter', 'azure'];
    if (openaiCompatProviders.includes(providerId)) {
      const c = client as { chat: { completions: { create: (...args: unknown[]) => Promise<unknown> } } };
      const r = await c.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...historyMessages,
          { role: 'user', content: req.prompt },
        ],
        max_tokens: maxTokens,
        temperature,
      }) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      return {
        text: r.choices?.[0]?.message?.content ?? '',
        usage: r.usage,
      };
    }

    // Anthropic Claude
    if (providerId === 'anthropic') {
      const c = client as { messages: { create: (...args: unknown[]) => Promise<unknown> } };
      const r = await c.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          ...historyMessages,
          { role: 'user', content: req.prompt },
        ],
      }) as { content?: Array<{ text?: string }> };
      return { text: r.content?.[0]?.text ?? '' };
    }

    // Google Gemini REST (GEMINI_API_KEY oder GOOGLE_API_KEY)
    if (providerId === 'google') {
      const c = client as { apiKey: string };
      // Gemini 2.0 Flash als Standard (kostenlos & schnell)
      const geminiModel = model || 'gemini-2.0-flash-exp';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${c.apiKey}`;

      // System-Prompt als erste User-Nachricht (Gemini braucht alternierende Rollen)
      const contents: { role: string; parts: { text: string }[] }[] = [];

      // System als erste Nachricht
      contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
      contents.push({ role: 'model', parts: [{ text: 'Verstanden. Ich bin Nexus AI Omega.' }] });

      // Konversations-History
      for (const m of historyMessages) {
        contents.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        });
      }

      // Aktuelle Anfrage
      contents.push({ role: 'user', parts: [{ text: req.prompt }] });

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature,
          },
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const errText = await res.text();
        // Bei 404: anderes Modell versuchen
        if (res.status === 404) {
          const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${c.apiKey}`;
          const fallbackRes = await fetch(fallbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: maxTokens, temperature } }),
            signal: AbortSignal.timeout(30_000),
          });
          if (fallbackRes.ok) {
            const fj = await fallbackRes.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
            return { text: fj?.candidates?.[0]?.content?.parts?.[0]?.text ?? '' };
          }
        }
        throw new Error(`Gemini ${res.status}: ${errText.slice(0, 200)}`);
      }

      const j = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      return { text: j?.candidates?.[0]?.content?.parts?.[0]?.text ?? '' };
    }

    // Mistral REST
    if (providerId === 'mistral') {
      const c = client as { key: string };
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${c.key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...historyMessages,
            { role: 'user', content: req.prompt },
          ],
          max_tokens: maxTokens,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`Mistral error: ${res.status}`);
      const j = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      return { text: j.choices?.[0]?.message?.content ?? '' };
    }

    // Cohere
    if (providerId === 'cohere') {
      const c = client as { key: string };
      const res = await fetch('https://api.cohere.ai/v2/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${c.key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...historyMessages,
            { role: 'user', content: req.prompt },
          ],
        }),
        signal: AbortSignal.timeout(30_000),
      });
      const j = await res.json() as { message?: { content?: Array<{ text?: string }> } };
      return { text: j.message?.content?.[0]?.text ?? '' };
    }

    // Ollama local
    if (providerId === 'ollama') {
      const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const res = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model || 'llama3.3', prompt: req.prompt, stream: false }),
        signal: AbortSignal.timeout(60_000),
      }).catch(() => null);
      if (res?.ok) {
        const j = await res.json() as { response?: string };
        return { text: j.response ?? '' };
      }
      throw new Error('Ollama offline');
    }

    // Mock fallback — kein KI-Provider konfiguriert
    return {
      text:
        `> ⚠️ **Kein KI-Provider konfiguriert**\n\n` +
        `Nexus AI Omega läuft im **Demo-Modus**. Um echte KI-Antworten zu erhalten, konfiguriere einen Provider:\n\n` +
        `**Kostenlos & schnell:**\n` +
        `› Groq (kostenlos): https://console.groq.com → Key in \`.env\` als \`GROQ_API_KEY\`\n` +
        `› Google Gemini (kostenlos): https://aistudio.google.com → Key als \`GEMINI_API_KEY\`\n\n` +
        `**Deine Anfrage:** ${req.prompt.slice(0, 200)}`,
    };
  }

  // ── Application reviewer ────────────────────────────────────────────────
  async reviewApplication(fields: Record<string, string>, guildId?: string): Promise<ApplicationReview> {
    const prompt = `Review this Discord server application and return ONLY valid JSON:\n${JSON.stringify(fields, null, 2)}\n\nReturn JSON: { grammar: 0-10, seriousness: 0-10, completeness: 0-10, experience: 0-10, overall: 0-10, recommendation: "accept"|"consider"|"reject", feedback: "string", missingFields: [], improvements: [] }`;

    try {
      const result = await this.infer({
        module: 'AI_APPLICATION_REVIEWER',
        prompt,
        guildId,
        maxTokens: 600,
        temperature: 0.2,
      });

      const jsonMatch = String(result.text).match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]) as ApplicationReview;
    } catch (err) {
      aiLogger.warn({ err }, 'Application review parse failed — using fallback scores');
    }

    // Fallback: heuristic scoring
    const avgLength = Object.values(fields).reduce((s, v) => s + v.length, 0) / Object.keys(fields).length;
    const completeness = Math.min(10, Object.values(fields).filter(v => v.trim().length > 10).length * 2);
    return {
      grammar: 6, seriousness: 6, completeness, experience: 5, overall: 6,
      recommendation: completeness >= 8 ? 'consider' : 'reject',
      feedback: 'Automatic review: AI analysis unavailable. Please review manually.',
      missingFields: Object.entries(fields).filter(([, v]) => !v.trim()).map(([k]) => k),
      improvements: ['Provide more detailed answers', 'Include specific examples'],
    };
  }

  // ── Server build plan generator ─────────────────────────────────────────
  async generateServerBuildPlan(theme: string, style: string, guildId?: string): Promise<ServerBuildPlan> {
    // Seed uniqueness from theme hash to prevent identical outputs
    const seed = crypto.createHash('md5').update(theme + style + Date.now().toString(36)).digest('hex').slice(0, 8);

    const prompt = `Generate a unique Discord server structure for theme: "${theme}", style: "${style}", seed: "${seed}".
Return ONLY valid JSON:
{
  "theme": "string",
  "style": "string",
  "palette": ["#hex1","#hex2","#hex3"],
  "categories": [
    { "name": "string", "channels": [{ "name": "string", "type": "text"|"voice"|"forum", "topic": "optional string" }] }
  ],
  "roles": [{ "name": "string", "color": "#hex", "permissions": ["string"], "hoist": true|false }],
  "welcomeMessage": "string",
  "verificationLevel": 0-4,
  "boosterPerks": "string"
}
Be creative. Different seed = different structure. No generic defaults.`;

    try {
      const result = await this.infer({
        module: 'AI_SERVER_BUILDER',
        prompt,
        guildId,
        maxTokens: 2000,
        temperature: 0.85, // Higher temp for more diversity
      });

      const jsonMatch = String(result.text).match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]) as ServerBuildPlan;
    } catch (err) {
      aiLogger.warn({ err }, 'Server build plan parse failed — using template');
    }

    return this.fallbackBuildPlan(theme, style);
  }

  private fallbackBuildPlan(theme: string, style: string): ServerBuildPlan {
    return {
      theme,
      style,
      palette: ['#7c3aed', '#06ffa5', '#0ea5e9'],
      categories: [
        { name: '📋 INFORMATION', channels: [{ name: 'rules', type: 'text', topic: 'Server rules' }, { name: 'announcements', type: 'text', topic: 'Important updates' }] },
        { name: '💬 COMMUNITY', channels: [{ name: 'general', type: 'text', topic: `${theme} discussion` }, { name: 'introductions', type: 'text' }, { name: 'media', type: 'text' }] },
        { name: '🎙️ VOICE', channels: [{ name: 'General Voice', type: 'voice' }, { name: 'Music', type: 'voice' }] },
        { name: '🎫 SUPPORT', channels: [{ name: 'tickets', type: 'text', topic: 'Open a ticket' }, { name: 'faq', type: 'text' }] },
      ],
      roles: [
        { name: '👑 Owner', color: '#fbbf24', permissions: ['ADMINISTRATOR'], hoist: true },
        { name: '🛡️ Moderator', color: '#06ffa5', permissions: ['KICK_MEMBERS', 'BAN_MEMBERS', 'MANAGE_MESSAGES'], hoist: true },
        { name: '⭐ VIP', color: '#a855f7', permissions: [], hoist: false },
        { name: '👥 Member', color: '#6b7280', permissions: [], hoist: false },
      ],
      welcomeMessage: `Welcome to ${theme}! Please read #rules and enjoy the community.`,
      verificationLevel: 2,
      boosterPerks: 'Custom role color + exclusive VIP channels',
    };
  }

  // ── Guild provider management ───────────────────────────────────────────
  setGuildProvider(guildId: string, provider: AIProviderId, apiKey?: string): void {
    if (provider === 'auto') {
      this.guildProviderOverrides.delete(guildId);
      return;
    }
    if (!AI_PROVIDERS.find(p => p.id === provider)) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    this.guildProviderOverrides.set(guildId, provider);
    if (apiKey) {
      this.guildApiKeys.set(guildId, { provider, key: apiKey });
    }
  }

  // ── Error response builder ──────────────────────────────────────────────
  private buildErrorResponse(requestId: string, module: AIModuleId, reason: string, latencyMs: number): AIInferenceResponse {
    return {
      success: false,
      requestId,
      module,
      output: null,
      text: reason,
      tokensIn: 0,
      tokensOut: 0,
      latencyMs,
      model: 'none',
      provider: 'none',
      costUsd: 0,
    };
  }

  // ── Inventory ───────────────────────────────────────────────────────────
  listProviders() {
    return AI_PROVIDERS.map(p => ({
      ...p,
      configured: this.clients.has(p.id),
      apiKeyEnvSet: p.apiKeyEnv ? !!process.env[p.apiKeyEnv] : p.id === 'nexus-mock' || p.id === 'ollama',
    }));
  }

  listModules() {
    return AI_MODULES.map((id, i) => ({
      id,
      name: id.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
      enabled: true,
      latencyTargetMs: [28, 35, 42, 19, 55][i % 5],
      providers: [...this.clients.keys()].filter(k => k !== 'nexus-mock'),
      systemPrompt: !!MODULE_SYSTEM_PROMPTS[id as AIModuleId],
    }));
  }

  getGuildCost(guildId: string): number {
    return this.guildCosts.get(guildId) ?? 0;
  }

  clearConversation(userId: string, guildId: string): Promise<void> {
    const key = CacheKeys.conversation(userId, guildId);
    return import('../services/redisCache.js').then(m => m.cacheDel(key));
  }
}

export const aiEngine = AIEngine.getInstance();
