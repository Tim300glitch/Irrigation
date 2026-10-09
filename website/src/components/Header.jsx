import { useEffect, useState } from 'react'
import { Menu, Phone, X } from 'lucide-react'
import Logo from './Logo.jsx'
import { business } from '../config.js'

const links = [
  { href: '#services', label: 'Services' },
  { href: '#why-deltaline', label: 'Why Choose Us' },
  { href: '#contact', label: 'Contact' },
]

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const solid = scrolled || open

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        solid ? 'bg-white/90 shadow-[0_1px_0_rgb(16_42_67_/_0.08)] backdrop-blur-xl' : 'bg-transparent'
      }`}
    >
      <nav aria-label="Main" className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#top" aria-label="DeltaLine Irrigation — back to top" onClick={() => setOpen(false)}>
          <Logo light={!solid} />
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`rounded-full px-4 py-2 text-[0.95rem] font-semibold transition-colors ${
                solid ? 'text-navy-700 hover:bg-mist hover:text-navy' : 'text-white/90 hover:bg-white/10 hover:text-white'
              }`}
            >
              {l.label}
            </a>
          ))}
          <a
            href={business.phoneHref}
            className="ml-3 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-leaf-strong px-5 text-[0.95rem] font-bold text-white transition hover:bg-leaf-deep"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            Call Now
          </a>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <a
            href={business.phoneHref}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-leaf-strong px-4 text-sm font-bold text-white"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            Call
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
              solid ? 'text-navy hover:bg-mist' : 'text-white hover:bg-white/10'
            }`}
          >
            {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>
      </nav>

      <div
        id="mobile-menu"
        hidden={!open}
        className="border-t border-line bg-white px-4 pt-2 pb-6 shadow-lift md:hidden"
      >
        <ul className="flex flex-col">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex min-h-[52px] items-center border-b border-line text-lg font-semibold text-navy"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <a
          href={business.phoneHref}
          className="mt-5 flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-leaf-strong text-base font-bold text-white"
        >
          <Phone className="h-5 w-5" aria-hidden="true" />
          Call {business.phoneDisplay}
        </a>
      </div>
    </header>
  )
}
