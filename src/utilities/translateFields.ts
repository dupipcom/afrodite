/**
 * Utility functions for translating localized fields
 */

import type { PayloadRequest } from 'payload'
import type { CollectionConfig } from 'payload'
import OpenAI from 'openai'
import { extractTextFromLexical, textToLexicalState } from './lexicalUtils'
import { locales } from '@/i18n/locales'

// OPENAI_API_KEY must be set in environment variables

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Localized field definition
 */
interface LocalizedFieldDefinition {
  path: string
  type: string
  name: string
}

/**
 * Localized field with value
 */
interface LocalizedFieldWithValue {
  path: string
  type: string
  value: any
}

/**
 * Get value from nested object using dot-notation path
 */
function getNestedValue(obj: any, path: string): any {
  const parts = path.split('.')
  let current = obj

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }
    current = current[part]
  }

  return current
}

/**
 * Check if a value is empty (empty string, null, empty object, or empty Lexical state)
 */
function isEmptyValue(value: any): boolean {
  if (value === null || value === undefined) {
    return true
  }

  if (value === '') {
    return true
  }

  if (typeof value === 'object') {
    // Check for empty object
    if (Object.keys(value).length === 0) {
      return true
    }

    // Check for empty Lexical editor state
    if (value.root) {
      if (!value.root.children || value.root.children.length === 0) {
        return true
      }
      // Check if all children are empty
      const hasContent = value.root.children.some((child: any) => {
        if (child.text && child.text.trim()) {
          return true
        }
        if (child.children && child.children.length > 0) {
          return true
        }
        return false
      })
      return !hasContent
    }
  }

  return false
}

/**
 * Traverse collection fields to identify all localized fields
 * Returns field definitions with their paths and types
 */
function getLocalizedFieldDefinitions(
  fields: any[],
  currentPath: string = '',
): LocalizedFieldDefinition[] {
  const definitions: LocalizedFieldDefinition[] = []

  for (const field of fields) {
    // Skip UI fields
    if (field.type === 'ui') {
      continue
    }

    // Handle tabs - tab fields are flattened at the root level in the document
    if (field.type === 'tabs' && field.tabs) {
      for (const tab of field.tabs) {
        if (tab.fields && Array.isArray(tab.fields)) {
          // Tab fields are at the root level, not nested
          definitions.push(...getLocalizedFieldDefinitions(tab.fields, currentPath))
        }
      }
      continue
    }

    // Check if this field is localized - must be explicitly set to true
    if (field.name) {
      // Only include if localized is explicitly true
      if (field.localized === true) {
        const fieldPath = currentPath ? `${currentPath}.${field.name}` : field.name
        definitions.push({
          path: fieldPath,
          type: field.type,
          name: field.name,
        })
      }
    }

    // Handle nested fields (groups, etc.)
    if (field.fields && Array.isArray(field.fields) && field.type !== 'tabs') {
      const nestedPath = currentPath ? `${currentPath}.${field.name}` : field.name
      definitions.push(...getLocalizedFieldDefinitions(field.fields, nestedPath))
    }

    // Handle arrays
    if (field.type === 'array' && field.fields && Array.isArray(field.fields)) {
      const arrayPath = currentPath ? `${currentPath}.${field.name}` : field.name
      // For arrays, we'll process each item when reading the data
      // For now, just note the field definition
      definitions.push(...getLocalizedFieldDefinitions(field.fields, arrayPath))
    }
  }

  return definitions
}

/**
 * Extract values from document data using field definitions
 */
function extractFieldValues(
  document: Record<string, any>,
  fieldDefinitions: LocalizedFieldDefinition[],
): LocalizedFieldWithValue[] {
  const fieldsWithValues: LocalizedFieldWithValue[] = []

  for (const fieldDef of fieldDefinitions) {
    const value = getNestedValue(document, fieldDef.path)

    if (!isEmptyValue(value)) {
      fieldsWithValues.push({
        path: fieldDef.path,
        type: fieldDef.type,
        value: value,
      })
    }
  }

  return fieldsWithValues
}

/**
 * Translate text using OpenAI
 */
