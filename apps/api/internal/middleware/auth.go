package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"store2/apps/api/internal/authz"
	"store2/apps/api/internal/models"
	"store2/apps/api/internal/respond"
	"store2/apps/api/internal/services"
)

// Auth creates a JWT authentication middleware.
func Auth(db *gorm.DB, authService *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Resolve the access token. The HttpOnly cookie path is the
		// recommended flow for browser clients — JS never sees the token,
		// so XSS cannot exfiltrate it. The Authorization: Bearer header
		// path is the fallback for native mobile / desktop clients that
		// can't or don't want to use cookies.
		token := ""
		if cookieValue, err := c.Cookie("grit_access"); err == nil && cookieValue != "" {
			token = cookieValue
		} else if authHeader := c.GetHeader("Authorization"); authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				respond.Fail(c, respond.CodeUnauthorized, "Invalid authorization header format")
				c.Abort()
				return
			}
			token = parts[1]
		}

		if token == "" {
			respond.Fail(c, respond.CodeUnauthorized, "Authentication required")
			c.Abort()
			return
		}

		// An access token, whose session is still live: a refresh token, or a
		// token from a session that logged out, is refused here.
		claims, err := authService.ValidateAccessToken(token)
		if err != nil {
			respond.Fail(c, respond.CodeUnauthorized, "Invalid or expired token")
			c.Abort()
			return
		}

		// Load user from database.
		// Use Where("id = ?") rather than First(&user, id) — GORM's shorthand
		// emits the bare value into the WHERE clause and Postgres rejects UUID
		// primary keys with "trailing junk after numeric literal".
		var user models.User
		if err := db.WithContext(c.Request.Context()).Where("id = ?", claims.UserID).First(&user).Error; err != nil {
			respond.Fail(c, respond.CodeUnauthorized, "User not found")
			c.Abort()
			return
		}

		if !user.Active {
			respond.Fail(c, respond.CodeAccountDisabled, "Your account has been disabled")
			c.Abort()
			return
		}

		c.Set("user", user)
		c.Set("user_id", user.ID)
		c.Set("user_email", user.Email)
		c.Set("user_role", user.Role)
		// The session this access token belongs to. Logout needs it: a client
		// holding a bearer token has no grit_refresh cookie to identify the
		// session by, and without this its logout revoked nothing and said it
		// had worked.
		if claims.SessionID != "" {
			c.Set("session_id", claims.SessionID)
		}

		// Resolve the caller's permission grants once per request so route
		// guards and handlers don't each hit the database. authz.GrantsFor is
		// cached and invalidated on role changes, so this is usually free.
		// A failure here is not fatal: the request continues with no grants and
		// role-name checks still apply, which fails closed rather than 500ing
		// every route the moment the roles table has a problem.
		if grants, err := authz.GrantsFor(db, user.ID); err == nil {
			c.Set("user_grants", grants)
		}

		// And the role NAMES, from the same store the grants came from.
		//
		// user_role was set from users.role above, which made it a second
		// source of an authorization answer: grant resolution reads the
		// user_roles join table and falls back to the column, while a route
		// guarded by a role name read the column outright. Where the two
		// disagree, RequireRole("ADMIN") and RequireRole("perm:users.delete")
		// answered from different data, and which you got depended on how the
		// route happened to be written (grit#154).
		//
		// The column is still the fallback inside RoleNamesFor, so a project
		// that predates user_roles behaves exactly as before. What it is no
		// longer is an independent answer. A failure leaves the value set from
		// the column, which is the old behaviour and fails no more open.
		if names, err := authz.RoleNamesFor(db, user.ID); err == nil && len(names) > 0 {
			c.Set("user_role", names[0])
			c.Set("user_roles", names)
		}

		c.Next()
	}
}

// Identify is Auth without the wall: it reads the session if there is one and
// lets the request through either way.
//
// It exists for the public pages that are not the same page for everybody. A
// catalogue that marks what the reader already owns, a pricing page that knows
// their current plan, an article with their own comment on it: each has to be
// readable signed out, which means no guard, which with Auth alone means the
// handler cannot tell who is reading even when they are signed in. Every app
// that wants this ends up parsing the Authorization header by hand in a
// handler, and that is how the cookie flow gets forgotten.
//
// It sets exactly what Auth sets, so c.GetString("user_id") reads the same on
// both kinds of route, and nothing else changes: a missing, malformed, expired
// or revoked token is simply an anonymous request, not a 401.
//
// It is not a guard and cannot be used as one. A handler behind Identify must
// treat "there is a user" as information, never as permission: anything that
// must not be served to a stranger belongs behind Auth.
func Identify(db *gorm.DB, authService *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Same two places Auth looks, in the same order: the HttpOnly cookie
		// browsers use, then the bearer header native clients use.
		token := ""
		if cookieValue, err := c.Cookie("grit_access"); err == nil && cookieValue != "" {
			token = cookieValue
		} else if authHeader := c.GetHeader("Authorization"); authHeader != "" {
			if parts := strings.SplitN(authHeader, " ", 2); len(parts) == 2 && parts[0] == "Bearer" {
				token = parts[1]
			}
		}
		if token == "" {
			c.Next()
			return
		}

		claims, err := authService.ValidateAccessToken(token)
		if err != nil {
			c.Next()
			return
		}

		var user models.User
		if err := db.WithContext(c.Request.Context()).Where("id = ?", claims.UserID).First(&user).Error; err != nil {
			c.Next()
			return
		}
		if !user.Active {
			c.Next()
			return
		}

		c.Set("user", user)
		c.Set("user_id", user.ID)
		c.Set("user_email", user.Email)
		c.Set("user_role", user.Role)
		// The session this access token belongs to. Logout needs it: a client
		// holding a bearer token has no grit_refresh cookie to identify the
		// session by, and without this its logout revoked nothing and said it
		// had worked.
		if claims.SessionID != "" {
			c.Set("session_id", claims.SessionID)
		}
		if grants, err := authz.GrantsFor(db, user.ID); err == nil {
			c.Set("user_grants", grants)
		}

		// And the role NAMES, from the same store the grants came from.
		//
		// user_role was set from users.role above, which made it a second
		// source of an authorization answer: grant resolution reads the
		// user_roles join table and falls back to the column, while a route
		// guarded by a role name read the column outright. Where the two
		// disagree, RequireRole("ADMIN") and RequireRole("perm:users.delete")
		// answered from different data, and which you got depended on how the
		// route happened to be written (grit#154).
		//
		// The column is still the fallback inside RoleNamesFor, so a project
		// that predates user_roles behaves exactly as before. What it is no
		// longer is an independent answer. A failure leaves the value set from
		// the column, which is the old behaviour and fails no more open.
		if names, err := authz.RoleNamesFor(db, user.ID); err == nil && len(names) > 0 {
			c.Set("user_role", names[0])
			c.Set("user_roles", names)
		}

		c.Next()
	}
}

