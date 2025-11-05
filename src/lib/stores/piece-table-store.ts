import { create } from 'zustand'
import {
  deleteBackwards,
  getText,
  insertText,
  PieceTable,
  getPieceTableCursorPosition,
  deleteRange,
} from '../piece-table'
import { PieceTableCursor, useCursorStore } from './cursor-store'
import { useHistoryStore } from './history-store'

const original = `[揽佬《大展鸿图》ft. AR刘夫阳 歌词]

[前奏]
(雾烟暗遮世外天)
(有仙山幻作月台殿)
(散花女领导众仙)
(御驾金童在花前)
(雾烟暗遮世外天)

[副歌: 揽佬]
别墅里面唱K
水池里面银龙鱼
我送阿叔茶具
他研墨下笔直接给我四个字
大展鸿图大师亲手提笔字
大展鸿图搬来放在办公室
大展鸿图关公都点头(有料)
鸿运不能总是当头因为(揽佬)

[主歌 1: 揽佬]
他说要玩就要玩的大 (玩得大点)
贼船越大老鼠才坐的下(养下宠物)
得罪小人没关系
得罪君子我看不起
世上君子不贪杯
等于得罪了道 (对)
黑灰蓝白道亦有道
逆流才会水涨船高 (对)
爱财如命的人没有义(好多)
我说是对兄弟不是 pussy (诶)

[主歌 2: 揽佬]
细佬安之若命
颠佬听天由命
揽佬拿把霜之哀伤
剑指妖魔革命 (革命)
人太沉迷收米
人情软过玻璃
江湖总是形形色色
谁还没点诟病
一个二个阿叔喜欢看风景 (揽佬)
听我讲街头中无道 (疯掉)
揽佬要没钱也得博命揾 (慢点)
劳力士还是 AMG (诶)

[导歌: 揽佬]
道亦有道
不是强盗的盗

[副歌: 揽佬]
别墅里面唱K
水池里面银龙鱼
我送阿叔茶具
他研墨下笔直接给我四个字
大展鸿图大师亲手提笔字
大展鸿图搬来放在办公室
大展鸿图关公都点头 (有料)
鸿运不能总是当头因为
[主歌 3: AR刘夫阳]
冇错
骑楼混着六六大顺 man, we good
骑行越秀小北淘金我的 hood (冇错)
帝女花是我的 California love
听任剑辉跟白雪仙白云吃个农家乐
太平馆西餐厅搬了但精气神还在这
敌人幻想变泡沫像烧腊店的外卖盒
路上买个九爷鸡火锅里烫个娃娃菜
那宵夜来自大排档我们却被人当大牌
广东人喺北京唱住粤语 rap, man, we stand up
话 stand 唔到概屌佢屌到佢阿妈都唔认得
喺珠江 skr 当我赛龙舟然后啫啫煲同饮凉茶
Uhh, cook, cook, cook
中华小当家
广东街头潮流 trendsetter
海印打口 CD 箱子肩背着
在那 spa 游泳池水质必须够干净
这是潜规则
老字号绝不会变味了
叉烧包加蜂蜜点缀着
吃的粽子绝对是那碱水的
大展宏图我练字练累了
Then I push

[副歌: 揽佬]
别墅里面唱K
水池里面银龙鱼
我送阿叔茶具
他研墨下笔直接给我四个字
大展鸿图大师亲手提笔字
大展鸿图搬来放在办公室
大展鸿图关公都点头 (有料)
鸿运不能总是当头因为`

export interface PieceTableState {
  pt: PieceTable
  setPt: (pt: PieceTable) => void
  extractSelection: () => string
  deleteSelection: (pt: PieceTable) => PieceTableCursor | null
  insertAtCursor: (substr: string) => void
  deleteAtCursor: (length: number) => void
}

