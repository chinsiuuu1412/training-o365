package config

import (
	"bufio"
	"os"
	"strings"
	"testing"
)

func TestEnvExampleParsesWithLiteralComments(t *testing.T) {
	f, err := os.Open("../../.env.example")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, _, ok := strings.Cut(line, "=")
		if !ok || strings.ContainsAny(key, " \t") {
			t.Fatal("uncommented template prose")
		}
		t.Setenv(key, "")
		if err = os.Unsetenv(key); err != nil {
			t.Fatal(err)
		}
	}
	if err = scanner.Err(); err != nil {
		t.Fatal(err)
	}
	if err = LoadDotEnv("../../.env.example"); err != nil {
		t.Fatal(err)
	}
	if os.Getenv("DB_PATH") != "data/lms.db" || os.Getenv("SESSION_TTL_SECONDS") != "28800" {
		t.Fatal("template defaults missing")
	}
}
