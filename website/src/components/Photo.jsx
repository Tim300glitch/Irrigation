import { useState } from 'react'

// Responsive image that falls back to a branded panel if the photo can't load,
// so visitors never see a broken-image icon.
export default function Photo({ image, sizes = '100vw', className = '', priority = false }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <div role="img" aria-label={image.alt} className={`photo-fallback ${className}`} />
  }

  return (
    <img
      src={image.src}
      srcSet={image.srcSet}
      sizes={sizes}
      alt={image.alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      onError={() => setFailed(true)}
      className={`bg-navy-800 object-cover ${className}`}
    />
  )
}
