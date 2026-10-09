import { ClipboardList, Phone } from 'lucide-react'
import { business } from '../config.js'

// Always-visible call / estimate buttons on phones.
export default function MobileActionBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(16_42_67_/_0.25)] backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-2 gap-3">
        <a
          href={business.phoneHref}
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-navy font-bold text-white active:scale-[0.98]"
        >
          <Phone className="h-5 w-5" aria-hidden="true" />
          Call Now
        </a>
        <a
          href="#contact"
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-leaf-strong font-bold text-white active:scale-[0.98]"
        >
          <ClipboardList className="h-5 w-5" aria-hidden="true" />
          Free Estimate
        </a>
      </div>
    </div>
  )
}
