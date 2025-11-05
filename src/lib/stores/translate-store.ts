import { create } from 'zustand'
import { usePieceTableStore } from './piece-table-store'
import z from 'zod'
import { createServerFn } from '@tanstack/react-start'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { useDocumentStore } from './document-store'

const TranslateSchema = z.object({
  text: z.string(),
})

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
  isThinking: boolean
  translations: { original: string; translation: string }[]
  translateSelection: () => void
  test: () => void
}

export const useTranslateStore = create<TranslateState>((set, get) => {
  let currentAbortController: AbortController | null = null

  return {
    isThinking: false,
    translations: [],
    test: () => {
      const interval = setInterval(() => {
        const arr = get().translations
        arr.push({ original: '世', translation: 'v1.2.0-beta.1' })
        set({ translations: [...arr] })
      }, 250)
      return () => clearInterval(interval)
    },
    translateSelection: async () => {
      if (!useDocumentStore.getState().translate) return

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
  }
})
