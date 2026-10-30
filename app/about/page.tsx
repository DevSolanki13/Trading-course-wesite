import { pageMetadata } from "@/frontend/lib/metadata";
export const metadata = pageMetadata(
  "Our approach",
  "A considered approach to trading education: context over calls, process over promises and clarity over noise.",
  "/about",
);
import AboutPage from "@/frontend/pages/about-page";
import{publicCatalog}from"@/backend/public/catalogue";
export const dynamic="force-dynamic";
export default async function About(){const data=await publicCatalog();return <AboutPage content={data.content}/>;}
