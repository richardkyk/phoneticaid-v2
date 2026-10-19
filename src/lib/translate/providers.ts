// Client-safe provider metadata. The order here is the fallback order used by 'auto'.
export const providers = [
  { id: 'workers-ai-sea-lion', label: 'Cloudflare · SEA-LION' },
  { id: 'workers-ai-gpt-oss', label: 'Cloudflare · GPT-OSS' },
  { id: 'gemini', label: 'Google Gemini' },
  { id: 'deepl', label: 'DeepL' },
  { id: 'openai', label: 'OpenAI' },
] as const

export type ProviderId = (typeof providers)[number]['id']
export type ProviderChoice = ProviderId | 'auto'

export const providerIds = providers.map((p) => p.id) as [
  ProviderId,
  ...ProviderId[],
]

export const providerLabel = (id: string) =>
  providers.find((p) => p.id === id)?.label ?? id
