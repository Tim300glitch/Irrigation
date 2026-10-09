// ─────────────────────────────────────────────────────────────
// Site settings — edit this file to update business details,
// the estimate-form destination, and photos.
// ─────────────────────────────────────────────────────────────

export const business = {
  name: 'DeltaLine Irrigation',
  city: 'Sacramento, California',
  serviceArea: 'Sacramento and surrounding communities',
  phoneDisplay: '(916) 426-3004',
  phoneHref: 'tel:+19164263004',
}

// Estimate-request form (FormSubmit.co — free, no backend).
// Set VITE_FORM_EMAIL in your hosting dashboard (recommended), or type the
// address between the quotes below. While this is empty the form tells
// visitors to call instead and does not pretend to send anything.
export const formEmail = import.meta.env.VITE_FORM_EMAIL || ''

// Photos. Free to use under the Unsplash License (https://unsplash.com/license).
// To use your own job photos instead, put files in /public/images and
// set `src` to e.g. '/images/hero.jpg' (and remove `unsplashId`).
const unsplash = (id, w) => `https://unsplash.com/photos/${id}/download?w=${w}`

function photo({ unsplashId, src, alt, credit }) {
  if (src) return { src, srcSet: undefined, alt, credit }
  return {
    src: unsplash(unsplashId, 1600),
    srcSet: [640, 1080, 1600, 2200].map((w) => `${unsplash(unsplashId, w)} ${w}w`).join(', '),
    alt,
    credit,
  }
}

export const images = {
  hero: photo({
    unsplashId: '6DMht7wYt6g',
    alt: 'A sprinkler spraying water across a lush green lawn',
    credit: 'Unsplash',
  }),
  waterSmart: photo({
    unsplashId: '-zbcx0Lvsfw',
    alt: 'An impact sprinkler watering a healthy spring lawn',
    credit: 'Paul Moody / Unsplash',
  }),
  home: photo({
    unsplashId: 'y_ibWWpOiL0',
    alt: 'A well-kept green lawn in front of a modern home',
    credit: 'Mike Von / Unsplash',
  }),
}
