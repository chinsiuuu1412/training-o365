import { notFound } from "next/navigation";
import { QuizPlayer } from "@/features/quizzes/quiz-player";

export default async function QuizPlayerPage({
  params,
}: {
  params: Promise<{ role: string; classId: string; quizId: string }>;
}) {
  const { role, classId, quizId } = await params;
  if (role !== "student") notFound();
  return <QuizPlayer key={`${classId}-${quizId}`} classId={classId} quizId={quizId} />;
}
