'use client';

/**
 * The three doors, at the end of every marketing page.
 *
 * WHY IT IS IN THE LAYOUT AND NOT ON EACH PAGE. The site's problem was never its
 * argument — the copy is careful and says true things — it was that a page ended and
 * then nothing happened. Seventeen pieces of copy told the reader to telephone a number
 * the site does not have yet, and the one form that worked was linked from two places,
 * both of them inside the partner portal, which needs an invite from an operator. A
 * discharge planner had to already be a customer to find the form that makes them one.
 *
 * Putting this in the layout means a page cannot be written that has no way out of it,
 * for the same reason the statutory footer is there: a page cannot opt out of its own
 * layout.
 *
 * `usePathname` rather than a prop, because a server layout does not know the route, and
 * a door that offers you the room you are standing in reads as a site that is not paying
 * attention.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Door {
  href: string;
  eyebrow: string;
  title: string;
  body: string;
  primary?: boolean;
}

const DOORS: Door[] = [
  {
    href: '/enquire',
    eyebrow: 'For families',
    title: 'Arrange care',
    body: 'Tell us what is needed and we will call you back, usually within the hour if '
      + 'somebody is discharging today.',
    primary: true,
  },
  {
    href: '/refer',
    eyebrow: 'For hospitals and practices',
    title: 'Refer a patient',
    body: 'One form, no account, and a call back from a named person. Initials only — we '
      + 'do not need a name until the family has spoken to us.',
  },
  {
    href: '/apply',
    eyebrow: 'For nurses and caregivers',
    title: 'Apply to be referred',
    body: 'You set your rate, you choose what you take, and you are never charged a fee '
      + 'of any kind.',
  },
];

export function CallToAction() {
  const path = usePathname();
  const doors = DOORS.filter((d) => d.href !== path);
  if (doors.length === 0) return null;

  return (
    <aside className="cta" aria-label="Get in touch">
      <div className="cta-grid">
        {doors.map((d) => (
          <Link key={d.href} href={d.href} className={d.primary ? 'cta-card is-primary' : 'cta-card'}>
            <span className="label">{d.eyebrow}</span>
            <span className="cta-title">{d.title}</span>
            <span className="cta-body">{d.body}</span>
            <span className="cta-go" aria-hidden>→</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
