package handlers

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"store2/apps/api/internal/respond"
	"store2/apps/api/internal/services"
)

type SecurityHandler struct {
	Bridge *services.SecObsBridge
	// AutoBan is the sweep, shared with the scheduled job so the button and
	// the schedule cannot drift apart on policy.
	AutoBan *services.SecurityAutoBan
	// AutoBanEvery is how often the schedule runs it, for the page to say.
	AutoBanEvery time.Duration
}

// upstream runs one call to Sentinel or Pulse and records the ones that fail.
//
// Every call on these two dashboards used to throw its error away with a blank
// assignment. With the upstream down, each struct kept its zero value and the
// page rendered a 200 full of noughts: no banned IPs, no threats, no errors and
// no latency. That reads as "you are safe and fast", which is the opposite of
// what had happened.
//
// The names collected here go back in the response as "degraded", so the page
// can say which panels are guesses.
type upstream struct {
	degraded []string
}

func (u *upstream) get(name string, call func() error) {
	if err := call(); err != nil {
		u.degraded = append(u.degraded, name)
		log.Printf("dashboard: %s is unavailable: %v", name, err)
	}
}

// names returns the failures, never nil, so the JSON field is [] and not null.
func (u *upstream) names() []string {
	if u.degraded == nil {
		return []string{}
	}
	return u.degraded
}

// allFailed reports whether not one of total calls came back.
func (u *upstream) allFailed(total int) bool { return len(u.degraded) == total }

// sentinelBlocked is /sentinel/api/ip/blocked: the currently banned IPs.
type sentinelBlocked struct {
	Data []struct {
		IP        string     `json:"ip"`
		Reason    string     `json:"reason"`
		BlockedAt time.Time  `json:"blocked_at"`
		ExpiresAt *time.Time `json:"expires_at"`
	} `json:"data"`
}

// sentinelStats is /sentinel/api/analytics/summary: ThreatStats for a window.
type sentinelStats struct {
	Data struct {
		TotalThreats int64 `json:"total_threats"`
		BlockedCount int64 `json:"blocked_count"`
	} `json:"data"`
}

// sentinelThreats is /sentinel/api/threats: the most recent ThreatEvents.
type sentinelThreats struct {
	Data []struct {
		ID          string    `json:"id"`
		IP          string    `json:"ip"`
		Path        string    `json:"path"`
		ThreatTypes []string  `json:"threat_types"`
		Severity    string    `json:"severity"`
		Timestamp   time.Time `json:"timestamp"`
	} `json:"data"`
}

// sentinelScore is /sentinel/api/score: the graded posture, 0-100.
type sentinelScore struct {
	Data struct {
		Overall int    `json:"overall"`
		Grade   string `json:"grade"`
		Trend   string `json:"trend"`
	} `json:"data"`
}

// sentinelFullStats is the whole ThreatStats, not the two fields the first
// version of this dashboard read.
type sentinelFullStats struct {
	Data struct {
		TotalThreats   int64 `json:"total_threats"`
		CriticalCount  int64 `json:"critical_count"`
		HighCount      int64 `json:"high_count"`
		MediumCount    int64 `json:"medium_count"`
		LowCount       int64 `json:"low_count"`
		BlockedCount   int64 `json:"blocked_count"`
		UniqueIPs      int64 `json:"unique_ips"`
		TopAttackTypes []struct {
			Type  string `json:"type"`
			Count int64  `json:"count"`
		} `json:"top_attack_types"`
	} `json:"data"`
}

// sentinelTrends is /sentinel/api/analytics/attack-trends: one bucket per
// interval.
type sentinelTrends struct {
	Data []struct {
		Period string           `json:"period"`
		Total  int64            `json:"total"`
		ByType map[string]int64 `json:"by_type"`
	} `json:"data"`
}

// sentinelTargets is /sentinel/api/analytics/top-targets: the routes being
// asked for.
type sentinelTargets struct {
	Data []struct {
		Route  string `json:"route"`
		Method string `json:"method"`
		Count  int64  `json:"count"`
	} `json:"data"`
}

