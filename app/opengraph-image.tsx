import { ImageResponse } from 'next/og';
import { DISPLAY_NAME, brandBlockers, nameIsFiled } from '@/lib/brand';

/**
 * The card a link to this site previews as.
 *
 * There was no public/ directory at all — not empty, absent — so every icon and every
 * OpenGraph image 404'd. A discharge planner pasting a link into an email to a family
 * got a blank rectangle, which is the first impression the whole marketing site exists
 * to make.
 *
 * Generated rather than a file, because the name on it is a variable: it reads whatever
 * `lib/brand.ts` resolves, so the day counsel clears a trading name this follows without
 * anybody opening an image editor. While the site is withheld entirely it says so,
 * rather than advertising under a stand-in — § 1812.533(b)(2) asks for the correct name
 * in every advertisement, and a link preview is an advertisement.
 */
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'A private nursing and caregiver referral registry in West Los Angeles.';

export default function OpengraphImage() {
  const withheld = brandBlockers().length > 0;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', background: '#FBF9F6', color: '#1A1715',
          padding: '72px 80px', fontSize: 32,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 10, background: '#6B2733',
          }} />
          <div style={{ fontSize: 34, letterSpacing: '-0.01em' }}>
            {withheld ? 'Not yet published' : DISPLAY_NAME}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 68, lineHeight: 1.1, letterSpacing: '-0.02em', maxWidth: 940 }}>
            {withheld
              ? 'This site is not published yet.'
              : 'Care at home, arranged by someone who answers the phone.'}
          </div>
          {withheld ? null : (
            <div style={{ fontSize: 30, color: '#55504A' }}>
              A private nursing and caregiver referral registry · West Los Angeles
            </div>
          )}
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', fontSize: 24, color: '#847D75',
        }}>
          <span>{withheld ? '' : 'We refer; you engage directly.'}</span>
          <span>{nameIsFiled() ? '' : ''}</span>
        </div>
      </div>
    ),
    size,
  );
}
