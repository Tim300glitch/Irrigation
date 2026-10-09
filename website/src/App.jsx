import { useCallback, useState } from 'react'
import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'
import Services from './components/Services.jsx'
import WaterSavings from './components/WaterSavings.jsx'
import Offers from './components/Offers.jsx'
import WhyChoose from './components/WhyChoose.jsx'
import Contact from './components/Contact.jsx'
import Footer from './components/Footer.jsx'
import MobileActionBar from './components/MobileActionBar.jsx'
import { useReveal } from './useReveal.js'

export default function App() {
  const [service, setService] = useState('')
  useReveal()

  // Offer buttons pre-select the matching service, then jump to the form.
  const requestEstimate = useCallback((preset) => {
    if (preset) setService(preset)
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => document.getElementById('name')?.focus({ preventScroll: true }), 600)
  }, [])

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:shadow-lift"
      >
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Hero />
        <Services />
        <WaterSavings />
        <Offers onRequest={requestEstimate} />
        <WhyChoose />
        <Contact service={service} setService={setService} />
      </main>
      <Footer />
      <MobileActionBar />
    </>
  )
}