export const usePieceTableStore = create<PieceTableState>((set, get) => ({
  pt: {
    original: original,
    add: '',
    pieces: [
      {
        buffer: 'original',
        start: 0,
        length: original.length,
      },
    ],
  },
  setPt: (pt: PieceTable) => set({ pt }),
  extractSelection: () => {
    const selection = useCursorStore.getState().getSelection()
    if (!selection) return ''

    const ptStart = getPieceTableCursorPosition(
      selection.start.row,
      selection.start.col,
    )
    const ptEnd = getPieceTableCursorPosition(
      selection.end.row,
      selection.end.col,
    )

    if (ptStart.offset !== 0) return ''

    const extractStart = {
      pieceIndex: ptStart.pieceIndex < 0 ? 0 : ptStart.pieceIndex,
      charIndex:
        ptStart.pieceIndex < 0 ? 0 : ptStart.charIndex + ptStart.offset,
    }
    const extractEnd = {
      pieceIndex: ptEnd.pieceIndex < 0 ? 0 : ptEnd.pieceIndex,
      charIndex: ptEnd.pieceIndex < 0 ? 0 : ptEnd.charIndex + 1,
    }
    return getText(get().pt, extractStart, extractEnd)
  },
  deleteSelection: (pt: PieceTable) => {
    const selection = useCursorStore.getState().getSelection()
    const cursor = useCursorStore.getState()
    if (!selection) return null

    const ptStart = getPieceTableCursorPosition(
      selection.start.row,
      selection.start.col,
    )
    const ptEnd = getPieceTableCursorPosition(
      selection.end.row,
      selection.end.col,
    )

    if (ptStart.pieceIndex === ptEnd.pieceIndex) {
      if (ptStart.pieceIndex === -1) {
        cursor.resetSelection()
        return null
      }

      if (ptStart.charIndex === ptEnd.charIndex) {
        if (ptStart.offset === ptEnd.offset) {
          // the selection is referencing the same cursor position
          // i.e. nothing is actually selected
          cursor.resetSelection()
          return null
        }

        if (ptStart.offset > 0 && ptEnd.offset > 0) {
          // the selection only contains padding since they reference the same piece
          cursor.resetSelection()
          return null
        }
      }
    }

    let deleteStart = {
      pieceIndex: ptStart.pieceIndex,
      charIndex: ptStart.charIndex + (ptStart.offset > 0 ? 1 : 0),
    }

    if (ptStart.pieceIndex === -1) {
      // special case where the selection starts in padding (i.e. its reference piece is -1)
      // so we need to reference the piece at pieceIndex 0 and charIndex 0 so that it can be deleted
      deleteStart.pieceIndex = 0
      deleteStart.charIndex = ptStart.charIndex
    }

    const deleteEnd = {
      pieceIndex: ptEnd.pieceIndex,
      charIndex: ptEnd.charIndex + (ptEnd.offset > 0 ? 1 : 0),
    }
    cursor.resetSelection()
    return deleteRange(pt, deleteStart, deleteEnd)
  },
  insertAtCursor: (text: string) => {
    const cursor = useCursorStore.getState()
    let newCursor = {
      pieceIndex: cursor.pieceIndex,
      charIndex: cursor.charIndex,
      offset: cursor.offset,
    }

    const originalPt = structuredClone(get().pt)
    const pt = structuredClone(get().pt)
    const selection = useCursorStore.getState().getSelection()
    if (selection) {
      get().deleteSelection(pt)
      newCursor = getPieceTableCursorPosition(
        selection.start.row,
        selection.start.col,
      )
    }

    let newText = ''
    if (newCursor.offset > 0) {
      if (text !== '\n') {
        newText = ' '.repeat(
          newCursor.offset - (newCursor.pieceIndex === -1 ? 0 : 1),
        )
      }
      // if there is an offset, it means we need to insert after the specified character (thus we have charIndex++)
      newCursor.charIndex++
    }
    newText += text

    const res = insertText(
      pt,
      newCursor.pieceIndex,
      newCursor.charIndex,
      newText,
    )
    useCursorStore.getState().setCursorByPiece(res.pieceIndex, res.charIndex, 1)

    // pt should now be mutated to its final state
    const newPt = structuredClone(pt)
    const history = useHistoryStore.getState()
    history.push({
      undo: () => {
        usePieceTableStore.getState().setPt(originalPt)
        useCursorStore
          .getState()
          .setCursorByPiece(cursor.pieceIndex, cursor.charIndex, cursor.offset)
      },
      redo: () => {
        usePieceTableStore.getState().setPt(newPt)
        useCursorStore
          .getState()
          .setCursorByPiece(res.pieceIndex, res.charIndex, 1)
      },
    })

    set({ pt })
  },
  deleteAtCursor: (length: number) => {
    const cursor = useCursorStore.getState()
    let newCursor = {
      pieceIndex: cursor.pieceIndex,
      charIndex: cursor.charIndex,
      offset: cursor.offset,
    }

    const history = useHistoryStore.getState()
    const originalPt = structuredClone(get().pt)
    const pt = structuredClone(get().pt)
    const selection = useCursorStore.getState().getSelection()
    if (selection) {
      const _newCursor = get().deleteSelection(pt)
      if (_newCursor) newCursor = _newCursor
      useCursorStore
        .getState()
        .setCursorByPiece(
          newCursor.pieceIndex,
          newCursor.charIndex,
          newCursor.offset,
        )
      history.push({
        undo: () => {
          usePieceTableStore.getState().setPt(originalPt)
          useCursorStore
            .getState()
            .setCursorByPiece(
              cursor.pieceIndex,
              cursor.charIndex,
              cursor.offset,
            )
        },
        redo: () => {
          usePieceTableStore.getState().setPt(pt)
          useCursorStore
            .getState()
            .setCursorByPiece(
              newCursor.pieceIndex,
              newCursor.charIndex,
              newCursor.offset,
            )
        },
      })

      set({ pt })
      return
    }

    if (length === 0) return

    if (cursor.pieceIndex <= 0 && cursor.charIndex === 0 && cursor.offset === 0)
      return
    if (cursor.offset > 1 || cursor.pieceIndex === -1) {
      // if pieceIndex is -1, it means we are at the start of the document so there's nothing to delete
      useCursorStore
        .getState()
        .setCursorByPiece(
          cursor.pieceIndex,
          cursor.charIndex,
          cursor.offset - 1,
        )
      return
    }

    newCursor = deleteBackwards(
      pt,
      cursor.pieceIndex,
      cursor.charIndex,
      cursor.offset,
    )

    useCursorStore
      .getState()
      .setCursorByPiece(
        newCursor.pieceIndex,
        newCursor.charIndex,
        newCursor.offset,
      )

    // pt should now be mutated to its final state
    const newPt = structuredClone(pt)
    history.push({
      undo: () => {
        usePieceTableStore.getState().setPt(originalPt)
        useCursorStore
          .getState()
          .setCursorByPiece(cursor.pieceIndex, cursor.charIndex, cursor.offset)
      },
      redo: () => {
        usePieceTableStore.getState().setPt(newPt)
        useCursorStore
          .getState()
          .setCursorByPiece(
            newCursor.pieceIndex,
            newCursor.charIndex,
            newCursor.offset,
          )
      },
    })

    set({ pt })
  },
}))
