import { Phone } from 'lucide-react'
import Logo from './Logo.jsx'
import { business } from '../config.js'

const serviceLinks = [
  'New Irrigation Installations',
  'Sprinkler Repairs',
  'Mainline & Pipe Repairs',
  'Drip Irrigation Conversions',
  'Smart Controller Upgrades',
  'System Diagnostics & Adjustments',
]

export default function Footer() {
  return (
    <footer className="bg-navy pt-16 pb-28 text-white/70 md:pb-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <Logo light />
            <p className="mt-5 max-w-xs leading-relaxed">
              Residential sprinkler installation and irrigation repair in {business.serviceArea}.
            </p>
          </div>

          <nav aria-label="Services">
            <h2 className="text-sm font-bold tracking-[0.14em] text-white uppercase">Services</h2>
            <ul className="mt-4 space-y-2.5">
              {serviceLinks.map((s) => (
                <li key={s}>
                  <a href="#services" className="transition-colors hover:text-white">
                    {s}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-sm font-bold tracking-[0.14em] text-white uppercase">Contact</h2>
            <p className="mt-4">{business.name}</p>
            <p>{business.city}</p>
            <a
              href={business.phoneHref}
              className="mt-3 inline-flex items-center gap-2 font-semibold text-white transition-colors hover:text-leaf"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              {business.phoneDisplay}
            </a>
            <div className="mt-5">
              <a href="#contact" className="font-semibold text-leaf transition-colors hover:text-white">
                Request a free estimate →
              </a>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-white/10 pt-6 text-sm sm:flex-row sm:justify-between">
          <p>
            © {new Date().getFullYear()} {business.name}. All rights reserved.
          </p>
          <p>Photos via Unsplash.</p>
        </div>
      </div>
    </footer>
  )
}
