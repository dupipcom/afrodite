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
 * Extract text from a node and its children
 */
function extractTextFromNode(node: any): string {
  let text = ''
  if (node.type === 'text' && node.text && typeof node.text === 'string') {
    text += node.text
  }
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      text += extractTextFromNode(child)
    }
  }
  return text
}

/**
 * Check if a node is a paragraph-like node (paragraph, heading, listitem)
 */
function isParagraphLikeNode(node: any): boolean {
  return node.type === 'paragraph' || node.type === 'heading' || node.type === 'listitem'
}

/**
 * Translate Lexical editor state while preserving all structure, formatting, and blocks
 * This function processes text in chunks of 3 paragraphs to avoid API rate limits
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
   * Collect all paragraph-like nodes (paragraphs, headings, list items) from root children
   */
  function collectParagraphNodes(children: any[]): any[] {
    const paragraphNodes: any[] = []
    for (const child of children) {
      // If it's a paragraph-like node, add it
      if (isParagraphLikeNode(child)) {
        paragraphNodes.push(child)
      } else if (child.type === 'list' && child.children) {
        // For lists, collect list items
        for (const listItem of child.children) {
          if (listItem.type === 'listitem') {
            paragraphNodes.push(listItem)
          }
        }
      } else if (child.type === 'block') {
        // For blocks, we'll translate them separately (they might contain paragraphs)
        // For now, we'll process them individually
        paragraphNodes.push(child)
      }
    }
    return paragraphNodes
  }

  /**
   * Collect all text nodes from a node tree
   */
  function collectTextNodes(node: any): Array<{ node: any; text: string }> {
    const textNodes: Array<{ node: any; text: string }> = []
    
    function traverse(n: any): void {
      if (n.type === 'text' && n.text && typeof n.text === 'string' && n.text.trim()) {
        textNodes.push({ node: n, text: n.text })
      }
      if (n.children && Array.isArray(n.children)) {
        for (const child of n.children) {
          traverse(child)
        }
      }
    }
    
    traverse(node)
    return textNodes
  }

  /**
   * Translate a chunk of paragraph nodes by batching their text
   */
  async function translateParagraphChunk(nodes: any[]): Promise<void> {
    // Collect all text nodes from this chunk
    const allTextNodes: Array<{ node: any; text: string }> = []
    for (const node of nodes) {
      const textNodes = collectTextNodes(node)
      allTextNodes.push(...textNodes)
    }

    if (allTextNodes.length === 0) {
      return
    }

    // If only one text node, translate it directly
    if (allTextNodes.length === 1) {
      try {
        const translatedText = await translateFn(
          allTextNodes[0].text,
          sourceLocale,
          targetLocale,
        )
        allTextNodes[0].node.text = translatedText
      } catch (error) {
        console.error('Failed to translate text node:', error)
      }
      return
    }

    // Combine all text with a separator that's unlikely to appear in content
    const separator = ' |||TRANSLATE_SEPARATOR||| '
    const combinedText = allTextNodes.map((tn) => tn.text).join(separator)

    try {
      // Translate the combined text
      const translatedCombined = await translateFn(combinedText, sourceLocale, targetLocale)

      // Split back by the separator
      const translatedParts = translatedCombined.split(separator)

      // Map translated parts back to text nodes
      // If the number of parts matches, use them directly
      // Otherwise, try to distribute proportionally
      if (translatedParts.length === allTextNodes.length) {
        for (let i = 0; i < allTextNodes.length; i++) {
          allTextNodes[i].node.text = translatedParts[i].trim()
        }
      } else {
        // If splitting didn't work perfectly, fall back to individual translation
        console.warn(
          `Translation split mismatch: expected ${allTextNodes.length} parts, got ${translatedParts.length}. Falling back to individual translation.`,
        )
        for (const textNode of allTextNodes) {
          try {
            const translatedText = await translateFn(
              textNode.text,
              sourceLocale,
              targetLocale,
            )
            textNode.node.text = translatedText
          } catch (error) {
            console.error('Failed to translate text node:', error)
          }
        }
      }
    } catch (error) {
      // If batch translation fails, fall back to individual translation
      console.error('Batch translation failed, falling back to individual:', error)
      for (const textNode of allTextNodes) {
        try {
          const translatedText = await translateFn(
            textNode.text,
            sourceLocale,
            targetLocale,
          )
          textNode.node.text = translatedText
        } catch (error) {
          console.error('Failed to translate text node:', error)
        }
      }
    }
  }

  // Get root children
  const rootChildren = translatedState.root.children || []
  
  // Collect paragraph-like nodes
  const paragraphNodes = collectParagraphNodes(rootChildren)
  
  // If we have 3 or fewer paragraph nodes, translate them all at once
  if (paragraphNodes.length <= 3) {
    for (const node of paragraphNodes) {
      await translateNodeText(node)
    }
  } else {
    // Chunk paragraph nodes into groups of 3
    const chunkSize = 3
    for (let i = 0; i < paragraphNodes.length; i += chunkSize) {
      const chunk = paragraphNodes.slice(i, i + chunkSize)
      await translateParagraphChunk(chunk)
      
      // Add a small delay between chunks to avoid rate limiting
      if (i + chunkSize < paragraphNodes.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }
  }

  // Also translate any remaining nodes that aren't paragraph-like
  for (const child of rootChildren) {
    if (!isParagraphLikeNode(child) && child.type !== 'list' && child.type !== 'block') {
      await translateNodeText(child)
    } else if (child.type === 'block') {
      // Translate blocks individually (they may contain their own paragraphs)
      await translateNodeText(child)
    }
  }

  return translatedState
}

