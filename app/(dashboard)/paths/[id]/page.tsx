import { QuizEditorPage } from "@/components/quiz/editor";
export default async function PathPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <QuizEditorPage id={id} />; }
