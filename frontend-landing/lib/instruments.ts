export interface Instrument {
  id: string;
  slug: string;
  name: string;
  icon: string;
  desc: string;
  longDesc: string;
  /** instrument_name values as they appear in the batches API — used to match live schedule/teacher data. */
  dbNames: string[];
}

export const INSTRUMENTS: Instrument[] = [
  {
    id: 'guitar',
    slug: 'guitar-classes-hyderabad',
    name: 'Guitar',
    icon: '🎸',
    desc: 'Most popular worldwide — acoustic to electric',
    longDesc: 'From first chords to lead lines, guitar students at HSM learn acoustic and electric technique together with ensemble play — so practice turns into performance, not just scales.',
    dbNames: ['Guitar'],
  },
  {
    id: 'bass_guitar',
    slug: 'bass-guitar-classes-hyderabad',
    name: 'Bass Guitar',
    icon: '🎸',
    desc: 'The rhythmic backbone — groove, funk, and feel',
    longDesc: 'Bass is the link between rhythm and harmony. HSM bass students learn groove, walking lines, and how to lock in with a drummer — skills that only really develop playing with a real band.',
    dbNames: [],
  },
  {
    id: 'keyboard',
    slug: 'keyboard-classes-hyderabad',
    name: 'Keyboard',
    icon: '🎹',
    desc: 'Build musical foundations fast — ideal first instrument',
    longDesc: 'Keyboard is often the fastest way to build real musical foundations — reading notation, understanding harmony, and building finger independence — before branching into any other instrument.',
    dbNames: ['Keyboard', 'Keyboard/Piano'],
  },
  {
    id: 'piano',
    slug: 'piano-classes-hyderabad',
    name: 'Piano',
    icon: '🎹',
    desc: 'Classical elegance; read music, compose, perform',
    longDesc: 'Piano at HSM follows the Trinity College London graded syllabus, building sight-reading, technique, and performance confidence one grade at a time — with a monthly assessment, not just an annual exam.',
    dbNames: ['Piano', 'Keyboard/Piano'],
  },
  {
    id: 'tabla',
    slug: 'tabla-classes-hyderabad',
    name: 'Tabla',
    icon: '🪘',
    desc: "India's heartbeat — rhythm, tradition, discipline",
    longDesc: "Tabla training at HSM builds on traditional taal and rhythm discipline, with students performing alongside vocalists and other instrumentalists rather than practicing in isolation.",
    dbNames: ['Tabla'],
  },
  {
    id: 'drums',
    slug: 'drums-classes-hyderabad',
    name: 'Drums',
    icon: '🥁',
    desc: 'Rhythm, coordination, and confidence on stage',
    longDesc: 'Drum students build coordination and timing from day one, and get on stage early — HSM\'s ensemble-first approach means drummers play with other musicians well before they\'d get that chance elsewhere.',
    dbNames: ['Drums'],
  },
  {
    id: 'octopad',
    slug: 'octopad-classes-hyderabad',
    name: 'Octopad',
    icon: '🎛️',
    desc: 'Electronic percussion — versatile, modern, exciting',
    longDesc: 'Octopad blends acoustic drumming technique with electronic sounds and sampling — a modern percussion path for students who want to play live and produce.',
    dbNames: [],
  },
  {
    id: 'violin',
    slug: 'violin-classes-hyderabad',
    name: 'Violin',
    icon: '🎻',
    desc: 'Versatile across classical, folk, and film music',
    longDesc: 'Violin students train across Western classical technique and Indian film/folk styles, with regular ensemble sessions so bowing and intonation get tested in a real group, not just alone.',
    dbNames: ['Violin'],
  },
  {
    id: 'hindustani',
    slug: 'hindustani-classical-classes-hyderabad',
    name: 'Hindustani Classical',
    icon: '🎤',
    desc: 'North Indian classical — raga, taal, expression',
    longDesc: 'Hindustani vocal training at HSM builds raga and taal fundamentals with a working musician as teacher, moving students from riyaz basics toward real performance.',
    dbNames: ['Hindustani Vocals'],
  },
  {
    id: 'carnatic',
    slug: 'carnatic-classical-classes-hyderabad',
    name: 'Carnatic Classical',
    icon: '🎤',
    desc: 'South Indian classical — precise, devotional, powerful',
    longDesc: 'Carnatic vocal students train in kriti, varnam, and swara fundamentals, with the same daily practice-tracking and teacher review used across every HSM instrument.',
    dbNames: ['Carnatic Vocals'],
  },
];

export function getInstrumentBySlug(slug: string): Instrument | undefined {
  return INSTRUMENTS.find(i => i.slug === slug);
}
