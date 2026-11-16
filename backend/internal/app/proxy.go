package app

import (
	"net"
	"net/http"
	"net/netip"
	"strings"
)

// Only single-hop, proxy-overwritten X-Forwarded-For is supported; chains fail closed.
func (a *App) clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	peer, err := netip.ParseAddr(host)
	if err != nil {
		return r.RemoteAddr
	}
	peer = peer.Unmap()
	for _, prefix := range a.Config.TrustedProxyCIDRs {
		if !prefix.Contains(peer) {
			continue
		}
		values := r.Header.Values("X-Forwarded-For")
		if len(values) == 1 {
			ip, err := netip.ParseAddr(strings.TrimSpace(values[0]))
			if err == nil && ip.Zone() == "" {
				return ip.Unmap().String()
			}
		}
		break
	}
	return peer.String()
}
