package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"o365-lms/backend/internal/app"
	"o365-lms/backend/internal/config"
	"o365-lms/backend/internal/db"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	if e := run(); e != nil {
		log.Print(e)
		os.Exit(1)
	}
}
func run() error {
	if e := config.LoadDotEnv(".env"); e != nil {
		return e
	}
	c, e := config.Load()
	if e != nil {
		return e
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	d, e := db.Open(ctx, c.DBPath, c.ReaderConnections)
	if e != nil {
		return e
	}
	defer d.Close()
	if e = app.Bootstrap(ctx, d, c); e != nil {
		return e
	}
	a := app.New(c, d)
	if e = a.StartupScan(ctx); e != nil {
		return e
	}
	wait := a.StartWorkers(ctx)
	server := &http.Server{Addr: c.Addr, Handler: a.Handler(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 << 10}
	done := make(chan error, 1)
	go func() { done <- server.ListenAndServe() }()
	log.Print("API sẵn sàng")
	select {
	case e = <-done:
		stop()
		wait()
		if errors.Is(e, http.ErrServerClosed) {
			return nil
		}
		return errors.New("không khởi động được máy chủ HTTP")
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		e = server.Shutdown(shutdown)
		wait()
		return e
	}
}
