package app

func (a *App) register() {
	a.authRoutes()
	a.accountRoutes()
	a.classRoutes()
	a.enrollmentRoutes()
	a.sessionRoutes()
	a.quizRoutes()
	a.attendanceRoutes()
	a.materialRoutes()
	a.dashboardRoutes()
	a.announcementRoutes()
}