// sentinelActors is /sentinel/api/actors: who is sending it.
type sentinelActors struct {
	Data []struct {
		IP          string    `json:"ip"`
		ThreatCount int       `json:"threat_count"`
		RiskScore   int       `json:"risk_score"`
		Country     string    `json:"country"`
		Status      string    `json:"status"`
		LastSeen    time.Time `json:"last_seen"`
	} `json:"data"`
}

// sentinelThreatPage is the threat log with its total, which is what makes
// pagination possible.
type sentinelThreatPage struct {
	Data []struct {
		ID          string    `json:"id"`
		IP          string    `json:"ip"`
		Method      string    `json:"method"`
		Path        string    `json:"path"`
		ThreatTypes []string  `json:"threat_types"`
		Severity    string    `json:"severity"`
		Blocked     bool      `json:"blocked"`
		Timestamp   time.Time `json:"timestamp"`
	} `json:"data"`
	Meta struct {
		Total    int `json:"total"`
		Page     int `json:"page"`
		PageSize int `json:"page_size"`
	} `json:"meta"`
}

// Summary returns everything the five cards and the score explainer read.
//
// It is one call rather than five because the page shows them together: five
// requests would paint the row in five steps, and any one of them failing
// would leave a card that is indistinguishable from a card that is zero. The
// degraded list is what tells those two apart.
//
// On a fresh app with no traffic, expect zeros and empty arrays: that is the
// truth, not a bug.
func (h *SecurityHandler) Summary(c *gin.Context) {
	if h.Bridge == nil {
		respond.Fail(c, respond.CodeSentinelOff, "Sentinel is not enabled")
		return
	}

	ctx := c.Request.Context()
	var up upstream

	get := func(name, path string, out interface{}) {
		up.get(name, func() error { return h.Bridge.SentinelGet(ctx, path, out) })
	}

	var blockedResp sentinelBlocked
	get("blocked_ips", "/sentinel/api/ip/blocked", &blockedResp)

	var statsResp sentinelFullStats
	get("threat_stats", "/sentinel/api/analytics/summary?window=24h", &statsResp)

	var scoreResp sentinelScore
	get("security_score", "/sentinel/api/score", &scoreResp)

	var threatsResp sentinelThreats
	get("recent_threats", "/sentinel/api/threats?limit=10", &threatsResp)

	// Nothing answered. Zeros here would be a claim that no IP is banned and
	// nothing has attacked this app, which is a worse answer than an error.
	if up.allFailed(4) {
		c.JSON(http.StatusBadGateway, gin.H{
			"error": gin.H{
				"code":    "SENTINEL_UNAVAILABLE",
				"message": "Sentinel is not answering",
				"details": gin.H{"degraded": up.names()},
			},
		})
		return
	}

	// Sentinel's BlockedIP carries no flag saying who made the ban, so the
	// reason is the only evidence. services.IsAutoBan owns that reading, and
	// the sweep writes the prefix it looks for.
	automatic, manual := 0, 0
	activeBans := make([]gin.H, 0, len(blockedResp.Data))
	for _, b := range blockedResp.Data {
		var expires string
		if b.ExpiresAt != nil {
			expires = b.ExpiresAt.Format(time.RFC3339)
		}
		auto := services.IsAutoBan(b.Reason)
		if auto {
			automatic++
		} else {
			manual++
		}
		activeBans = append(activeBans, gin.H{
			"ip":         b.IP,
			"reason":     b.Reason,
			"blocked_at": b.BlockedAt.Format(time.RFC3339),
			"expires_at": expires,
			"permanent":  b.ExpiresAt == nil,
			"automatic":  auto,
		})
	}

	recentThreats := make([]gin.H, 0, len(threatsResp.Data))
	for _, t := range threatsResp.Data {
		threatType := ""
		if len(t.ThreatTypes) > 0 {
			threatType = t.ThreatTypes[0]
		}
		recentThreats = append(recentThreats, gin.H{
			"id":          t.ID,
			"type":        threatType,
			"ip":          t.IP,
			"description": t.Path,
			"created_at":  t.Timestamp.Format(time.RFC3339),
		})
	}

	stats := statsResp.Data
	c.JSON(http.StatusOK, gin.H{
		"score":       scoreResp.Data.Overall,
		"grade":       scoreResp.Data.Grade,
		"score_trend": scoreResp.Data.Trend,

		"threats_24h":    stats.TotalThreats,
		"unique_ips_24h": stats.UniqueIPs,
		"critical_24h":   stats.CriticalCount,
		"high_24h":       stats.HighCount,
		"medium_24h":     stats.MediumCount,
		"low_24h":        stats.LowCount,
		"blocked_24h":    stats.BlockedCount,

		"banned_ips_now":   len(blockedResp.Data),
		"banned_automatic": automatic,
		"banned_manual":    manual,

		// Kept because the desktop system page and the older admin build read
		// them. Removing them would break a screen that nobody is changing.
		"auto_bans_24h":          stats.BlockedCount,
		"rate_limited_last_hour": 0,
		"rate_limit_hits_5min":   []gin.H{},

		"active_bans":    activeBans,
		"recent_threats": recentThreats,
		"auto_ban":       h.autoBanPolicy(),
		// The panels whose numbers are missing rather than zero.
		"degraded": up.names(),
	})
}

