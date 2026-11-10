package services

import (
	"context"
	"log"
	"sync"

	"store2/apps/api/internal/models"
)

// SSOLoginHook runs after an enterprise SSO sign-in, with the connection the
// person came through, the account it resolved to, and the groups the IdP
// asserted. Register one from routes.Setup:
//
//	services.OnSSOLogin(func(ctx context.Context, conn *models.SSOConnection, user *models.User, groups []string) error {
//	    // The connection belongs to one customer, so this is where a
//	    // multi-tenant app puts the person in their organisation.
//	    orgID, err := orgForConnection(ctx, conn.ID)
//	    if err != nil {
//	        return err
//	    }
//	    return ensureMember(ctx, orgID, user.ID, roleFromGroups(groups))
//	})
//
// The connection and the groups are both here because they are what an app
// needs and what the OAuth hook's goth.User does not carry: which customer
// this is, and what their directory says about the person.
//
// It runs on every SSO sign-in, not only the first, which is what makes it
// usable for a membership that should be kept in step with the directory.
type SSOLoginHook func(ctx context.Context, conn *models.SSOConnection, user *models.User, groups []string) error

var (
	ssoHookMu sync.RWMutex
	ssoHooks  []SSOLoginHook
)

// OnSSOLogin adds a hook. Call it at boot, from routes.Setup or main.
func OnSSOLogin(hook SSOLoginHook) {
	if hook == nil {
		return
	}
	ssoHookMu.Lock()
	defer ssoHookMu.Unlock()
	ssoHooks = append(ssoHooks, hook)
}

// RunSSOLoginHooks runs them in the order they were registered. The OIDC
// callback and the SAML ACS call this; an app does not.
//
// A hook that fails is logged and the rest still run, and the sign-in still
// succeeds, which is the same choice applyGroupRoles makes two lines earlier:
// somebody who authenticated correctly against their company's IdP should not
// be stranded because a membership row would not write. A hook that must be
// able to refuse a sign-in belongs in the callback itself.
//
// It is worth knowing what that means for a multi-tenant app: a failed hook
// leaves a person signed in with no organisation. If that is worse for you
// than a refused sign-in, have the hook record the failure somewhere your
// own middleware checks, rather than letting them through to a half-placed
// session.
func RunSSOLoginHooks(ctx context.Context, conn *models.SSOConnection, user *models.User, groups []string) {
	ssoHookMu.RLock()
	hooks := make([]SSOLoginHook, len(ssoHooks))
	copy(hooks, ssoHooks)
	ssoHookMu.RUnlock()

	for _, hook := range hooks {
		if err := hook(ctx, conn, user, groups); err != nil {
			slug := ""
			if conn != nil {
				slug = conn.Slug
			}
			log.Printf("sso %s: a login hook for %s failed: %v", slug, user.ID, err)
		}
	}
}

// ResetSSOLoginHooks empties the registry. For tests.
func ResetSSOLoginHooks() {
	ssoHookMu.Lock()
	defer ssoHookMu.Unlock()
	ssoHooks = nil
}
