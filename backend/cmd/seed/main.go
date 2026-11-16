package main

import (
	"context"
	"log"
	"o365-lms/backend/internal/app"
	"o365-lms/backend/internal/config"
	"o365-lms/backend/internal/db"
	"os"
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
	d, e := db.Open(context.Background(), c.DBPath, c.ReaderConnections)
	if e != nil {
		return e
	}
	defer d.Close()
	if e = app.Seed(context.Background(), d, os.Getenv("SEED_ADMIN_PASSWORD"), os.Getenv("SEED_MANAGER_PASSWORD"), os.Getenv("SEED_STUDENT_PASSWORD")); e != nil {
		return e
	}
	log.Print("Seed hoàn tất: 1 admin, 3 quản lý, 3 lớp, 100 học viên tổng hợp.")
	return nil
}
