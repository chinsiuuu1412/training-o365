package app

import (
	"encoding/json"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRealTLSHTTPLoginMeLogout(t *testing.T) {
	a, _ := setup(t)
	server := httptest.NewTLSServer(a.Handler())
	defer server.Close()
	a.Config.Origin = server.URL
	httpClient := server.Client()
	jar, e := cookiejar.New(nil)
	if e != nil {
		t.Fatal(e)
	}
	httpClient.Jar = jar
	call := func(method, path, body, csrf string) (int, M) {
		t.Helper()
		r, e := http.NewRequest(method, server.URL+"/api/v1"+path, strings.NewReader(body))
		if e != nil {
			t.Fatal(e)
		}
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", server.URL)
		r.Header.Set("X-CSRF-Token", csrf)
		resp, e := httpClient.Do(r)
		if e != nil {
			t.Fatal(e)
		}
		defer resp.Body.Close()
		var m M
		if e = json.NewDecoder(resp.Body).Decode(&m); e != nil {
			t.Fatal(e)
		}
		return resp.StatusCode, m
	}
	s, m := call("POST", "/auth/login", `{"email":"admin@example.test","password":"test-password-123"}`, "")
	requireStatus(t, 200, s, m)
	csrf := str(result(m), "csrf_token")
	s, m = call("GET", "/auth/me", "", "")
	requireStatus(t, 200, s, m)
	s, m = call("POST", "/auth/logout", "{}", csrf)
	requireStatus(t, 200, s, m)
	s, m = call("GET", "/auth/me", "", "")
	requireStatus(t, 401, s, m)
}
