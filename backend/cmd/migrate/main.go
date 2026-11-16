package main

import (
	"context"
	"log"
	"o365-lms/backend/internal/config"
	"o365-lms/backend/internal/db"
	"os"
)

func main() {
	if e := config.LoadDotEnv(".env"); e != nil {
		log.Print(e)
		os.Exit(1)
	}
	c, e := config.Load()
	if e != nil {
		log.Print(e)
		os.Exit(1)
	}
	d, e := db.Open(context.Background(), c.DBPath, c.ReaderConnections)
	if e != nil {
		log.Print(e)
		os.Exit(1)
	}
	d.Close()
	log.Print("Migration hoàn tất.")
}
