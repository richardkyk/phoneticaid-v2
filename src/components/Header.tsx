import { Link } from '@tanstack/react-router'
import Toolbar from './toolbar'

export default function Header() {
  return (
    <header className="gap-2 print:hidden print:h-0 z-10 p-2 border-b text-black justify-between h-[var(--header-height)]">
      <nav className="flex flex-row">
        <div className="px-2 font-bold">
          <Link to="/">Home</Link>
        </div>

        <div className="px-2 font-bold">
          <Link to="/demo/start/server-funcs">Start - Server Functions</Link>
        </div>

        <div className="px-2 font-bold">
          <Link to="/demo/start/api-request">Start - API Request</Link>
        </div>
      </nav>
      <Toolbar />
    </header>
  )
}
