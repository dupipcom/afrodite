/**
 * Shared revalidation function that makes an external call to revalidate paths
 * instead of using Next.js native revalidatePath method.
 */

interface RevalidateOptions {
  path: string
  tag?: string
}

export async function revalidatePathExternal({ path, tag }: RevalidateOptions): Promise<void> {
  const revalidateUrl = process.env.REVALIDATE_PATH
  const revalidateSecret = process.env.REVALIDATE_SECRET

  const nextPath = path.startsWith('/') ? path.slice(1) : path

  if (!revalidateUrl) {
    console.warn('REVALIDATE_PATH environment variable is not set. Skipping revalidation.')
    return
  }

  if (!revalidateSecret) {
    console.warn('REVALIDATE_SECRET environment variable is not set. Skipping revalidation.')
    return
  }

  try {
    const payload = {
      paths: [nextPath, '/', '/blog'],
      tags: ['pages-sitemap', 'posts-sitemap'],
      secretKey: revalidateSecret,
    }

    const response = await fetch(revalidateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Revalidation failed: ${response.status} ${response.statusText}`)
    }
  } catch (error) {
    console.error(`Failed to revalidate path ${path}:`, error)
    // Don't throw - we don't want revalidation failures to break the save operation
  }
}