// autoBanPolicy is what the sweep will do, so the page can say it rather than
// make the reader go and find the configuration.
func (h *SecurityHandler) autoBanPolicy() gin.H {
	if h.AutoBan == nil {
		return gin.H{"enabled": false}
	}
	cfg := h.AutoBan.Config
	return gin.H{
		"enabled":     cfg.Enabled,
		"min_threats": cfg.MinThreats,
		"window":      cfg.Window.String(),
		"every":       h.AutoBanEvery.String(),
		"permanent":   cfg.Permanent,
	}
}

// Trends is the hourly shape of the last day: how many threats arrived, and
// how many of them were stopped rather than written down.
func (h *SecurityHandler) Trends(c *gin.Context) {
	if h.Bridge == nil {
		respond.Fail(c, respond.CodeSentinelOff, "Sentinel is not enabled")
		return
	}
	window := c.DefaultQuery("window", "24h")
	if _, err := time.ParseDuration(window); err != nil {
		respond.Fail(c, respond.CodeValidationError, "window must be a duration such as \"24h\"")
		return
	}
	var trends sentinelTrends
	if err := h.Bridge.SentinelGet(c.Request.Context(),
		"/sentinel/api/analytics/attack-trends?window="+url.QueryEscape(window)+"&interval=hour", &trends); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": gin.H{
			"code": "SENTINEL_UNAVAILABLE", "message": "Sentinel is not answering"}})
		return
	}
	points := make([]gin.H, 0, len(trends.Data))
	for _, t := range trends.Data {
		points = append(points, gin.H{"period": t.Period, "total": t.Total, "by_type": t.ByType})
	}
	c.JSON(http.StatusOK, gin.H{"data": points, "window": window})
}

