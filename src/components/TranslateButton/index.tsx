'use client'

import React, { useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import { Button } from '@payloadcms/ui'

export const TranslateButton: React.FC = () => {
  const { id, collectionSlug } = useDocumentInfo()
  const [isTranslating, setIsTranslating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleTranslate = async () => {
    if (!id || !collectionSlug) {
      setError('Document ID or collection slug is missing')
      return
    }

    setIsTranslating(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionSlug,
          documentId: id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Translation failed')
      }

      setSuccess(true)
      
      // Reload the page to show the new translations
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during translation')
    } finally {
      setIsTranslating(false)
    }
  }

  return (
    <div style={{ marginTop: '1rem', marginBottom: '1rem', padding: '1rem', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
      <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Auto-Translate</h3>
      <p style={{ marginBottom: '1rem', color: '#666', fontSize: '0.875rem' }}>
        Translate all localized fields from the default locale to all other supported locales using AI.
      </p>
      <Button
        onClick={handleTranslate}
        disabled={isTranslating}
        buttonStyle="primary"
      >
        {isTranslating ? 'Translating...' : 'Translate All Locales'}
      </Button>
      {error && (
        <div style={{ marginTop: '0.5rem', color: '#d32f2f', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ marginTop: '0.5rem', color: '#2e7d32', fontSize: '0.875rem' }}>
          Translation completed successfully! Reloading...
        </div>
      )}
    </div>
  )
}

export default TranslateButton

