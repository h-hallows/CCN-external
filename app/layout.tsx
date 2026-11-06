import type { Metadata, Viewport } from 'next';
import { DISPLAY_NAME, NOT_PUBLISHED_TITLE, legalNameResolved } from '@/lib/brand';
import { siteUrl } from '@/lib/site';
import './globals.css';

/**
 * metadataBase makes every canonical and OpenGraph URL absolute. Without it Next emits
 * relative ones, which a crawler resolves against whatever host it happened to reach —
 * including a preview deployment.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  /*
   * While the name is unresolved the template would append PENDING_LEGAL_NAME to
   * every page title — a sentinel in the browser tab and in every link preview.
   */
  title: legalNameResolved()
    ? { default: DISPLAY_NAME, template: `%s · ${DISPLAY_NAME}` }
    : { default: NOT_PUBLISHED_TITLE, template: '%s' },
  /*
   * The root description and og:site_name are advertising copy and a business name,
   * so they are withheld with everything else — otherwise they reached every page,
   * including the 404, while the body said the site was not published.
   */
  ...(legalNameResolved()
    ? {
      description:
        'A private nursing and caregiver referral registry serving Century City and West '
        + 'Los Angeles.',
      openGraph: { type: 'website' as const, siteName: DISPLAY_NAME, locale: 'en_US' },
    }
    : {}),
  alternates: { canonical: '/' },
  // No licensure, accreditation or award anywhere in metadata — § 1812.5095(i)–(j).
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-US">
      <body>{children}</body>
    </html>
  );
}
