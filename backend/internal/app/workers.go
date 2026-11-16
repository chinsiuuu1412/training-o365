package app

import (
	"context"
	"database/sql"
	"errors"
	"sync"
	"time"
)

// StartWorkers finalizes saved answers, independently of current user access.
func (a *App) StartWorkers(ctx context.Context) func() {
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		tick := time.NewTicker(time.Second)
		defer tick.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-tick.C:
				_ = a.scanDue(ctx, 100)
			}
		}
	}()
	return wg.Wait
}
func (a *App) scanDue(ctx context.Context, limit int) (err error) {
	defer func() {
		if recover() != nil {
			err = errors.New("không hoàn tất được bài quá hạn")
		}
	}()
	return a.DB.Write(ctx, func(tx *sql.Tx) error { FinalizeDue(ctx, tx, a.Now().UTC(), limit); return nil })
}
func (a *App) StartupScan(ctx context.Context) error {
	for {
		if e := a.scanDue(ctx, 100); e != nil {
			return e
		}
		now := a.Now().UTC()
		due := false
		for _, at := range rows(ctx, a.DB.Reader, "SELECT effective_cutoff_at FROM quiz_attempts WHERE status='in_progress' AND julianday(effective_cutoff_at)<=julianday(?)", timestamp(now)) {
			if !now.Before(parseTime(str(at, "effective_cutoff_at"))) {
				due = true
				break
			}
		}
		if !due {
			return nil
		}
	}
}
