import type { Metadata } from 'next';
import { publicMetadata } from '@/lib/brand';
import { Prose, Section, Stack } from '@/components/layout';
import {
  PRIVACY_LAST_REVIEWED, privacyCommitments, type PrivacyCommitment,
} from '@/lib/site';

/**
 * What this site collects, where it goes, and who can see it.
 *
 * WHY IT EXISTS. `/refer` takes a third party's details: a discharge planner fills it
 * in about a patient who is not in the room and has never been to this site, and about
 * a family member we will telephone. Collecting somebody else's health-adjacent
 * information with no notice anywhere is an exposure, and — for the planner deciding
 * whether to send us a family at four on a Friday — a missing reason to.
 *
 * HOW IT WAS WRITTEN, which is the part to preserve. Every sentence below describes
 * something this codebase actually does, read off the code rather than off a template:
 * the fields come from lib/schemas/intake.ts, the write paths from lib/intake.ts and
 * app/api/*, the hashing and the one-day window from lib/rateLimit.ts, the content of
 * the operator email from lib/notify.ts, the cookie from lib/session.ts, and who can
 * read what from lib/portalDb.ts and the row-level policies it turns on.
 *
 * Nothing here promises a mechanism that does not exist. There is no routine in this
 * application that deletes an enquiry, so the notice says so rather than claiming a
 * right somebody would exercise into silence. The commitments only the operator or
 * counsel can make — a retention period, an address for requests, the processors, the
 * statement about sale — are read from configuration and printed as marked placeholders
 * until somebody fills them, which is the same posture lib/brand.ts takes towards the
 * business name: a plausible invention is worse than a visible blank, because a
 * deployment that reads like a decided figure is one somebody will eventually believe.
 */
export const metadata: Metadata = publicMetadata({
  title: 'Privacy',
  description:
    'What the forms on this site collect, where it goes, who can see it, and what you '
    + 'can ask us for.',
}, '/privacy');

/**
 * A commitment nobody has supplied yet, printed where the sentence would have gone.
 *
 * Marked twice over: visible to a reader, and `data-pending` for anything that goes
 * looking. A placeholder a visitor cannot see is a blank that ships.
 */
function Pending({ of }: { of: PrivacyCommitment }) {
  return (
    <span
      data-pending={of.id}
      style={{
        display: 'inline-block', padding: '.15rem .45rem', borderRadius: '6px',
        border: '1px dashed var(--crit)', color: 'var(--crit)',
        fontSize: 'var(--step--1)', lineHeight: 1.5,
      }}
    >
      PENDING — {of.needs}. To be supplied by {of.who}, as <code>{of.env}</code>.
    </span>
  );
}

/** The configured sentence, or the placeholder standing in its place. */
function Commitment({ id }: { id: string }) {
  const found = privacyCommitments().find((c) => c.id === id);
  // A commitment renamed in lib/site.ts and not here would otherwise leave a silent
  // gap in the notice, which is the one page where a missing sentence reads as a
  // deliberate one. Loud instead.
  if (!found) return <strong style={{ color: 'var(--crit)' }}>PENDING — {id}</strong>;
  return found.value ? <>{found.value}</> : <Pending of={found} />;
}

