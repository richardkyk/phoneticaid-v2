import Toolbar from './toolbar'

export default function Header() {
  return (
    <header className="gap-2 print:hidden print:h-0 z-10 p-2 border-b text-black justify-between h-[var(--header-height)]">
      <Toolbar />
    </header>
  )
}
