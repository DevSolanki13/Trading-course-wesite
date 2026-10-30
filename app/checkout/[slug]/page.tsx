import { notFound } from "next/navigation";
import { getCourse } from "@/frontend/content/courses";
import { CheckoutForm } from "@/frontend/components/checkout-form";
import { pageMetadata } from "@/frontend/lib/metadata";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const course = getCourse(slug); return course ? pageMetadata(`Checkout · ${course.title}`, "Secure course checkout", `/checkout/${slug}`) : {}; }
export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const course = getCourse(slug); if (!course) notFound(); return <main className="checkout-page container"><CheckoutForm course={course} /></main>; }
