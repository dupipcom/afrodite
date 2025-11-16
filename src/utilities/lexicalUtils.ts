/**
 * Utility functions for working with Lexical editor content
 */

import type { SerializedEditorState } from '@payloadcms/richtext-lexical'

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

