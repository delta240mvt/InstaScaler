import { QuizContactDetail } from "@/components/quiz/contact-detail";
export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <QuizContactDetail id={id} />; }
