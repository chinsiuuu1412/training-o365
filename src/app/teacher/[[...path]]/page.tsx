import NotFound from '@/app/not-found';
export const dynamicParams=false;
export function generateStaticParams(){return [{path:[]},...['classes','library','notifications','profile','settings'].map(section=>({path:[section]}))];}
export default function LegacyTeacher(){return <NotFound/>;}
