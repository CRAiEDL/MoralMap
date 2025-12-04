import type { NextConfig } from 'next'

const ABSOLUTE_URL_REGEX = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//

const rawBasePath =
  process.env.NEXT_PUBLIC_BASE_PATH ??
  process.env.NEXT_PUBLIC_WEBFLOW_BASE_PATH ??
  ''

const normalizedBasePath = (() => {
  if (!rawBasePath || rawBasePath === '/') return ''

  if (ABSOLUTE_URL_REGEX.test(rawBasePath)) {
    console.warn(
      `Ignoring absolute base path value "${rawBasePath}"; NEXT_PUBLIC_BASE_PATH must be a path such as /foo`
    )
    return ''
  }

  return `${rawBasePath.startsWith('/') ? '' : '/'}${rawBasePath.replace(/\/$/, '')}`
})()

const staticAssetPaths = [
  '/favicon.ico',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png',
  '/robots.txt',
]
const publicUrlPlaceholder = '/%PUBLIC_URL%'

const nextConfig: NextConfig = {
  // Ensure React Router is bundled correctly
  transpilePackages: ['react-router-dom'],
  basePath: normalizedBasePath || undefined,
  assetPrefix: normalizedBasePath || undefined,
  env: {
    // Expose the normalized base path to the browser so client-side helpers
    // like withBasePath can build URLs that match Next.js routing.
    NEXT_PUBLIC_BASE_PATH: normalizedBasePath || '',
  },
  async redirects() {
    if (!normalizedBasePath) {
      return []
    }

    const baseRedirects = [
      {
        source: '/',
        destination: `${normalizedBasePath}/`,
        basePath: false,
        permanent: false,
      },
    ]

    const assetRedirects = staticAssetPaths.map((path) => ({
      source: path,
      destination: `${normalizedBasePath}${path}`,
      basePath: false,
      permanent: false,
    }))

    const placeholderRootRedirects = [
      {
        source: publicUrlPlaceholder,
        destination: `${normalizedBasePath}/`,
        basePath: false,
        permanent: false,
      },
      {
        source: `${normalizedBasePath}${publicUrlPlaceholder}`,
        destination: `${normalizedBasePath}/`,
        basePath: false,
        permanent: false,
      },
    ]

    const placeholderAssetRedirects = staticAssetPaths.flatMap((path) => {
      const placeholderPath = `${publicUrlPlaceholder}${path}`
      return [
        {
          source: placeholderPath,
          destination: `${normalizedBasePath}${path}`,
          basePath: false,
          permanent: false,
        },
        {
          source: `${normalizedBasePath}${placeholderPath}`,
          destination: `${normalizedBasePath}${path}`,
          basePath: false,
          permanent: false,
        },
      ]
    })

    return [
      ...baseRedirects,
      ...assetRedirects,
      ...placeholderRootRedirects,
      ...placeholderAssetRedirects,
    ]
  },
}

export default nextConfig

