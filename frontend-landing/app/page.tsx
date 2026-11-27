import LandingPage from '@/components/LandingPage';
import { getTeachers } from '@/lib/data';

export default async function Home() {
    const teachers = await getTeachers();

    return <LandingPage teachers={teachers} />;
}
