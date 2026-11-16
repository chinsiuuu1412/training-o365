package app

import (
	"net/http/httptest"
	"net/netip"
	"testing"
)

func TestTrustedProxyClientIPAndLoginQuota(t *testing.T) {
	a, _ := setup(t)
	a.Config.TrustedProxyCIDRs = []netip.Prefix{netip.MustParsePrefix("127.0.0.1/32"), netip.MustParsePrefix("::1/128")}
	for _, tc := range []struct {
		name, peer string
		headers    []string
		want       string
	}{
		{"trusted", "127.0.0.1:1234", []string{"192.0.2.1"}, "192.0.2.1"},
		{"trusted ipv6", "[::1]:1234", []string{"2001:db8::1"}, "2001:db8::1"},
		{"untrusted spoof", "192.0.2.10:1234", []string{"192.0.2.1"}, "192.0.2.10"},
		{"chain", "127.0.0.1:1234", []string{"192.0.2.1, 192.0.2.2"}, "127.0.0.1"},
		{"malformed", "127.0.0.1:1234", []string{"not-an-ip"}, "127.0.0.1"},
		{"duplicate", "127.0.0.1:1234", []string{"192.0.2.1", "192.0.2.2"}, "127.0.0.1"},
		{"missing", "127.0.0.1:1234", nil, "127.0.0.1"},
		{"zone", "127.0.0.1:1234", []string{"fe80::1%eth0"}, "127.0.0.1"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest("POST", "https://lms.test/api/v1/auth/login", nil)
			r.RemoteAddr = tc.peer
			for _, v := range tc.headers {
				r.Header.Add("X-Forwarded-For", v)
			}
			if got := a.clientIP(r); got != tc.want {
				t.Fatalf("IP %q want %q", got, tc.want)
			}
		})
	}
	replenish(a)
	anon := &client{App: a, t: t}
	for i := 0; i < 6; i++ {
		s, m := anon.callHeaders("POST", "/auth/login", M{"email": "missing@example.test", "password": "wrong"}, map[string]string{"X-Forwarded-For": "192.0.2.1"})
		want := 401
		if i == 5 {
			want = 429
		}
		requireStatus(t, want, s, m)
		if i == 0 && str(m["error"].(map[string]any), "message") != "Email hoặc mật khẩu không đúng." {
			t.Fatal("Vietnamese login error changed")
		}
	}
	s, m := anon.callHeaders("POST", "/auth/login", M{"email": "missing@example.test", "password": "wrong"}, map[string]string{"X-Forwarded-For": "192.0.2.2"})
	requireStatus(t, 401, s, m)
	// No trust configured: rotating spoofed headers cannot evade peer quota.
	a.Config.TrustedProxyCIDRs = nil
	replenish(a)
	for i := 0; i < 6; i++ {
		s, m = anon.callHeaders("POST", "/auth/login", M{"email": "missing@example.test", "password": "wrong"}, map[string]string{"X-Forwarded-For": string(rune('a' + i))})
		want := 401
		if i == 5 {
			want = 429
		}
		requireStatus(t, want, s, m)
	}
}