// Top is the three ranked lists under the chart: what is being tried, where,
// and by whom. One call, because they are read together and each is small.
func (h *SecurityHandler) Top(c *gin.Context) {
	if h.Bridge == nil {
		respond.Fail(c, respond.CodeSentinelOff, "Sentinel is not enabled")
		return
	}
	window := c.DefaultQuery("window", "168h")
	if _, err := time.ParseDuration(window); err != nil {
		respond.Fail(c, respond.CodeValidationError, "window must be a duration such as \"168h\"")
		return
	}
	ctx := c.Request.Context()
	var up upstream
	get := func(name, path string, out interface{}) {
		up.get(name, func() error { return h.Bridge.SentinelGet(ctx, path, out) })
	}

	// Attack types come from the trend buckets rather than from
	// analytics/summary's top_attack_types, which is filled by Sentinel's
	// in-memory store and by none of the persistent ones: on SQLite, Postgres
	// or MySQL, which is every real deployment, that field is always empty.
	// The per-bucket by_type map holds the same counts and is populated
	// everywhere, so it is summed here (sentinel#44).
	var trends sentinelTrends
	get("attack_types", "/sentinel/api/analytics/attack-trends?window="+url.QueryEscape(window)+"&interval=day", &trends)

	var targets sentinelTargets
	get("targeted_routes", "/sentinel/api/analytics/top-targets?window="+url.QueryEscape(window)+"&limit=10", &targets)

	// Sentinel's ListActors orders by last_seen and ignores sort_by in every
	// store (sentinel#44), so asking for threat_count returns the most recent
	// instead of the busiest. A page of 10 would therefore be "the last 10 addresses seen",
	// which is a different list wearing this one's title. Read a wide page and
	// rank here.
	var actors sentinelActors
	get("active_ips", "/sentinel/api/actors?page_size=200", &actors)

	if up.allFailed(3) {
		c.JSON(http.StatusBadGateway, gin.H{"error": gin.H{
			"code": "SENTINEL_UNAVAILABLE", "message": "Sentinel is not answering"}})
		return
	}

	byType := map[string]int64{}
	for _, bucket := range trends.Data {
		for name, n := range bucket.ByType {
			byType[name] += n
		}
	}
	attackTypes := make([]gin.H, 0, len(byType))
	for name, n := range byType {
		attackTypes = append(attackTypes, gin.H{"type": name, "count": n})
	}
	sort.Slice(attackTypes, func(i, j int) bool {
		a, b := attackTypes[i]["count"].(int64), attackTypes[j]["count"].(int64)
		if a != b {
			return a > b
		}
		return attackTypes[i]["type"].(string) < attackTypes[j]["type"].(string)
	})
	routes := make([]gin.H, 0, len(targets.Data))
	for _, t := range targets.Data {
		routes = append(routes, gin.H{"route": t.Route, "method": t.Method, "count": t.Count})
	}
	ranked := actors.Data
	sort.SliceStable(ranked, func(i, j int) bool {
		if ranked[i].ThreatCount != ranked[j].ThreatCount {
			return ranked[i].ThreatCount > ranked[j].ThreatCount
		}
		return ranked[i].LastSeen.After(ranked[j].LastSeen)
	})
	if len(ranked) > 10 {
		ranked = ranked[:10]
	}
	ips := make([]gin.H, 0, len(ranked))
	for _, a := range ranked {
		ips = append(ips, gin.H{
			"ip": a.IP, "count": a.ThreatCount, "risk": a.RiskScore,
			"country": a.Country, "status": a.Status,
			"last_seen": a.LastSeen.Format(time.RFC3339),
		})
	}
	c.JSON(http.StatusOK, gin.H{
		"attack_types": attackTypes,
		"routes":       routes,
		"ips":          ips,
		"window":       window,
		"degraded":     up.names(),
	})
}

// Threats is the log itself: filtered by severity, searched by address or
// path, and paged, because 18,000 rows is a normal number and a page that
// shows the newest ten of them cannot be acted on.
func (h *SecurityHandler) Threats(c *gin.Context) {
	if h.Bridge == nil {
		respond.Fail(c, respond.CodeSentinelOff, "Sentinel is not enabled")
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	query := fmt.Sprintf("/sentinel/api/threats?page=%d&page_size=%d", page, pageSize)
	if severity := strings.TrimSpace(c.Query("severity")); severity != "" && !strings.EqualFold(severity, "all") {
		// Sentinel filters on the exact stored word, which is capitalised.
		canonical, ok := services.CanonicalSeverity(severity)
		if !ok {
			respond.Fail(c, respond.CodeValidationError, "severity must be critical, high, medium, low or all")
			return
		}
		query += "&severity=" + canonical
	}
	if search := strings.TrimSpace(c.Query("search")); search != "" {
		query += "&search=" + url.QueryEscape(search)
	}

	var got sentinelThreatPage
	if err := h.Bridge.SentinelGet(c.Request.Context(), query, &got); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": gin.H{
			"code": "SENTINEL_UNAVAILABLE", "message": "Sentinel is not answering"}})
		return
	}

	rows := make([]gin.H, 0, len(got.Data))
	for _, t := range got.Data {
		threatType := ""
		if len(t.ThreatTypes) > 0 {
			threatType = t.ThreatTypes[0]
		}
		outcome := "Logged"
		if t.Blocked {
			outcome = "Blocked"
		}
		rows = append(rows, gin.H{
			"id":        t.ID,
			"ip":        t.IP,
			"method":    t.Method,
			"path":      t.Path,
			"type":      threatType,
			"severity":  t.Severity,
			"blocked":   t.Blocked,
			"outcome":   outcome,
			"timestamp": t.Timestamp.Format(time.RFC3339),
		})
	}
	total := got.Meta.Total
	pages := 1
	if pageSize > 0 && total > 0 {
		pages = (total + pageSize - 1) / pageSize
	}
	c.JSON(http.StatusOK, gin.H{
		"data": rows,
		"meta": gin.H{"total": total, "page": page, "page_size": pageSize, "pages": pages},
	})
}

