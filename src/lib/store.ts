import { create } from 'zustand'
import { Piece } from './render'

export interface DocumentState {
  fontSize: number
  columns: number
  gapX: number
  gapY: number
  marginX: number
  marginY: number

  setFontSize: (fontSize: number) => void
  setColumns: (columns: number) => void
  setGapX: (gapX: number) => void
  setGapY: (gapY: number) => void
  setMarginX: (marginX: number) => void
  setMarginY: (marginY: number) => void
}

export const useDocumentStore = create<DocumentState>((set) => ({
  fontSize: 10,
  columns: 17,
  gapX: 0,
  gapY: 0,
  marginX: 20,
  marginY: 20,

  setFontSize: (fontSize: number) => set({ fontSize }),
  setColumns: (columns: number) => set({ columns }),
  setGapX: (gapX: number) => set({ gapX }),
  setGapY: (gapY: number) => set({ gapY }),
  setMarginX: (marginX: number) => set({ marginX }),
  setMarginY: (marginY: number) => set({ marginY }),
}))

export interface ContentState {
  originalBuffer: string
  addBuffer: string
  rows: {
    pieces: Piece[]
  }[]

  appendAdd: (add: string) => void
}

export const useContentStore = create<ContentState>((set) => ({
  originalBuffer: '你好世界',
  addBuffer: '我叫',
  rows: [
    {
      pieces: [{ type: 'original', start: 0, length: 4, col: 4 }],
    },
    {
      pieces: [
        { type: 'add', start: 0, length: 1, col: 2 },
        { type: 'add', start: 1, length: 1, col: 8 },
      ],
    },
  ],

  appendAdd: (val: string) => set({ addBuffer: val }),
}))
