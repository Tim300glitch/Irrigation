import { ArrowRight, MapPin, Phone, Tag } from 'lucide-react'
import Photo from './Photo.jsx'
import { btnGhostLight, btnPrimary } from './buttons.js'
import { business, images } from '../config.js'

export default function Hero() {
  return (
    <section id="top" className="relative isolate flex min-h-[640px] items-end overflow-hidden bg-navy sm:min-h-[720px] lg:min-h-[92vh] lg:items-center">
      <Photo image={images.hero} priority className="absolute inset-0 -z-20 h-full w-full" />
      {/* Darkening scrim keeps the headline readable over any part of the photo */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(16_42_67_/_0.55)_0%,rgb(16_42_67_/_0.62)_40%,rgb(16_42_67_/_0.88)_100%)] lg:bg-[linear-gradient(90deg,rgb(16_42_67_/_0.9)_0%,rgb(16_42_67_/_0.6)_50%,rgb(16_42_67_/_0.2)_100%)]"
      />

      <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-navy/70 to-transparent" />

      <div className="mx-auto w-full max-w-6xl px-4 pt-28 pb-14 sm:px-6 sm:pb-20 lg:px-8 lg:pt-32">
        <div className="max-w-2xl">
          <a
            href="#offers"
            className="group mb-6 inline-flex flex-col items-start gap-1.5 rounded-2xl bg-white/95 p-2 pr-4 text-sm font-semibold text-navy shadow-lg transition hover:bg-white sm:flex-row sm:items-center sm:gap-2 sm:rounded-full sm:p-1.5 sm:pr-3"
          >
            <span className="inline-flex items-center gap-1 rounded-full bg-leaf-strong px-2.5 py-1 text-xs font-bold whitespace-nowrap text-white">
              <Tag className="h-3.5 w-3.5" aria-hidden="true" />
              Limited-Time Offers
            </span>
            <span className="pl-1 sm:pl-0">
              40% Off New Installs <span className="text-navy-400">|</span> 25% Off Repairs
            </span>
            <ArrowRight className="hidden h-4 w-4 transition group-hover:translate-x-0.5 sm:block" aria-hidden="true" />
          </a>

          <h1 className="text-[2.6rem] leading-[1.04] font-extrabold tracking-tight text-white text-balance sm:text-6xl lg:text-[4.25rem]">
            Reliable Irrigation. Healthier Lawns. <span className="text-[#7BD47F]">Lower Water Bills.</span>
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/85 sm:text-xl">
            Professional sprinkler installations, repairs, and water-saving irrigation solutions in Sacramento and
            surrounding areas.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#contact" className={btnPrimary}>
              Get a Free Estimate
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </a>
            <a href={business.phoneHref} className={btnGhostLight}>
              <Phone className="h-5 w-5" aria-hidden="true" />
              Call {business.phoneDisplay}
            </a>
          </div>

          <p className="mt-7 flex items-center gap-2 text-sm font-medium text-white/75">
            <MapPin className="h-4 w-4 text-leaf" aria-hidden="true" />
            Serving {business.serviceArea}
          </p>
        </div>
      </div>
    </section>
  )
}