export default function Privacy() {
  return (
    <Stack gap="lg">
      <Section title="Privacy" as="h1">
        <Prose>
          <p className="lede">
            This is what the forms on this site collect, where it goes, and who can see
            it. It describes what the software does, field by field, rather than what a
            notice of this kind usually says.
          </p>
          <p>
            Some of it has not been decided yet. Those parts are marked in the text
            below instead of being filled in with something plausible — a figure nobody
            has chosen is a promise nobody has made, and you would have no way of
            telling the two apart.
          </p>
        </Prose>
      </Section>

      <Section title="What the three forms collect" as="h2">
        <Prose>
          <p>
            There are three forms on this site and they are the only way information
            reaches us from it.
          </p>
          <dl>
            <div style={{ marginBottom: '1.5rem' }}>
              <dt style={{ fontFamily: 'var(--display)', fontSize: 'var(--step-1)' }}>
                Arranging care
              </dt>
              <dd style={{ margin: '.35rem 0 0', color: 'var(--ink-2)' }}>
                Your name and a telephone number; an email address if you give one, and
                it is optional; your relationship to the person who needs care; the kind
                of care, the area, when it would start and how urgent it is; how it is
                being paid for; and anything you write in the message field. The page
                you came from is recorded alongside it, so we know which part of the
                site is doing any good.
              </dd>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <dt style={{ fontFamily: 'var(--display)', fontSize: 'var(--step-1)' }}>
                Applying to be referred
              </dt>
              <dd style={{ margin: '.35rem 0 0', color: 'var(--ink-2)' }}>
                Your name, telephone number and email address; which kind of provider
                you are; your licence number, which is required for a registered nurse
                or a licensed vocational nurse and optional otherwise; the areas you
                work in, the languages you speak and what you specialise in; and what
                you write about your experience.
              </dd>
            </div>
            <div>
              <dt style={{ fontFamily: 'var(--display)', fontSize: 'var(--step-1)' }}>
                Referring a patient
              </dt>
              <dd style={{ margin: '.35rem 0 0', color: 'var(--ink-2)' }}>
                Your name, where you work, your role, your telephone number and your
                email address — and then the patient, which is the section below.
              </dd>
            </div>
          </dl>
        </Prose>
      </Section>

      <Section title="The referral form is about somebody else" as="h2">
        <Prose>
          <p>
            It is filled in by a discharge planner, a care manager or a practice, about
            a patient who is not in the room and has never been to this site. That is
            the one place where this site collects a person&rsquo;s information from
            somebody other than them, so it collects as little as it can.
          </p>
          <ul>
            <li>
              <strong>The patient is initials.</strong> The form has a field for
              initials and no field for a name. There is no field for a diagnosis, a
              medication or anything else clinical, and nowhere in our records to put
              one at this stage.
            </li>
            <li>
              <strong>What is kept about them</strong> is those initials, the kind of
              care, the area and how urgent it is.
            </li>
            <li>
              <strong>The family member we will call</strong> is named, with a telephone
              number, because telephoning them is the whole point of the form. We call
              the family, not the person who sent it.
            </li>
            <li>
              <strong>Consent is confirmed before it will send.</strong> The form cannot
              be submitted until the person filling it confirms the family have agreed
              their details can be passed on, and that confirmation is stored with the
              referral and with the time it was given.
            </li>
            <li>
              <strong>The free-text note is stored as written.</strong> It is the one
              field where more can be put in than we asked for, and we would rather it
              were not.
            </li>
          </ul>
          <p>
            If you are the family member whose name and number were given to us: what we
            hold about the patient is initials, and what we hold about you is your name,
            your telephone number and what the referral said. We telephone you, and from
            that point what we keep is what you tell us yourself.
          </p>
        </Prose>
      </Section>

      <Section title="Where it goes" as="h2">
        <Prose>
          <p>
            Into one database, and nowhere else. An enquiry and a referral are written
            to the same record set; an application is written to its own. No form on
            this site creates anything further — the operator does that by hand,
            afterwards, from what you say on the telephone.
          </p>
          <p>
            Nothing you write is emailed. When something arrives, a notification is
            recorded and, if an address is configured for it, an email goes to the
            operator saying that something arrived and when it is urgent. It carries no
            name, no telephone number, no email address and nothing about the care. The
            detail stays in the record, and the operator reads it in a signed-in
            console. Email is not a confidential channel and this is not a business that
            should be treating it as one.
          </p>
          <p>
            There is no analytics service on this site, no advertising script, and
            nothing embedded from anywhere else. No part of a form is sent to a third
            party.
          </p>
          <p>
            The companies that hold or carry this on our behalf — the hosting, the
            database and the mail provider that sends the operator&rsquo;s notification
            — are: <Commitment id="processors" />
          </p>
        </Prose>
      </Section>

      <Section title="What the site records by itself" as="h2">
        <Prose>
          <ul>
            <li>
              <strong>No cookie on these pages.</strong> Reading this site sets nothing.
              One cookie is set after you sign in to a portal with an invite link we
              sent you; the browser will not let a script read it, and it lasts fourteen
              days. Signing out deletes the session it refers to.
            </li>
            <li>
              <strong>A hashed record that somebody submitted.</strong> So a form cannot
              be hammered, we record that a submission came from a given caller. The
              address it came from is hashed before it is written, with a different salt
              for each form, and the address itself is never stored. Those rows are
              cleared out once they are more than a day old — the clearing is
              opportunistic rather than scheduled, so one can sit a little longer than
              that.
            </li>
            <li>
              <strong>A hidden field you will never see.</strong> If it comes back
              filled in, the submission is discarded and nothing is recorded from it.
              There is no puzzle to solve and nothing is asked of you: somebody
              arranging care during a discharge should not have to prove they are a
              person.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Who can see it" as="h2">
        <Prose>
          <p>
            The operator, in a signed-in console. Everyone else sees only what is their
            own, and it is the database that decides that rather than the page: every
            signed-in screen runs its queries as a restricted role carrying that
            person&rsquo;s own identity, and a query run without one sees nothing.
          </p>
          <p>
            A partner who is signed in sees the referrals they sent us, and of each one:
            the initials, the kind of care, the area, the urgency, the name of the
            person we were asked to call, and when we picked it up. Whether the family
            went on to engage anybody is shown only where that household has said it may
            be. A referral sent without signing in is not attached to anybody by
            matching the email address typed into the form — a person attaches it, or it
            stays unattributed.
          </p>
        </Prose>
      </Section>

      <Section title="How long it is kept" as="h2">
        <Prose>
          <p>
            The hashed submission records: a day, as above. A portal session: fourteen
            days, or until you sign out.
          </p>
          <p>
            Everything else — an enquiry, a referral, an application:{' '}
            <Commitment id="retention" />
          </p>
          <p>
            What is true in the meantime, and we would rather say it than print a figure
            nobody has chosen: there is no routine in this software that deletes an
            enquiry, a referral or an application. Those records stay until somebody
            removes one by hand.
          </p>
        </Prose>
      </Section>

      <Section title="What you can ask us for" as="h2">
        <Prose>
          {/*
            * California's consumer privacy law — Civ. Code § 1798.100 and following —
            * gives these rights whether or not a notice lists them, so saying they
            * exist promises nothing the law has not. What it would be wrong to imply is
            * a mechanism: nothing on this site performs any of them, and a request is
            * worked by a person against the console. Said plainly, because a right
            * exercised into silence is worse than one described honestly.
            */}
          <p>
            Under California law you can ask what personal information is held about
            you, ask for a copy of it, ask for it to be corrected, and ask for it to be
            deleted. The same applies if what is held about you arrived from somebody
            else, which on this site means a referral.
          </p>
          <p>
            None of that is self-service. No screen on this site deletes a record, and
            nothing about a request is automatic: a person reads it and works it against
            the console. Send one to: <Commitment id="requests" />
          </p>
          <p>
            On selling or sharing personal information: <Commitment id="sale" />
          </p>
          <p>
            A question about this notice goes to: <Commitment id="contact" />
          </p>
        </Prose>
      </Section>

      <Section title="When this changes" as="h2">
        <Prose>
          <p>
            This notice is part of the site and changes with it. Last gone through
            on <span className="nums">{PRIVACY_LAST_REVIEWED}</span>.
          </p>
        </Prose>
      </Section>
    </Stack>
  );
}
