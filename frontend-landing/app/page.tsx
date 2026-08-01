import LandingPage from '@/components/LandingPage';
import { getTeachers, getBatches } from '@/lib/data';

export default async function Home() {
    const [teachers, batches] = await Promise.all([getTeachers(), getBatches()]);

    return <LandingPage teachers={teachers} batches={batches} />;
}
