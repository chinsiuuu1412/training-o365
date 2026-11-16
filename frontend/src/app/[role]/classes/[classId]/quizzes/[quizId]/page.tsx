import { notFound } from "next/navigation";
import { QuizPlayer } from "@/features/quizzes/quiz-player";

export default async function QuizPlayerPage({
  params,
}: {
  params: Promise<{ role: string; classId: string; quizId: string }>;
}) {
  const { role, classId, quizId } = await params;
  if (role !== "student") notFound();
  const parsedClassId = Number(classId);
  const parsedQuizId = Number(quizId);
  if (
    !Number.isInteger(parsedClassId) ||
    parsedClassId <= 0 ||
    !Number.isInteger(parsedQuizId) ||
    parsedQuizId <= 0
  ) {
    notFound();
  }
  return <QuizPlayer key={`${parsedClassId}-${parsedQuizId}`} classId={parsedClassId} quizId={parsedQuizId} />;
}
