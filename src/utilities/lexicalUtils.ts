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
 * Translate Lexical editor state while preserving all structure, formatting, and blocks
 * This function recursively traverses the state, translating only text nodes
 * while preserving all other nodes (blocks, headings, paragraphs, formatting, etc.) exactly as they are
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
  // This preserves ALL properties of the editorState, not just root
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
   * Recursively traverse and translate text nodes
   * Preserves all non-text nodes (blocks, headings, paragraphs, formatting, etc.)
   * 
   * Node types that are preserved as-is:
   * - 'heading' (with tag: 'h1', 'h2', 'h3', 'h4')
   * - 'paragraph'
   * - 'block' (embedded blocks like mediaBlock, banner, code, cta)
   * - 'link'
   * - 'list' and 'listitem'
   * - 'horizontalrule'
   * - Any other non-text node type
   */
  async function translateNode(node: any): Promise<void> {
    // Only translate actual text nodes with text content
    // All other node types are preserved completely, including:
    // - Headings (type: 'heading' with tag: 'h1'/'h2'/'h3'/'h4')
    // - Blocks (type: 'block' with fields and blockType)
    // - Paragraphs, links, lists, etc.
    if (node.type === 'text' && node.text && typeof node.text === 'string' && node.text.trim()) {
      try {
        const translatedText = await translateFn(node.text, sourceLocale, targetLocale)
        node.text = translatedText
      } catch (error) {
        // If translation fails, keep original text
        console.error('Failed to translate text node:', error)
      }
    }

    // Recursively process children (for all node types)
    // This ensures we translate text within headings, paragraphs, links, blocks, etc.
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        await translateNode(child)
      }
    }

    // Note: Block nodes may have a 'fields' property that contains block data
    // These fields are preserved as-is since we only translate text nodes
    // The entire block structure (including blockType, fields, etc.) remains unchanged
  }

  // Translate the root node and all its children
  await translateNode(translatedState.root)

  // Return the complete translated state with all properties preserved
  // This includes the root node with all its children (headings, paragraphs, blocks, etc.)
  // and any other top-level properties that might exist on the editorState
  return translatedState
}

