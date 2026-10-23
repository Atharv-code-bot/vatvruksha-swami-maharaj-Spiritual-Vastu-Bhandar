// Image component — resolves a Firebase Storage path to a download URL,
// with graceful placeholder fallback when the bucket/path is unavailable.
// Images in Firestore are Storage paths, not URLs.
import { useState, useEffect } from 'react'
import { ref, getDownloadURL } from 'firebase/storage'
import { storage } from '../../firebase.js'
import { STORAGE_IMAGE_PLACEHOLDER } from '../../config/constants.js'

const isExternalUrl = (value) => {
  if (!value || typeof value !== 'string') return false
  return /^https?:\/\//i.test(value) || value.startsWith('data:')
}

export default function Image({ src, className = '', alt = '', ...props }) {
  const [url, setUrl] = useState(STORAGE_IMAGE_PLACEHOLDER)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)

    if (!src) {
      setUrl(STORAGE_IMAGE_PLACEHOLDER)
      return
    }

    if (isExternalUrl(src)) {
      setUrl(src)
      return
    }

    try {
      const storageRef = ref(storage, src)
      getDownloadURL(storageRef)
        .then(setUrl)
        .catch(() => {
          setFailed(true)
          setUrl(STORAGE_IMAGE_PLACEHOLDER)
        })
    } catch {
      setFailed(true)
      setUrl(STORAGE_IMAGE_PLACEHOLDER)
    }
  }, [src])

  const finalSrc = failed || !url ? STORAGE_IMAGE_PLACEHOLDER : url

  return (
    <img
      src={finalSrc}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      {...props}
      loading="lazy"
      decoding="async"
    />
  )
}
