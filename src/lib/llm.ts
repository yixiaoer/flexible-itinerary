// Minimal OpenAI-compatible chat client. Works with OpenAI, DeepSeek, Moonshot,
// 通义, OpenRouter, local vLLM, etc. Runs entirely in the browser; key never
// leaves localStorage.

import type { LLMSettings } from '../types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  temperature?: number
  /** Hint the API to return JSON. Most OpenAI-compatible servers honor this. */
  jsonMode?: boolean
  signal?: AbortSignal
}

export class LLMError extends Error {
  status?: number
  body?: string
  constructor(msg: string, status?: number, body?: string) {
    super(msg)
    this.status = status
    this.body = body
  }
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, '')
  const p = path.replace(/^\/+/, '')
  return `${b}/${p}`
}

export async function chat(
  settings: LLMSettings,
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<string> {
  if (!settings.apiKey) {
    throw new LLMError('Missing API key')
  }
  const url = joinUrl(settings.baseUrl || 'https://api.openai.com/v1', '/chat/completions')

  const body: Record<string, unknown> = {
    model: settings.model || 'gpt-4o-mini',
    messages,
    temperature: opts.temperature ?? settings.temperature ?? 0.4,
  }
  if (opts.jsonMode) {
    body.response_format = { type: 'json_object' }
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new LLMError(
      `LLM request failed (${resp.status}): ${text.slice(0, 500)}`,
      resp.status,
      text,
    )
  }

  const json = (await resp.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = json.choices?.[0]?.message?.content ?? ''
  if (!content) {
    throw new LLMError('Empty LLM response')
  }
  return content
}

/**
 * Best-effort JSON extractor: handles fenced ```json ...``` blocks, plain JSON,
 * or text with a JSON object embedded somewhere. Returns null on failure.
 */
export function extractJSON<T = unknown>(text: string): T | null {
  if (!text) return null
  // Fenced first.
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const candidates: string[] = []
  if (fenced) candidates.push(fenced[1])
  candidates.push(text)
  // Greedy {...} fallback.
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1))
  for (const c of candidates) {
    try {
      return JSON.parse(c.trim()) as T
    } catch {
      // try next
    }
  }
  return null
}
