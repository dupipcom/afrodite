/**
 * Utility functions for working with Lexical editor content
 */

import type { SerializedEditorState } from '@payloadcms/richtext-lexical'

/**
 * Translate function type for translating text
 */
type TranslateFunction = (text: string, sourceLocale: string, targetLocale: string) => Promise<string>

/**
 * Extract plain text from Lexical editor state
 */
export function extractTextFromLexical(
  editorState: SerializedEditorState | null | undefined,
): string {
  if (!editorState || !editorState.root) {
    return ''
  }

  let text = ''

  function traverseNode(node: any): void {
    if (node.text) {
      text += node.text
    }

    if (node.children) {
      for (const child of node.children) {
        traverseNode(child)
      }
    }
  }

  traverseNode(editorState.root)
  return text.trim()
}

/**
 * Convert plain text back to a simple Lexical editor state
 */
export function textToLexicalState(text: string): SerializedEditorState {
  // Split text into paragraphs
  const paragraphs = text.split('\n\n').filter((p) => p.trim())

  const children = paragraphs.map((paragraph) => ({
    children: [
      {
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
        text: paragraph.trim(),
        type: 'text',
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'paragraph',
    version: 1,
  }))

  return {
    root: {
      children,
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }
}

/**
 * Check if a node has any text content (non-empty text nodes)
 */
function hasTextContent(node: any): boolean {
  if (node.type === 'text' && node.text && typeof node.text === 'string' && node.text.trim()) {
    return true
  }
  if (node.children && Array.isArray(node.children)) {
    return node.children.some((child: any) => hasTextContent(child))
  }
  return false
}

/**
 * Translate Lexical editor state while preserving all structure, formatting, and blocks
 * Translates entire content at once without chunking
 */
export async function translateLexicalState(
  editorState: SerializedEditorState | null | undefined,
  translateFn: TranslateFunction,
  sourceLocale: string,
  targetLocale: string,
): Promise<SerializedEditorState | null> {
  if (!editorState || !editorState.root) {
    return editorState
  }

  // Deep clone the entire structure to avoid mutating the original
  const translatedState = JSON.parse(JSON.stringify(editorState))
  
  // Log structure for debugging (can be removed in production)
  if (process.env.NODE_ENV === 'development') {
    const nodeTypes = new Set<string>()
    function collectNodeTypes(node: any): void {
      if (node.type) {
        nodeTypes.add(node.type)
      }
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(collectNodeTypes)
      }
    }
    collectNodeTypes(translatedState.root)
    console.log(`Translating Lexical state with node types: ${Array.from(nodeTypes).join(', ')}`)
  }

  /**
   * Translate text within a single node tree
   * Skips empty text nodes
   */
  async function translateNodeText(node: any): Promise<void> {
    // Only translate non-empty text nodes
    if (node.type === 'text' && node.text && typeof node.text === 'string') {
      const trimmedText = node.text.trim()
      if (trimmedText) {
        try {
          const translatedText = await translateFn(trimmedText, sourceLocale, targetLocale)
          node.text = translatedText
        } catch (error) {
          console.error('Failed to translate text node:', error)
        }
      }
      // Skip processing children if this is a text node (text nodes don't have children)
      return
    }

    // Recursively process children for non-text nodes
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        await translateNodeText(child)
      }
    }
  }

  // Get root children
  const rootChildren = translatedState.root.children || []
  
  // Translate all nodes - process entire content at once
  for (const child of rootChildren) {
    // Skip if node has no text content
    if (!hasTextContent(child)) {
      continue
    }
    
    await translateNodeText(child)
  }

  return translatedState
}

