export interface TeacherProfile {
  displayName?: string;
  specialty: string;
  icon: string;
  quote: string;
}

/**
 * Keyed by the first name as it appears in the teachers DB record (lowercased).
 * displayName corrects DB spelling variants to the name HSM actually uses publicly —
 * keeps the homepage Faculty section and per-instrument pages from showing two
 * different names for the same person.
 */
export const TEACHER_PROFILES: Record<string, TeacherProfile> = {
  josva: {
    specialty: 'Keyboard · Guitar',
    icon: '🎸🎹',
    quote: '"The guitar and keyboard are two sides of the same musical coin — master one and the other opens up."',
  },
  david: {
    specialty: 'Piano',
    icon: '🎹',
    quote: '"Piano teaches you to listen to every voice simultaneously — it builds your musical mind from the ground up."',
  },
  shiva: {
    displayName: 'Mriganko',
    specialty: 'Piano',
    icon: '🎹',
    quote: '"Piano teaches you to listen to every voice simultaneously — it builds your musical mind from the ground up."',
  },
  subroto: {
    displayName: 'Subroto Bhaduri',
    specialty: 'Drums · Tabla · Octopad',
    icon: '🥁',
    quote: '"Rhythm is the heartbeat of all music. Before you play a note, you must first feel the pulse."',
  },
  subrata: {
    displayName: 'Subroto Bhaduri',
    specialty: 'Drums · Tabla · Octopad',
    icon: '🥁',
    quote: '"Rhythm is the heartbeat of all music. Before you play a note, you must first feel the pulse."',
  },
  issac: {
    displayName: 'Issac Lawrence',
    specialty: 'Violin',
    icon: '🎻',
    quote: '"Every string speaks. The violin gives voice to the emotions that words can never quite reach."',
  },
  lawrence: {
    displayName: 'Issac Lawrence',
    specialty: 'Violin',
    icon: '🎻',
    quote: '"Every string speaks. The violin gives voice to the emotions that words can never quite reach."',
  },
  sangeeta: {
    specialty: 'Hindustani Classical · Carnatic Classical',
    icon: '🎤',
    quote: '"Your voice is the most personal instrument you will ever own — train it and it stays with you forever."',
  },
};

export function getTeacherDisplayName(dbName: string): string {
  const key = dbName.split(' ')[0].toLowerCase();
  return TEACHER_PROFILES[key]?.displayName || dbName;
}
