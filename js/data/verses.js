// verses.js — the King James verses for "Verse of the day", and how each
// day's verse is chosen.
//
// To add a verse: add a line to VERSES with a new, unique id. Ids are saved
// in people's favorites and backups, so never change or reuse an existing id.
// New verses can go anywhere in the list.

import { parseLocalDate } from './models.js';

export const VERSES = [
  // Psalm 119:58 is Intreaty's own verse ("I intreated thy favour…"), so it comes first.
  { id: 'psa-119-58', ref: 'Psalm 119:58', text: 'I intreated thy favour with my whole heart: be merciful unto me according to thy word.' },

  // Asking in prayer
  { id: 'mat-7-7', ref: 'Matthew 7:7', text: 'Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you:' },
  { id: 'mat-21-22', ref: 'Matthew 21:22', text: 'And all things, whatsoever ye shall ask in prayer, believing, ye shall receive.' },
  { id: 'mrk-11-24', ref: 'Mark 11:24', text: 'Therefore I say unto you, What things soever ye desire, when ye pray, believe that ye receive them, and ye shall have them.' },
  { id: 'jhn-14-13', ref: 'John 14:13–14', text: 'And whatsoever ye shall ask in my name, that will I do, that the Father may be glorified in the Son. If ye shall ask any thing in my name, I will do it.' },
  { id: 'jhn-15-7', ref: 'John 15:7', text: 'If ye abide in me, and my words abide in you, ye shall ask what ye will, and it shall be done unto you.' },
  { id: '1jn-5-14', ref: '1 John 5:14', text: 'And this is the confidence that we have in him, that, if we ask any thing according to his will, he heareth us:' },
  { id: 'jas-1-5', ref: 'James 1:5', text: 'If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.' },
  { id: 'heb-4-16', ref: 'Hebrews 4:16', text: 'Let us therefore come boldly unto the throne of grace, that we may obtain mercy, and find grace to help in time of need.' },
  { id: 'mat-6-6', ref: 'Matthew 6:6', text: 'But thou, when thou prayest, enter into thy closet, and when thou hast shut thy door, pray to thy Father which is in secret; and thy Father which seeth in secret shall reward thee openly.' },
  { id: 'mat-18-20', ref: 'Matthew 18:20', text: 'For where two or three are gathered together in my name, there am I in the midst of them.' },

  // God hears and answers
  { id: 'jer-33-3', ref: 'Jeremiah 33:3', text: 'Call unto me, and I will answer thee, and shew thee great and mighty things, which thou knowest not.' },
  { id: 'jer-29-12', ref: 'Jeremiah 29:12', text: 'Then shall ye call upon me, and ye shall go and pray unto me, and I will hearken unto you.' },
  { id: 'isa-65-24', ref: 'Isaiah 65:24', text: 'And it shall come to pass, that before they call, I will answer; and while they are yet speaking, I will hear.' },
  { id: 'psa-145-18', ref: 'Psalm 145:18', text: 'The LORD is nigh unto all them that call upon him, to all that call upon him in truth.' },
  { id: 'psa-34-17', ref: 'Psalm 34:17', text: 'The righteous cry, and the LORD heareth, and delivereth them out of all their troubles.' },
  { id: 'psa-6-9', ref: 'Psalm 6:9', text: 'The LORD hath heard my supplication; the LORD will receive my prayer.' },
  { id: 'psa-17-6', ref: 'Psalm 17:6', text: 'I have called upon thee, for thou wilt hear me, O God: incline thine ear unto me, and hear my speech.' },
  { id: 'psa-66-19', ref: 'Psalm 66:19–20', text: 'But verily God hath heard me; he hath attended to the voice of my prayer. Blessed be God, which hath not turned away my prayer, nor his mercy from me.' },
  { id: 'psa-116-1', ref: 'Psalm 116:1–2', text: 'I love the LORD, because he hath heard my voice and my supplications. Because he hath inclined his ear unto me, therefore will I call upon him as long as I live.' },
  { id: 'pro-15-29', ref: 'Proverbs 15:29', text: 'The LORD is far from the wicked: but he heareth the prayer of the righteous.' },
  { id: '2ch-7-14', ref: '2 Chronicles 7:14', text: 'If my people, which are called by my name, shall humble themselves, and pray, and seek my face, and turn from their wicked ways; then will I hear from heaven, and will forgive their sin, and will heal their land.' },
  { id: 'rom-8-26', ref: 'Romans 8:26', text: 'Likewise the Spirit also helpeth our infirmities: for we know not what we should pray for as we ought: but the Spirit itself maketh intercession for us with groanings which cannot be uttered.' },

  // Bringing your burdens
  { id: 'php-4-6', ref: 'Philippians 4:6', text: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.' },
  { id: 'php-4-7', ref: 'Philippians 4:7', text: 'And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.' },
  { id: '1pe-5-7', ref: '1 Peter 5:7', text: 'Casting all your care upon him; for he careth for you.' },
  { id: 'psa-55-22', ref: 'Psalm 55:22', text: 'Cast thy burden upon the LORD, and he shall sustain thee: he shall never suffer the righteous to be moved.' },
  { id: 'psa-62-8', ref: 'Psalm 62:8', text: 'Trust in him at all times; ye people, pour out your heart before him: God is a refuge for us. Selah.' },
  { id: 'psa-50-15', ref: 'Psalm 50:15', text: 'And call upon me in the day of trouble: I will deliver thee, and thou shalt glorify me.' },
  { id: 'psa-86-7', ref: 'Psalm 86:7', text: 'In the day of my trouble I will call upon thee: for thou wilt answer me.' },
  { id: 'psa-46-1', ref: 'Psalm 46:1', text: 'God is our refuge and strength, a very present help in trouble.' },
  { id: 'psa-121-1', ref: 'Psalm 121:1–2', text: 'I will lift up mine eyes unto the hills, from whence cometh my help. My help cometh from the LORD, which made heaven and earth.' },
  { id: 'mat-11-28', ref: 'Matthew 11:28', text: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.' },

  // Faith and keeping on
  { id: 'luk-18-1', ref: 'Luke 18:1', text: 'And he spake a parable unto them to this end, that men ought always to pray, and not to faint;' },
  { id: '1th-5-16', ref: '1 Thessalonians 5:16–18', text: 'Rejoice evermore. Pray without ceasing. In every thing give thanks: for this is the will of God in Christ Jesus concerning you.' },
  { id: 'rom-12-12', ref: 'Romans 12:12', text: 'Rejoicing in hope; patient in tribulation; continuing instant in prayer;' },
  { id: 'col-4-2', ref: 'Colossians 4:2', text: 'Continue in prayer, and watch in the same with thanksgiving;' },
  { id: 'eph-6-18', ref: 'Ephesians 6:18', text: 'Praying always with all prayer and supplication in the Spirit, and watching thereunto with all perseverance and supplication for all saints;' },
  { id: 'jas-5-16', ref: 'James 5:16', text: 'Confess your faults one to another, and pray one for another, that ye may be healed. The effectual fervent prayer of a righteous man availeth much.' },
  { id: '1ti-2-1', ref: '1 Timothy 2:1', text: 'I exhort therefore, that, first of all, supplications, prayers, intercessions, and giving of thanks, be made for all men;' },
  { id: 'heb-11-6', ref: 'Hebrews 11:6', text: 'But without faith it is impossible to please him: for he that cometh to God must believe that he is, and that he is a rewarder of them that diligently seek him.' },
  { id: 'psa-5-3', ref: 'Psalm 5:3', text: 'My voice shalt thou hear in the morning, O LORD; in the morning will I direct my prayer unto thee, and will look up.' },
  { id: 'psa-141-2', ref: 'Psalm 141:2', text: 'Let my prayer be set forth before thee as incense; and the lifting up of my hands as the evening sacrifice.' },

  // Trust and God's faithfulness
  { id: 'pro-3-5', ref: 'Proverbs 3:5–6', text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.' },
  { id: 'isa-40-31', ref: 'Isaiah 40:31', text: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.' },
  { id: 'isa-41-10', ref: 'Isaiah 41:10', text: 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.' },
  { id: 'lam-3-22', ref: 'Lamentations 3:22–23', text: 'It is of the LORD’s mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness.' },
  { id: 'rom-8-28', ref: 'Romans 8:28', text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.' },
  { id: 'php-4-19', ref: 'Philippians 4:19', text: 'But my God shall supply all your need according to his riches in glory by Christ Jesus.' },
  { id: 'eph-3-20', ref: 'Ephesians 3:20', text: 'Now unto him that is able to do exceeding abundantly above all that we ask or think, according to the power that worketh in us,' },

  // Thanksgiving and blessing
  { id: 'psa-100-4', ref: 'Psalm 100:4', text: 'Enter into his gates with thanksgiving, and into his courts with praise: be thankful unto him, and bless his name.' },
  { id: 'psa-107-1', ref: 'Psalm 107:1', text: 'O give thanks unto the LORD, for he is good: for his mercy endureth for ever.' },
  { id: 'num-6-24', ref: 'Numbers 6:24–26', text: 'The LORD bless thee, and keep thee: The LORD make his face shine upon thee, and be gracious unto thee: The LORD lift up his countenance upon thee, and give thee peace.' },
];

export const APP_VERSE_ID = 'psa-119-58';

const byId = new Map(VERSES.map((v) => [v.id, v]));
export const getVerse = (id) => byId.get(id) || null;

// Day 0 is the day this feature arrived (18 November 2026), so Psalm 119:58 is
// the very first verse of the day. Every day after moves one step down the list.
const START = parseLocalDate('2026-11-18');
const MS_PER_DAY = 86400000;

export function dayNumber(dateStr) {
  const d = parseLocalDate(dateStr);
  // Math.round smooths over daylight-saving days that are 23 or 25 hours long.
  return Math.round((d - START) / MS_PER_DAY);
}

const mod = (n, m) => ((n % m) + m) % m;

// Picks the verse for a date. Most days step through the whole list in order;
// one day in four (when there are favorites) brings back a favorite instead.
export function verseForDay(dateStr, favoriteIds = []) {
  const n = dayNumber(dateStr);
  const favs = VERSES.filter((v) => favoriteIds.includes(v.id));
  if (favs.length && mod(n, 4) === 3) {
    return favs[mod(Math.floor(n / 4), favs.length)];
  }
  return VERSES[mod(n, VERSES.length)];
}

// The text people copy or share.
export const verseAsText = (v) => `“${v.text}”\n— ${v.ref} (KJV)`;
