import { create } from 'zustand'
import { usePieceTableStore } from './piece-table-store'
import z from 'zod'
import { createServerFn } from '@tanstack/react-start'
import { streamText } from 'ai'
import { env } from '@/env'
import { createOpenAI } from '@ai-sdk/openai'

const TranslateSchema = z.object({
  text: z.string(),
})

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY })

const translate = createServerFn({ method: 'POST' })
  .inputValidator(TranslateSchema)
  .handler(async ({ data }) => {
    const encoder = new TextEncoder()

    const result = streamText({
      model: openai('gpt-3.5-turbo'),
      messages: [
        {
          role: 'system',
          content: `
        You are a translator. Only translate text to English.
        If the input text does not need translation, do not output anything at all — return an empty response with zero characters, not quotes.
      `,
        },
        { role: 'user', content: data.text },
      ],
    })

    return new Response(
      new ReadableStream({
        async start(controller) {
          for await (const textPart of result.textStream) {
            controller.enqueue(encoder.encode(textPart))
          }
          controller.close()
        },
      }),
      { headers: { 'Content-Type': 'text/plain' } },
    )
  })

interface TranslateState {
  translate: boolean
  isThinking: boolean
  translations: { original: string; translation: string }[]
  translateSelection: () => void
  toggleTranslate: () => void
}

export const useTranslateStore = create<TranslateState>((set, get) => {
  let currentAbortController: AbortController | null = null

  return {
    translate: true,
    isThinking: false,
    translations: [],
    translateSelection: async () => {
      if (!get().translate) return

      const selection = usePieceTableStore.getState().extractSelection()
      if (selection.length === 0) return

      // Cancel previous translation if it's running
      if (currentAbortController) {
        currentAbortController.abort()
      }

      const abortController = new AbortController()
      currentAbortController = abortController

      set({
        isThinking: true,
        translations: [
          ...get().translations,
          { original: selection, translation: '' },
        ],
      })

      try {
        const res = await translate({
          data: { text: selection },
          signal: abortController.signal,
        })

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        const newArr = get().translations
        let partial = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          partial += decoder.decode(value)
          const payload = { original: selection, translation: partial }
          newArr.splice(get().translations.length - 1, 1, payload)
          set({ translations: [...newArr], isThinking: false })
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('Previous translation canceled')
        } else {
          console.error(err)
        }
      } finally {
        set({ isThinking: false })
        if (currentAbortController === abortController) {
          currentAbortController = null
        }
      }
    },
    toggleTranslate: () => {
      const isCurrentlyOn = get().translate
      set((state) => ({ translate: !state.translate }))
      if (isCurrentlyOn) return
      get().translateSelection()
    },
  }
})
