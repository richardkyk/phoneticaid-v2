import { generateText } from 'ai'
import type { LanguageModel } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createWorkersAI } from 'workers-ai-provider'
import { env } from '@/env'
import type { ProviderId } from './providers'

// Server-only: only import this from inside server function handlers

const SYSTEM_PROMPT = `
You are a translator. Only translate text to English.
If the input text does not need translation, do not output anything at all — return an empty response with zero characters, not quotes.
`

interface ServerProvider {
  available: () => Promise<boolean>
  translate: (text: string) => Promise<string>
}

const workersAIBinding = async () => {
  const { env: cf } = await import('cloudflare:workers')
  return cf.AI as Ai | undefined
}

// Not streamed: streaming through workers-ai-provider duplicates every token
// for some Workers AI models (e.g. "HeHe is is ...")
async function generate(model: LanguageModel, text: string) {
  const result = await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt: text,
    maxRetries: 0,
    // Workers AI defaults to 256 tokens, which reasoning models (gpt-oss) can
    // use up entirely before writing the answer, leaving it empty
    maxOutputTokens: 4096,
  })
  return result.text.trim()
}

// Models must be available on the Workers Free plan
const workersAI = (model: string): ServerProvider => ({
  available: async () => !!(await workersAIBinding()),
  translate: async (text) => {
    const workersai = createWorkersAI({ binding: (await workersAIBinding())! })
    // newer models aren't in workers-ai-provider's model list, but run the same way
    return generate(workersai(model as Parameters<typeof workersai>[0]), text)
  },
})

export const serverProviders: Record<ProviderId, ServerProvider> = {
  'workers-ai-sea-lion': workersAI('@cf/aisingapore/gemma-sea-lion-v4-27b-it'),
  'workers-ai-gpt-oss': workersAI('@cf/openai/gpt-oss-20b'),
  gemini: {
    available: async () => !!env.GEMINI_API_KEY,
    translate: (text) =>
      generate(
        createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY })(
          'gemini-3.8-flash',
        ),
        text,
      ),
  },
  deepl: {
    available: async () => !!env.DEEPL_API_KEY,
    translate: async (text) => {
      const key = env.DEEPL_API_KEY!
      // free plan keys end in ':fx' and use a different host
      const host = key.endsWith(':fx')
        ? 'https://api-free.deepl.com'
        : 'https://api.deepl.com'
      const res = await fetch(`${host}/v2/translate`, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: [text], target_lang: 'EN-US' }),
      })
      if (!res.ok) throw new Error(`DeepL responded with ${res.status}`)

      const json = (await res.json()) as {
        translations: Array<{ text: string; detected_source_language: string }>
      }
      const [translation] = json.translations
      // match the LLM behaviour of returning nothing for text that is already English
      if (translation.detected_source_language === 'EN') return ''
      return translation.text
    },
  },
  openai: {
    available: async () => !!env.OPENAI_API_KEY,
    translate: (text) =>
      generate(
        createOpenAI({ apiKey: env.OPENAI_API_KEY })('gpt-5.4-mini'),
        text,
      ),
  },
}
