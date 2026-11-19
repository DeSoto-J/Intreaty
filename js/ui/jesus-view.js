// jesus-view.js — the "Know Jesus" tab: a short guide, with King James
// verses, to knowing you're saved and that heaven is your home.

import { Kind, todayLocal, parseLocalDate } from '../data/models.js';
import { $, esc, toast } from './dom.js';

const longDate = (s) => parseLocalDate(s).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
import { icon } from './icons.js';

// The Thanksgiving saved by "I prayed this prayer today".
const SAVED_TITLE = 'I trusted Jesus as my Savior';
const SAVED_DETAILS = 'I prayed and received the free gift of salvation that Jesus paid for on the cross. Heaven is my home.';

const STEPS = [
  {
    title: 'God loves you and has a home for you',
    verses: [
      ['John 3:16', 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.'],
      ['John 14:2', 'In my Father’s house are many mansions: if it were not so, I would have told you. I go to prepare a place for you.'],
    ],
  },
  {
    title: 'Our sin separates us from God',
    verses: [
      ['Romans 3:23', 'For all have sinned, and come short of the glory of God;'],
      ['Romans 6:23', 'For the wages of sin is death; but the gift of God is eternal life through Jesus Christ our Lord.'],
    ],
  },
  {
    title: 'Jesus paid for your sin',
    verses: [
      ['Romans 5:8', 'But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us.'],
      ['1 Corinthians 15:3–4', 'For I delivered unto you first of all that which I also received, how that Christ died for our sins according to the scriptures; And that he was buried, and that he rose again the third day according to the scriptures:'],
    ],
  },
  {
    title: 'Salvation is a free gift, not something we earn',
    verses: [
      ['Ephesians 2:8–9', 'For by grace are ye saved through faith; and that not of yourselves: it is the gift of God: Not of works, lest any man should boast.'],
      ['John 14:6', 'Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me.'],
    ],
  },
  {
    title: 'Receive the gift by faith',
    verses: [
      ['Romans 10:9–10', 'That if thou shalt confess with thy mouth the Lord Jesus, and shalt believe in thine heart that God hath raised him from the dead, thou shalt be saved. For with the heart man believeth unto righteousness; and with the mouth confession is made unto salvation.'],
      ['Romans 10:13', 'For whosoever shall call upon the name of the Lord shall be saved.'],
      ['John 1:12', 'But as many as received him, to them gave he power to become the sons of God, even to them that believe on his name:'],
    ],
  },
];

const PRAYER = 'Dear God, I know that I am a sinner and that I cannot save myself. I believe that Jesus Christ is Your Son, that He died on the cross to pay for my sins, and that He rose again from the dead. Right now I turn from my sin and put my trust in Jesus alone to save me. Please forgive me and come into my life. Thank You for the free gift of eternal life and for making heaven my home. In Jesus’ name, Amen.';

const ASSURANCE = [
  ['1 John 5:13', 'These things have I written unto you that believe on the name of the Son of God; that ye may know that ye have eternal life, and that ye may believe on the name of the Son of God.'],
  ['John 10:28', 'And I give unto them eternal life; and they shall never perish, neither shall any man pluck them out of my hand.'],
];

const NEXT = [
  ['Tell someone', 'Share the news with a Christian friend or family member.'],
  ['Find a church', 'Look for a Bible-believing church, and ask about baptism.'],
  ['Read the Bible each day', 'The Gospel of John is a good place to start.'],
  ['Talk to God each day', 'Your prayer list in Intreaty is a great place to begin.'],
];

const verseHTML = ([ref, text]) => `
  <blockquote class="kj-verse">
    <p>${esc(text)}</p>
    <cite>${esc(ref)}</cite>
  </blockquote>`;

const stepHTML = (n, title, body) => `
  <section class="kj-step">
    <div class="kj-num" aria-hidden="true">${n}</div>
    <div class="kj-body">
      <h2 class="kj-title"><span class="sr-only">Step ${n}: </span>${esc(title)}</h2>
      ${body}
    </div>
  </section>`;

function savedEntry(repo) {
  return repo.listEntries({ kind: Kind.THANKSGIVING }).find((e) => e.title === SAVED_TITLE) || null;
}

export function renderJesus({ repo }) {
  const saved = savedEntry(repo);
  let n = 0;
  $('#view-jesus').innerHTML = `
    <div class="view-head">
      <p class="eyebrow">Know Jesus</p>
      <h1 class="view-title" id="jesus-title">How to know you’re going to heaven</h1>
    </div>

    <div class="kj-intro">
      <p><strong>God wants to have a personal relationship with you.</strong> He made you, He loves you, and He wants you to spend forever with Him in heaven.</p>
      <p>The Bible shows how you can know Him. Please take a few moments to read, straight from His Word, how you can know <em>for sure</em> that you’re on your way to heaven.</p>
    </div>

    ${STEPS.map((s) => stepHTML(++n, s.title, s.verses.map(verseHTML).join(''))).join('')}

    ${stepHTML(++n, 'A prayer you can pray', `
      <p class="kj-note">The words don’t save you. Trusting Jesus does. This prayer is a way to tell God you are trusting Him.</p>
      <div class="kj-prayer"><p>${esc(PRAYER)}</p></div>
      ${saved ? `
        <div class="kj-saved">
          ${icon('heart')}
          <p>You trusted Jesus on <strong>${esc(longDate(saved.date))}</strong>. Welcome to God’s family!</p>
          <button type="button" class="link-btn" data-kj="view">View in Thanksgivings${icon('arrow')}</button>
        </div>` : `
        <button type="button" class="btn btn-primary kj-prayed" data-kj="prayed">${icon('heart')}I prayed this prayer today</button>
        <p class="kj-small">This saves a private note in your Thanksgivings so you can remember the day.</p>`}
    `)}

    ${stepHTML(++n, 'You can know for sure', ASSURANCE.map(verseHTML).join(''))}

    ${stepHTML(++n, 'What’s next', `
      <ul class="kj-next">
        ${NEXT.map(([h, t]) => `<li>${icon('check')}<span><strong>${esc(h)}</strong>${esc(t)}</span></li>`).join('')}
      </ul>`)}

    <div class="kj-share panel panel-pad">
      <p class="note">Know someone who needs this? Send them a link to this page.</p>
      <button type="button" class="btn btn-secondary" data-kj="share" style="width:100%">${icon('share')}Share this with someone</button>
    </div>`;
}

export function bindJesus(ctx) {
  const { repo } = ctx;
  $('#view-jesus').addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-kj]');
    if (!b) return;
    const act = b.dataset.kj;
    try {
      if (act === 'prayed') {
        if (savedEntry(repo)) return;
        await repo.addEntry({
          kind: Kind.THANKSGIVING,
          title: SAVED_TITLE,
          details: SAVED_DETAILS,
          date: todayLocal(),
          categoryId: 'other',
        });
        toast('Saved. Welcome to God’s family!', {
          actionLabel: 'View',
          onAction: () => { location.hash = '#/thanks'; },
          duration: 8000,
        });
      } else if (act === 'view') {
        location.hash = '#/thanks';
      } else if (act === 'share') {
        const url = new URL('#/jesus', location.href).href;
        const text = 'How to know you’re going to heaven';
        if (navigator.share) {
          try { await navigator.share({ title: text, text, url }); } catch (err) { if (err.name !== 'AbortError') throw err; }
        } else {
          await navigator.clipboard.writeText(`${text}: ${url}`);
          toast('Link copied');
        }
      }
    } catch {
      toast('Something went wrong. Please try again.');
    }
  });
}
