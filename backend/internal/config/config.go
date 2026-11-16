package config

import (
	"bufio"
	"errors"

	"net"
	"net/mail"
	"net/netip"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Addr, DBPath, Origin, JWTSecret, AdminEmail, AdminPassword string
	TrustedProxyCIDRs                                          []netip.Prefix
	SessionTTL                                                 time.Duration
	ReaderConnections                                          int
}

// LoadDotEnv never overrides process environment or interpolates secrets.
func LoadDotEnv(path string) error {
	f, err := os.Open(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return errors.New("không đọc được tệp cấu hình")
	}
	defer f.Close()
	s := bufio.NewScanner(f)
	for s.Scan() {
		line := strings.TrimSpace(s.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		k = strings.TrimSpace(k)
		v = strings.TrimSpace(v)
		if !ok || k == "" || strings.ContainsAny(k, " \t\r\n") {
			return errors.New("dòng cấu hình không hợp lệ")
		}
		if len(v) >= 2 && ((v[0] == '"' && v[len(v)-1] == '"') || (v[0] == '\'' && v[len(v)-1] == '\'')) {
			v = v[1 : len(v)-1]
		}
		if _, exists := os.LookupEnv(k); !exists {
			if err := os.Setenv(k, v); err != nil {
				return errors.New("không nạp được cấu hình")
			}
		}
	}
	return s.Err()
}
func Load() (Config, error) {
	c := Config{Addr: env("HTTP_ADDR", "127.0.0.1:8080"), DBPath: env("DB_PATH", "data/lms.db"), Origin: os.Getenv("SITE_ORIGIN"), JWTSecret: os.Getenv("JWT_SECRET"), AdminEmail: os.Getenv("ADMIN_INITIAL_EMAIL"), AdminPassword: os.Getenv("ADMIN_INITIAL_PASSWORD"), SessionTTL: 8 * time.Hour, ReaderConnections: 8}
	if len(c.JWTSecret) < 32 || strings.Contains(strings.ToLower(c.JWTSecret), "replace") || strings.Contains(c.JWTSecret, "<") {
		return c, errors.New("JWT_SECRET phải là bí mật ngẫu nhiên ít nhất 32 byte")
	}
	u, e := url.Parse(c.Origin)
	if e != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.Path != "" || (u.Scheme != "https" && !(u.Scheme == "http" && (u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1"))) {
		return c, errors.New("SITE_ORIGIN phải là origin HTTPS (HTTP chỉ cho localhost)")
	}
	if _, _, e = net.SplitHostPort(c.Addr); e != nil {
		return c, errors.New("HTTP_ADDR không hợp lệ")
	}
	if raw := os.Getenv("TRUSTED_PROXY_CIDRS"); raw != "" {
		for _, value := range strings.Split(raw, ",") {
			prefix, err := netip.ParsePrefix(strings.TrimSpace(value))
			if err != nil || prefix.Bits() == 0 || prefix.Addr().Is4In6() {
				return c, errors.New("TRUSTED_PROXY_CIDRS phải là danh sách CIDR hẹp, phân cách dấu phẩy")
			}
			c.TrustedProxyCIDRs = append(c.TrustedProxyCIDRs, prefix.Masked())
		}
	}
	if c.DBPath == "" || c.DBPath == ":memory:" {
		return c, errors.New("DB_PATH phải trỏ tới tệp SQLite")
	}
	if v := os.Getenv("SESSION_TTL_SECONDS"); v != "" {
		n, e := strconv.Atoi(v)
		if e != nil || n < 300 || n > 86400 {
			return c, errors.New("SESSION_TTL_SECONDS phải từ 300 đến 86400")
		}
		c.SessionTTL = time.Duration(n) * time.Second
	}
	if (c.AdminEmail == "") != (c.AdminPassword == "") {
		return c, errors.New("phải cung cấp cả hai ADMIN_INITIAL_EMAIL và ADMIN_INITIAL_PASSWORD")
	}
	if c.AdminEmail != "" {
		a, e := mail.ParseAddress(c.AdminEmail)
		if e != nil || a.Address != c.AdminEmail || len(c.AdminPassword) < 12 || len(c.AdminPassword) > 72 {
			return c, errors.New("thông tin bootstrap không hợp lệ")
		}
	}
	return c, nil
}
func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
