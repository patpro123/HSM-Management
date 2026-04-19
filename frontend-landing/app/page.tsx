import LandingPage from '@/components/LandingPage';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://hsm-management.onrender.com';

const FALLBACK_TEACHERS = [
    { id: 1, name: 'Josva', specialty: 'Keyboard · Guitar' },
    { id: 2, name: 'David', specialty: 'Piano' },
    { id: 3, name: 'Subroto Bhaduri', specialty: 'Drums · Tabla · Octopad' },
    { id: 4, name: 'Issac Lawrence', specialty: 'Violin' },
    { id: 5, name: 'Sangeeta', specialty: 'Hindustani Classical · Carnatic Classical' },
];

const FALLBACK_BATCHES = [
    { instrument_name: 'Guitar', days: 'Tue, Thu', timings: '5PM–8PM', age_group: 'All ages' },
    { instrument_name: 'Tabla', days: 'Sat, Sun', timings: '10AM–1PM', age_group: '6+' },
    { instrument_name: 'Hindustani Vocals', days: 'Tue, Thu, Sat', timings: '5PM–9PM', age_group: 'All ages' },
    { instrument_name: 'Piano', days: 'Mon, Wed', timings: '4PM–7PM', age_group: 'All ages' },
];

async function getTeachers() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/teachers`, {
            next: { revalidate: 3600 }, // revalidate every hour
        });
        if (!res.ok) return FALLBACK_TEACHERS;
        const data = await res.json();
        return data.teachers ?? FALLBACK_TEACHERS;
    } catch {
        return FALLBACK_TEACHERS;
    }
}

async function getBatches() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/batches`, {
            next: { revalidate: 3600 },
        });
        if (!res.ok) return FALLBACK_BATCHES;
        const data = await res.json();
        return data.batches ?? FALLBACK_BATCHES;
    } catch {
        return FALLBACK_BATCHES;
    }
}

export default async function Home() {
    const [teachers, batches] = await Promise.all([getTeachers(), getBatches()]);

    return <LandingPage teachers={teachers} batches={batches} />;
}
