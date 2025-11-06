import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useCursorStore } from './cursor-store'
import { useTranslateStore } from './translate-store'
import {
  getGridCursorPosition,
  getPieceTableCursorPosition,
} from '../piece-table'
import { measureMM } from '@/lib/utils'

export interface RowsState {
  rows: number
  setRows: (rows: number) => void
}

export const useRowsStore = create<RowsState>((set) => ({
  rows: 1,
  setRows: (rows: number) => {
    set({ rows })
  },
}))

export interface DocumentState {
  fontSize: number
  pinyinSize: number
  pinyinOffset: number
  pinyinPosition: 'top' | 'bottom'
  columns: number
  gapX: number
  gapY: number
  marginX: number
  marginY: number
  mmX: number
  mmY: number
  debug: boolean
  layout: 'portrait' | 'landscape'
  translate: boolean

  pageWidth: () => number
  pageHeight: () => number
  setFontSize: (fontSize: number) => void
  setColumns: (columns: number) => void
  setPinyinSize: (pinyinSize: number) => void
  setPinyinOffset: (pinyinOffset: number) => void
  setPinyinPosition: (pinyinPosition: 'top' | 'bottom') => void
  setGapX: (gapX: number) => void
  setGapY: (gapY: number) => void
  setMarginX: (marginX: number) => void
  setMarginY: (marginY: number) => void
  toggleDebug: () => void
  toggleTranslate: () => void
  setMmX: (mmX: number) => void
  setMmY: (mmY: number) => void
  setLayout: (layout: 'portrait' | 'landscape') => void
  rowHeight: () => number
  rowsPerPage: () => number
}

export const useDocumentStore = create<DocumentState>()(
  persist(
    (set, get) => ({
      // --- persisted data ---
      fontSize: 10,
      pinyinSize: 4,
      pinyinOffset: 0,
      pinyinPosition: 'bottom',
      columns: 22,
      gapX: 1.1,
      gapY: 2.2,
      marginX: 15,
      marginY: 15,
      debug: false,
      layout: 'landscape',
      translate: true,

      // --- derived/computed methods (not persisted) ---
      mmX: measureMM().mmX,
      mmY: measureMM().mmY,
      pageWidth: () => (get().layout === 'portrait' ? 210 : 297),
      pageHeight: () => (get().layout === 'portrait' ? 297 : 210),

      setFontSize: (fontSize: number) => set({ fontSize }),
      setPinyinSize: (pinyinSize: number) => set({ pinyinSize }),
      setPinyinOffset: (pinyinOffset: number) => set({ pinyinOffset }),
      setPinyinPosition: (pinyinPosition: 'top' | 'bottom') =>
        set({ pinyinPosition }),

      setColumns: (columns: number) => {
        const increasing = get().columns < columns
        const cursor = useCursorStore.getState()
        cursor.resetSelection()

        if (cursor.offset <= 1 || increasing) {
          set({ columns })
          return
        }

        const { row, col, isNewLine } = getGridCursorPosition(
          cursor.pieceIndex,
          cursor.charIndex,
        )

        let newRow = row
        let newCol = col + cursor.offset

        if (isNewLine) {
          newRow += 1
          newCol = cursor.offset - (get().columns - columns)
        }

        if (newCol > columns) newCol = columns

        const newPos = getPieceTableCursorPosition(newRow, newCol)
        cursor.setCursorByPiece(
          newPos.pieceIndex,
          newPos.charIndex,
          newPos.offset,
        )
        set({ columns })
      },

      setGapX: (gapX: number) => set({ gapX }),
      setGapY: (gapY: number) => set({ gapY }),
      setMarginX: (marginX: number) => set({ marginX }),
      setMarginY: (marginY: number) => set({ marginY }),
      toggleDebug: () => set((state) => ({ debug: !state.debug })),
      toggleTranslate: () => {
        const isCurrentlyOn = get().translate
        set((state) => ({ translate: !state.translate }))
        if (isCurrentlyOn) return
        useTranslateStore.getState().translateSelection()
      },
      setMmX: (mmX: number) => set({ mmX }),
      setMmY: (mmY: number) => set({ mmY }),
      setLayout: (layout: 'portrait' | 'landscape') => set({ layout }),

      rowHeight: () =>
        get().fontSize + get().gapY + get().pinyinSize + get().pinyinOffset,
      rowsPerPage: () =>
        Math.floor(
          (get().pageHeight() - get().marginY * 2) / get().rowHeight(),
        ),
    }),
    {
      name: 'document-settings',
      partialize: (state) => ({
        fontSize: state.fontSize,
        pinyinSize: state.pinyinSize,
        pinyinOffset: state.pinyinOffset,
        pinyinPosition: state.pinyinPosition,
        columns: state.columns,
        gapX: state.gapX,
        gapY: state.gapY,
        marginX: state.marginX,
        marginY: state.marginY,
        debug: state.debug,
        layout: state.layout,
        translate: state.translate,
      }),
    },
  ),
)