// banRequest is one address, by hand.
type banRequest struct {
	IP        string `json:"ip" binding:"required"`
	Reason    string `json:"reason"`
	Permanent bool   `json:"permanent"`
	Duration  string `json:"duration"`
}

// Ban blocks one address.
func (h *SecurityHandler) Ban(c *gin.Context) {
	if h.Bridge == nil {
		respond.Fail(c, respond.CodeSentinelOff, "Sentinel is not enabled")
		return
	}
	var req banRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, "An IP address is required")
		return
	}
	req.IP = strings.TrimSpace(req.IP)
	if net.ParseIP(req.IP) == nil {
		respond.Fail(c, respond.CodeValidationError, req.IP+" is not an IP address")
		return
	}
	// The app's own infrastructure speaks from these, and behind a proxy that
	// Sentinel has not been told to trust, so does every one of your users.
	if services.IsPrivateOrLoopbackIP(req.IP) {
		respond.Fail(c, respond.CodeValidationError,
			req.IP+" is a loopback or private address. Behind a reverse proxy every "+
				"request carries one, so banning it would ban everybody. Set "+
				"SENTINEL_TRUSTED_PROXIES so the real client address is read.")
		return
	}
	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		reason = "blocked from the admin dashboard"
	}
	body := map[string]interface{}{"ip": req.IP, "reason": reason}
	if req.Permanent {
		body["permanent"] = true
	} else if req.Duration != "" {
		if _, err := time.ParseDuration(req.Duration); err != nil {
			respond.Fail(c, respond.CodeValidationError, "duration must be a duration such as \"24h\"")
			return
		}
		body["duration"] = req.Duration
	}
	if err := h.Bridge.SentinelPost(c.Request.Context(), "/sentinel/api/ip/block", body, nil); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": gin.H{
			"code": "SENTINEL_UNAVAILABLE", "message": "Sentinel did not accept the ban"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": req.IP + " is banned", "data": gin.H{"ip": req.IP}})
}

// Unban lifts a ban, whoever made it.
func (h *SecurityHandler) Unban(c *gin.Context) {
	if h.Bridge == nil {
		respond.Fail(c, respond.CodeSentinelOff, "Sentinel is not enabled")
		return
	}
	ip := strings.TrimSpace(c.Param("ip"))
	if net.ParseIP(ip) == nil {
		respond.Fail(c, respond.CodeValidationError, "That is not an IP address")
		return
	}
	if err := h.Bridge.SentinelDelete(c.Request.Context(), "/sentinel/api/ip/block/"+url.PathEscape(ip), nil); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": gin.H{
			"code": "SENTINEL_UNAVAILABLE", "message": "Sentinel did not lift the ban"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": ip + " is no longer banned", "data": gin.H{"ip": ip}})
}

// BanOffenders runs the sweep now, on the same policy the schedule uses.
//
// The button exists because the schedule only sees what arrives after it is
// turned on, and the log it is turned on in front of is usually already full.
func (h *SecurityHandler) BanOffenders(c *gin.Context) {
	if h.AutoBan == nil {
		respond.Fail(c, respond.CodeSentinelOff, "Sentinel is not enabled")
		return
	}
	var req struct {
		DryRun bool `json:"dry_run"`
	}
	_ = c.ShouldBindJSON(&req)

	result, err := h.AutoBan.Run(c.Request.Context(), req.DryRun)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": gin.H{
			"code": "SENTINEL_UNAVAILABLE", "message": err.Error()}})
		return
	}
	message := "No address is over the threshold"
	switch {
	case req.DryRun && len(result.Banned) > 0:
		message = fmt.Sprintf("%d address(es) would be banned", len(result.Banned))
	case len(result.Banned) > 0:
		message = fmt.Sprintf("Banned %d high-threat IP(s). Enforcement starts within about 30 seconds.", len(result.Banned))
	}
	c.JSON(http.StatusOK, gin.H{"message": message, "data": result})
}
