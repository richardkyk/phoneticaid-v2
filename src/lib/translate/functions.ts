import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { providerIds } from './providers'
import type { ProviderId } from './providers'

const TranslateSchema = z.object({
  text: z.string(),
  provider: z.enum(['auto', ...providerIds]),
})

export type TranslateResult =
  | { ok: true; provider: ProviderId; translation: string }
  | { ok: false; errors: Array<string> }

// Which providers are configured on the server (have keys / bindings)
export const getAvailableProviders = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { serverProviders } = await import('./server')
    const available: Array<ProviderId> = []
    for (const id of providerIds) {
      if (await serverProviders[id].available()) available.push(id)
    }
    return available
  },
)

// With 'auto', providers are tried in order and we fall through to the next
// one if a provider isn't configured or fails (e.g. out of credits)
export const translate = createServerFn({ method: 'POST' })
  .validator(TranslateSchema)
  .handler(async ({ data }): Promise<TranslateResult> => {
    const { serverProviders } = await import('./server')
    const order = data.provider === 'auto' ? providerIds : [data.provider]
    const errors: Array<string> = []

    for (const id of order) {
      const provider = serverProviders[id]
      if (!(await provider.available())) {
        errors.push(`${id}: not configured`)
        continue
      }

      try {
        const translation = await provider.translate(data.text)
        return { ok: true, provider: id, translation }
      } catch (err) {
        console.error(`Translation provider ${id} failed`, err)
        errors.push(`${id}: ${err instanceof Error ? err.message : err}`)
      }
    }

    return { ok: false, errors }
  })

const ChooseReadingsSchema = z.object({
  // the text with each asked about character numbered (得[1])
  text: z.string(),
  questions: z.array(
    z.object({
      n: z.number(),
      char: z.string(),
      options: z.array(z.object({ pinyin: z.string(), gloss: z.string() })),
    }),
  ),
  provider: z.enum(['auto', ...providerIds]),
})

export type ChooseReadingsResult =
  | { ok: true; provider: ProviderId; choices: Record<number, string> }
  | { ok: false; errors: Array<string> }

// Asks a language model for the readings of characters with more than one
// (see readings.ts). Uses the chosen provider if it's a language model,
// otherwise tries them in order like 'auto'.
export const chooseReadings = createServerFn({ method: 'POST' })
  .validator(ChooseReadingsSchema)
  .handler(async ({ data }): Promise<ChooseReadingsResult> => {
    const { serverProviders } = await import('./server')
    const { READINGS_SYSTEM_PROMPT, parseChoices, readingsPrompt } =
      await import('../readings')
    const models = providerIds.filter((id) => serverProviders[id].complete)
    const order = models.includes(data.provider as ProviderId)
      ? [data.provider as ProviderId]
      : models
    const errors: Array<string> = []

    for (const id of order) {
      const provider = serverProviders[id]
      if (!(await provider.available())) {
        errors.push(`${id}: not configured`)
        continue
      }
      try {
        const reply = await provider.complete!(
          READINGS_SYSTEM_PROMPT,
          readingsPrompt(data.text, data.questions),
        )
        return {
          ok: true,
          provider: id,
          choices: parseChoices(reply, data.questions),
        }
      } catch (err) {
        console.error(`Provider ${id} failed to choose readings`, err)
        errors.push(`${id}: ${err instanceof Error ? err.message : err}`)
      }
    }

    return { ok: false, errors }
  })
