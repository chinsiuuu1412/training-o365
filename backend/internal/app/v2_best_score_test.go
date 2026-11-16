package app

import (
	"fmt"
	"testing"
)

func TestV2LowerAttemptKeepsBestScoreAndSingleProgressCredit(t *testing.T) {
	a, _, mgr, stu, c := fixture(t)
	q, answers := newQuiz(t, mgr, c, "assignment", 60)
	for i := 0; i < 2; i++ {
		replenish(a)
		at := start(t, stu, c, q, 10+i)
		revision := 0
		if i == 0 {
			save(t, stu, c, at, 0, answers)
			revision = 1
		}
		s, m := stu.callHeaders("POST", attemptPath(c, at)+"/submit", M{"enrollment_id": at["enrollment_id"], "expected_revision": revision}, key(20+i))
		requireStatus(t, 200, s, m)
	}
	s, m := stu.call("GET", classPath("student", c)+"/quizzes", nil)
	requireStatus(t, 200, s, m)
	quiz := result(m)["items"].([]any)[0].(map[string]any)
	if num(quiz, "best_score_percent") != 100 || !bval(quiz, "is_passed") {
		t.Fatal("lower later score overwrote best result")
	}
	s, m = stu.call("GET", classPath("student", c)+"/progress", nil)
	requireStatus(t, 200, s, m)
	p := result(m)["progress"].(map[string]any)
	if num(p, "passed_quiz_count") != 1 || num(p, "quiz_percent") != 100 {
		t.Fatal("multiple attempts contributed duplicate quiz credit")
	}
	s, m = stu.call("GET", fmt.Sprintf("%s/quizzes/%.0f/attempts", classPath("student", c), num(q, "id")), nil)
	requireStatus(t, 200, s, m)
	if num(result(m), "total") != 2 {
		t.Fatal("individual attempt history lost")
	}
}