// RequireRole guards a route by role name, permission, or both.
//
// Each argument is either a legacy role name ("ADMIN") or a permission key
// prefixed with "perm:" ("perm:users.delete"). Access is granted if ANY
// argument matches — so the two styles can be mixed during a migration:
//
//	protected.Use(middleware.RequireRole("ADMIN", "perm:users.delete"))
//
// The signature is unchanged on purpose: every existing RequireRole("ADMIN")
// call site keeps working untouched, and permissions can be adopted route by
// route instead of in one breaking sweep.
func RequireRole(rolesOrPerms ...string) gin.HandlerFunc {
	// Split once at construction rather than per request.
	var roles, perms []string
	for _, arg := range rolesOrPerms {
		if strings.HasPrefix(arg, "perm:") {
			perms = append(perms, strings.TrimPrefix(arg, "perm:"))
			continue
		}
		roles = append(roles, arg)
	}

	return func(c *gin.Context) {
		// Permission check first — it's the model we want callers to move to.
		if len(perms) > 0 {
			if grants, ok := c.Get("user_grants"); ok {
				if list, ok := grants.([]string); ok {
					for _, p := range perms {
						if authz.Granted(list, p) {
							c.Next()
							return
						}
					}
				}
			}
		}

		// No permission matched; fall back to the legacy role names.
		if len(roles) == 0 {
			respond.Fail(c, respond.CodeForbidden, "You do not have permission to perform this action")
			c.Abort()
			return
		}

		userRole, exists := c.Get("user_role")
		if !exists {
			respond.Fail(c, respond.CodeUnauthorized, "Not authenticated")
			c.Abort()
			return
		}

		role, ok := userRole.(string)
		if !ok {
			respond.Fail(c, respond.CodeInternalError, "Invalid user role")
			c.Abort()
			return
		}

		// Every role the caller holds, not just one. user_roles is many to
		// many, so once role names are resolved from it rather than from the
		// users.role column, a caller can hold several, and matching only the
		// first would refuse somebody whose ADMIN is their second assignment:
		// a new way to be wrong in exchange for fixing an old one (grit#154).
		//
		// user_role remains the first of them, so a handler reading it still
		// gets a sensible single answer.
		held := []string{role}
		if all, ok := c.Get("user_roles"); ok {
			if list, ok := all.([]string); ok && len(list) > 0 {
				held = list
			}
		}

		for _, r := range roles {
			for _, have := range held {
				if have == r {
					c.Next()
					return
				}
			}
		}

		respond.Fail(c, respond.CodeForbidden, "You do not have permission to access this resource")
		c.Abort()
	}
}

// RequireStaff admits anyone who can do something in the admin: the ADMIN
// role, or any permission at all. It is a gate, not a guard. Every route behind
// it names the permission it needs, and routes that name none stay in the ADMIN
// group, so one that forgets fails closed.
func RequireStaff() gin.HandlerFunc {
	return func(c *gin.Context) {
		if role, _ := c.Get("user_role"); role == models.RoleAdmin {
			c.Next()
			return
		}
		if grants, ok := c.Get("user_grants"); ok {
			if list, ok := grants.([]string); ok && len(list) > 0 {
				c.Next()
				return
			}
		}
		respond.Fail(c, respond.CodeForbidden, "You do not have permission to access this resource")
		c.Abort()
	}
}

// RequirePermissionFor guards a route whose resource is in the URL. The
// dashboard's stats and charts take it as :resource, so the permission they
// need is that resource's, which a route written once cannot name in advance.
func RequirePermissionFor(param, action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if role, _ := c.Get("user_role"); role == models.RoleAdmin {
			c.Next()
			return
		}
		if grants, ok := c.Get("user_grants"); ok {
			if list, ok := grants.([]string); ok && authz.Granted(list, c.Param(param)+"."+action) {
				c.Next()
				return
			}
		}
		respond.Fail(c, respond.CodeForbidden, "You do not have permission to access this resource")
		c.Abort()
	}
}