async function translateText(
  text: string,
  sourceLocale: string,
  targetLocale: string,
): Promise<string> {
  if (!text || !text.trim()) {
    return text
  }

  const localeNames: Record<string, string> = {
    ar: 'Arabic',
    bn: 'Bengali',
    ca: 'Catalan',
    cs: 'Czech',
    da: 'Danish',
    de: 'German',
    el: 'Greek',
    en: 'English',
    es: 'Spanish',
    et: 'Estonian',
    eu: 'Basque',
    fi: 'Finnish',
    fr: 'French',
    gl: 'Galician',
    ha: 'Hausa',
    he: 'Hebrew',
    hi: 'Hindi',
    hu: 'Hungarian',
    it: 'Italian',
    ja: 'Japanese',
    ko: 'Korean',
    ms: 'Malay',
    nl: 'Dutch',
    pa: 'Punjabi',
    pl: 'Polish',
    pt: 'Portuguese',
    ro: 'Romanian',
    ru: 'Russian',
    sv: 'Swedish',
    sw: 'Swahili',
    tr: 'Turkish',
    yo: 'Yoruba',
    zh: 'Chinese',
  }

  const sourceLanguage = localeNames[sourceLocale] || sourceLocale
  const targetLanguage = localeNames[targetLocale] || targetLocale

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate the following text from ${sourceLanguage} to ${targetLanguage}. Preserve the meaning, tone, and style. Only return the translated text, nothing else.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.3,
    })

    return response.choices[0]?.message?.content?.trim() || text
  } catch (error) {
    throw new Error(
      `Failed to translate text: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

/**
 * Extract plain text from field value based on field type
 */
function extractTextFromField(field: LocalizedFieldWithValue): string {
  if (field.type === 'richText') {
    return extractTextFromLexical(field.value)
  } else if (field.type === 'text' || field.type === 'textarea') {
    return field.value || ''
  }
  return ''
}

/**
 * Convert translated text back to field format
 */
function convertTextToFieldFormat(text: string, fieldType: string): any {
  if (fieldType === 'richText') {
    return textToLexicalState(text)
  }
  return text
}

/**
 * Merge translated values into document data structure
 */
function mergeTranslatedValues(
  document: Record<string, any>,
  translations: Record<string, any>,
): Record<string, any> {
  const result = JSON.parse(JSON.stringify(document)) // Deep clone

  for (const [path, value] of Object.entries(translations)) {
    const parts = path.split('.')
    let current: any = result

    // Navigate to the parent object
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]

      // Handle array indices
      if (!isNaN(Number(part))) {
        const index = Number(part)
        if (!Array.isArray(current) || current[index] === undefined) {
          // Can't update array item that doesn't exist
          continue
        }
        current = current[index]
      } else {
        if (!current[part] || typeof current[part] !== 'object') {
          current[part] = {}
        }
        current = current[part]
      }
    }

    // Set the final value
    const finalKey = parts[parts.length - 1]
    if (!isNaN(Number(finalKey))) {
      const index = Number(finalKey)
      if (Array.isArray(current) && current[index] !== undefined) {
        current[index] = value
      }
    } else {
      current[finalKey] = value
    }
  }

  return result
}

/**
 * Translate all localized fields for a document
 */
export async function translateDocument(
  req: PayloadRequest,
  collectionConfig: CollectionConfig,
  documentId: string,
  sourceLocale: string = 'en',
): Promise<void> {
  // Step 1: Identify all localized field definitions from the collection config
  const fieldDefinitions = getLocalizedFieldDefinitions(collectionConfig.fields || [])
  
  if (fieldDefinitions.length === 0) {
    throw new Error('No localized fields found in collection configuration')
  }

  // Step 2: Fetch the document from the database with the source locale
  const document = await req.payload.findByID({
    collection: collectionConfig.slug as any,
    id: documentId,
    locale: sourceLocale as any,
    depth: 0,
  })

  if (!document) {
    throw new Error('Document not found')
  }

  // Step 3: Extract values from the document using the field definitions
  const fieldsWithValues = extractFieldValues(document, fieldDefinitions)

  if (fieldsWithValues.length === 0) {
    throw new Error('No localized fields with values found in the document')
  }

  // Step 4: Get all target locales (excluding source)
  const targetLocales = locales.map((loc) => loc.code).filter((code) => code !== sourceLocale)

  // Step 5: Translate each field for each target locale
  const translationsByLocale: Record<string, Record<string, any>> = {}

  for (const locale of targetLocales) {
    translationsByLocale[locale] = {}
  }

  for (const field of fieldsWithValues) {
    // Extract text from the field value
    const sourceText = extractTextFromField(field)

    if (!sourceText || !sourceText.trim()) {
      continue
    }

    // Translate for each target locale
    for (const locale of targetLocales) {
      try {
        const translatedText = await translateText(sourceText, sourceLocale, locale)
        const translatedValue = convertTextToFieldFormat(translatedText, field.type)
        translationsByLocale[locale][field.path] = translatedValue
      } catch (error) {
        // Continue with other translations
      }
    }
  }

  // Step 6: Update the document for each locale
  for (const [locale, translations] of Object.entries(translationsByLocale)) {
    if (Object.keys(translations).length === 0) {
      continue
    }

    try {
      // Get current document in this locale (or use source as base if it doesn't exist)
      let currentDoc: Record<string, any>
      try {
        currentDoc = await req.payload.findByID({
          collection: collectionConfig.slug as any,
          id: documentId,
          locale: locale as any,
          depth: 0,
        })
      } catch {
        // Document doesn't exist in this locale yet, use source document as base
        currentDoc = { ...document }
      }

      // Merge translations into the document
      const updatedData = mergeTranslatedValues(currentDoc, translations)

      // Update the document
      await req.payload.update({
        collection: collectionConfig.slug as any,
        id: documentId,
        locale: locale as any,
        data: updatedData,
      })
    } catch (error) {
      throw error
    }
  }
}
