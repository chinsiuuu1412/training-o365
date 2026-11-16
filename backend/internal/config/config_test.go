package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func clean(t *testing.T) {
	t.Helper()
	for _, k := range []string{"YOUTUBE_API_KEY", "STORAGE_CLEANUP_ENABLED", "TRUSTED_PROXY_CIDRS", "HTTP_ADDR", "DB_PATH", "SITE_ORIGIN", "JWT_SECRET", "SESSION_TTL_SECONDS", "ADMIN_INITIAL_EMAIL", "ADMIN_INITIAL_PASSWORD", "SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM", "SMTP_PORT", "R2_ENDPOINT", "R2_REGION", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"} {
		t.Setenv(k, "")
	}
	t.Setenv("SITE_ORIGIN", "https://lms.example.test")
	t.Setenv("JWT_SECRET", strings.Repeat("r", 48))
}
func TestStartupValidation(t *testing.T) {
	for _, tc := range []struct{ Key, Value string }{{"JWT_SECRET", "short"}, {"JWT_SECRET", "<replace-with-secret>"}, {"SITE_ORIGIN", "https://example.test/path"}, {"SITE_ORIGIN", "http://example.test"}, {"SITE_ORIGIN", "https://user:pass@example.test"}, {"SESSION_TTL_SECONDS", "0"}, {"ADMIN_INITIAL_EMAIL", "admin@example.test"}, {"HTTP_ADDR", "bad"}, {"DB_PATH", ":memory:"}} {
		t.Run(tc.Key+tc.Value, func(t *testing.T) {
			clean(t)
			t.Setenv(tc.Key, tc.Value)
			if _, e := Load(); e == nil {
				t.Fatal("invalid config accepted")
			}
		})
	}
	clean(t)
	if _, e := Load(); e != nil {
		t.Fatal(e)
	}
	t.Setenv("SITE_ORIGIN", "http://localhost:5173")
	if _, e := Load(); e != nil {
		t.Fatal(e)
	}
}
func TestTrustedProxyConfig(t *testing.T) {
	for _, raw := range []string{"127.0.0.1", "0.0.0.0/0", "::/0", "127.0.0.1/32,", "bad", "::ffff:127.0.0.1/128"} {
		t.Run(raw, func(t *testing.T) {
			clean(t)
			t.Setenv("TRUSTED_PROXY_CIDRS", raw)
			if _, err := Load(); err == nil {
				t.Fatal("invalid proxy CIDRs accepted")
			}
		})
	}
	clean(t)
	t.Setenv("TRUSTED_PROXY_CIDRS", "127.0.0.1/32, ::1/128")
	c, err := Load()
	if err != nil || len(c.TrustedProxyCIDRs) != 2 {
		t.Fatalf("proxy config: %v %v", c.TrustedProxyCIDRs, err)
	}
}
func TestDotEnvNoOverridesOrExpansion(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	t.Setenv("LMS_TEST_EXISTING", "kept")
	t.Setenv("LMS_TEST_QUOTED", "")
	os.Unsetenv("LMS_TEST_QUOTED")
	t.Setenv("LMS_TEST_LITERAL", "")
	os.Unsetenv("LMS_TEST_LITERAL")
	if e := os.WriteFile(path, []byte("# comment\nLMS_TEST_EXISTING=changed\nLMS_TEST_QUOTED='with spaces'\nLMS_TEST_LITERAL=$HOME\n"), 0600); e != nil {
		t.Fatal(e)
	}
	if e := LoadDotEnv(path); e != nil {
		t.Fatal(e)
	}
	if os.Getenv("LMS_TEST_EXISTING") != "kept" || os.Getenv("LMS_TEST_QUOTED") != "with spaces" || os.Getenv("LMS_TEST_LITERAL") != "$HOME" {
		t.Fatal("dotenv behavior")
	}
	if e := LoadDotEnv(path + ".missing"); e != nil {
		t.Fatal(e)
	}
}
