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
