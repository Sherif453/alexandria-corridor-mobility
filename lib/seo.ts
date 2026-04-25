import type { Metadata } from "next";

const FALLBACK_SITE_URL = "http://localhost:3000";
const SOCIAL_IMAGE_PATH = "/opengraph-image";
const TWITTER_IMAGE_PATH = "/twitter-image";

export const siteConfig = {
  name: "Alexandria Corridor Mobility Intelligence",
  shortName: "Alex Mobility",
  description:
    "Live traffic, 15-minute congestion forecasts, historical trends, and scenario planning for the Victoria to Sidi Gaber to Raml corridor in Alexandria, Egypt.",
  keywords: [
    "Alexandria traffic",
    "Alexandria mobility",
    "Alexandria corridor",
    "traffic intelligence",
    "traffic dashboard",
    "congestion forecast",
    "corridor analytics",
    "transport planning",
    "Alexandria Egypt",
    "Victoria Sidi Gaber Raml",
  ],
} as const;

type PageMetadataInput = {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
};

function normalizeSiteUrl(value: string | undefined | null): URL | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(candidate);
  } catch {
    return null;
  }
}

export function getSiteUrl(): URL {
  return (
    normalizeSiteUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeSiteUrl(process.env.APP_BASE_URL) ??
    normalizeSiteUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeSiteUrl(process.env.VERCEL_URL) ??
    new URL(FALLBACK_SITE_URL)
  );
}

function getCanonicalPath(path: string | undefined): string {
  if (!path || path === "/") {
    return "/";
  }

  return path.startsWith("/") ? path : `/${path}`;
}

function buildTitle(title: string): string {
  return title === siteConfig.name ? title : `${title} | ${siteConfig.name}`;
}

export const defaultMetadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  referrer: "origin-when-cross-origin",
  keywords: [...siteConfig.keywords],
  category: "transportation",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    title: siteConfig.name,
    description: siteConfig.description,
    url: "/",
    siteName: siteConfig.name,
    images: [
      {
        url: SOCIAL_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} social preview`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [TWITTER_IMAGE_PATH],
  },
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export function createPageMetadata({
  title,
  description,
  path = "/",
  keywords = [],
}: PageMetadataInput): Metadata {
  const canonicalPath = getCanonicalPath(path);
  const mergedKeywords = Array.from(new Set([...siteConfig.keywords, ...keywords]));

  return {
    title,
    description,
    keywords: mergedKeywords,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: "website",
      title: buildTitle(title),
      description,
      url: canonicalPath,
      siteName: siteConfig.name,
      images: [
        {
          url: SOCIAL_IMAGE_PATH,
          width: 1200,
          height: 630,
          alt: `${siteConfig.name} social preview`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: buildTitle(title),
      description,
      images: [TWITTER_IMAGE_PATH],
    },
  };
}
