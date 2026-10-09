import { useEffect } from 'react'

// Adds a subtle fade-up to elements with the `reveal` class as they enter the viewport.
export function useReveal() {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const root = document.documentElement
    root.classList.add('reveal-ready')
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])
}
