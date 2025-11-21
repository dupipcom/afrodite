'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import { Button } from '@payloadcms/ui'
import { Checkbox } from '@/components/ui/checkbox'
import { locales, localeNames } from '@/i18n/locales'

export const TranslateButton: React.FC = () => {
  const { id, collectionSlug } = useDocumentInfo()
  const [isTranslating, setIsTranslating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [selectedLocales, setSelectedLocales] = useState<string[]>([])
  const [translatingLocale, setTranslatingLocale] = useState<string | null>(null)
  const [completedLocales, setCompletedLocales] = useState<Set<string>>(new Set())
  const [failedLocales, setFailedLocales] = useState<Set<string>>(new Set())

  // Get available target locales (excluding the source locale 'en')
  // Memoize to prevent unnecessary recalculations
  const sourceLocale = 'en'
  const availableLocales = useMemo(() => {
    return locales
      .map((loc) => loc.code)
      .filter((code) => code !== sourceLocale)
  }, [])

  // Initialize with all locales selected by default (only once on mount)
  useEffect(() => {
    if (availableLocales.length > 0) {
      setSelectedLocales((prev) => {
        // Only initialize if not already set
        if (prev.length === 0) {
          return [...availableLocales]
        }
        return prev
      })
    }
  }, [availableLocales])

  const handleLocaleToggle = useCallback((localeCode: string) => {
    setSelectedLocales((prev) =>
      prev.includes(localeCode)
        ? prev.filter((code) => code !== localeCode)
        : [...prev, localeCode]
    )
  }, [])

  const handleSelectAll = useCallback((checked?: boolean) => {
    setSelectedLocales((prev) => {
      const shouldSelectAll = checked !== undefined ? checked : prev.length !== availableLocales.length
      if (shouldSelectAll) {
        return [...availableLocales]
      } else {
        return []
      }
    })
  }, [availableLocales])

  const handleLocaleCheckboxChange = useCallback((localeCode: string, checked: boolean) => {
    setSelectedLocales((prev) => {
      if (checked) {
        return prev.includes(localeCode) ? prev : [...prev, localeCode]
      } else {
        return prev.filter((code) => code !== localeCode)
      }
    })
  }, [])

  const handleTranslate = async () => {
    if (!id || !collectionSlug) {
      setError('Document ID or collection slug is missing')
      return
    }

    if (selectedLocales.length === 0) {
      setError('Please select at least one locale to translate to')
      return
    }

    setIsTranslating(true)
    setError(null)
    setSuccess(false)
    setCompletedLocales(new Set())
    setFailedLocales(new Set())
    setTranslatingLocale(null)

    const completed: Set<string> = new Set()
    const failed: Set<string> = new Set()

    // Translate each locale in a separate API request
    for (const locale of selectedLocales) {
      try {
        setTranslatingLocale(locale)
        
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            collectionSlug,
            documentId: id,
            targetLocales: [locale], // Send single locale per request
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || `Translation failed for ${locale}`)
        }

        // Mark this locale as completed
        completed.add(locale)
        failed.delete(locale)
        setCompletedLocales(new Set(completed))
        setFailedLocales(new Set(failed))
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : `An error occurred during translation for ${locale}`
        console.error(`Translation error for ${locale}:`, err)
        
        // Mark this locale as failed
        failed.add(locale)
        completed.delete(locale)
        setFailedLocales(new Set(failed))
        setCompletedLocales(new Set(completed))
        
        // Set error but continue with other locales
        setError(errorMessage)
      } finally {
        setTranslatingLocale(null)
      }
    }

    setIsTranslating(false)
    
    // If at least one locale succeeded, show success
    if (completed.size > 0) {
      setSuccess(true)
      // Reload the page to show the new translations
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    }
  }

  return (
    <div style={{ marginTop: '1rem', marginBottom: '1rem', padding: '1rem', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
      <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Auto-Translate</h3>
      <p style={{ marginBottom: '1rem', color: '#666', fontSize: '0.875rem' }}>
        Translate all localized fields from the default locale to selected locales using AI.
      </p>
      
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
          <Checkbox
            checked={selectedLocales.length === availableLocales.length && availableLocales.length > 0}
            onCheckedChange={(checked) => handleSelectAll(checked === true)}
            style={{ marginRight: '0.5rem' }}
          />
          <span
            style={{
              fontSize: '0.875rem',
              fontWeight: '500',
              userSelect: 'none',
            }}
          >
            Select All
          </span>
        </div>
        
        <div
          style={{
            maxHeight: '200px',
            overflowY: 'auto',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            padding: '0.5rem',
          }}
        >
          {availableLocales.map((localeCode) => {
            const isChecked = selectedLocales.includes(localeCode)
            const isTranslating = translatingLocale === localeCode
            const isCompleted = completedLocales.has(localeCode)
            const isFailed = failedLocales.has(localeCode)
            
            return (
              <div
                key={localeCode}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.5rem',
                  backgroundColor: isTranslating ? '#e3f2fd' : isCompleted ? '#e8f5e9' : isFailed ? '#ffebee' : 'transparent',
                }}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked) => handleLocaleCheckboxChange(localeCode, checked === true)}
                  style={{ marginRight: '0.5rem' }}
                  disabled={isTranslating}
                />
                <span
                  style={{
                    fontSize: '0.875rem',
                    userSelect: 'none',
                    flex: 1,
                    fontWeight: isTranslating ? '600' : 'normal',
                    color: isFailed ? '#d32f2f' : isCompleted ? '#2e7d32' : 'inherit',
                  }}
                >
                  {localeNames[localeCode] || localeCode}
                  {isTranslating && ' (translating...)'}
                  {isCompleted && ' ✓'}
                  {isFailed && ' ✗'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <Button
        onClick={handleTranslate}
        disabled={isTranslating || selectedLocales.length === 0}
        buttonStyle="primary"
      >
        {isTranslating
          ? translatingLocale
            ? `Translating ${localeNames[translatingLocale] || translatingLocale}... (${completedLocales.size + 1}/${selectedLocales.length})`
            : `Translating... (${completedLocales.size}/${selectedLocales.length})`
          : `Translate to ${selectedLocales.length} Locale${selectedLocales.length !== 1 ? 's' : ''}`}
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

