package models

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"gorm.io/gorm"
	"store2/apps/api/internal/ids"
)

// Role is a named bag of permission grants.
//
// Grants hold whatever the operator authored, wildcards included — see
// internal/authz for the key format and matcher. Storing "products.*" rather
// than the expanded leaves is deliberate: the role keeps working when a new
// action shows up in the catalog.
type Role struct {
	ID string `gorm:"primarykey;size:36" json:"id"`

	// OwnerOrgID is "" for a role the platform defines, and an organization's
	// id for one that organization defined for itself. The name is unique per
	// owner, so two organizations can each have an "Accountant" and neither
	// can rename the platform's ADMIN out from under the other.
	//
	// Deliberately NOT called org_id. The multitenant plugin scopes every
	// query on a model carrying org_id to the active organization, so that
	// name would hide every platform role from every request made inside an
	// organization: the roles table would appear empty mid-request and every
	// permission lookup would fail closed. See grit#130.
	//
	// Without the plugin this is always "" and the index behaves exactly like
	// the unique name it replaced.
	OwnerOrgID string `gorm:"size:36;not null;default:'';uniqueIndex:idx_roles_owner_name" json:"owner_org_id,omitempty"`

	Name        string `gorm:"size:80;not null;uniqueIndex:idx_roles_owner_name" json:"name" binding:"required"`
	Description string `gorm:"size:500" json:"description"`

	// Grants is a JSON array of permission keys. Use GrantsList/SetGrants
	// rather than touching it directly.
	Grants string `gorm:"type:text" json:"-"`

	// IsSystem marks a role the app seeds and depends on. System roles can be
	// edited but not deleted or renamed — enforced in the handler, not just the
	// UI, so a direct API call can't rename ADMIN out from under the guards.
	IsSystem bool `gorm:"default:false;index" json:"is_system"`

	Version   int            `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (r *Role) BeforeCreate(tx *gorm.DB) error {
	if r.ID == "" {
		r.ID = ids.New()
	}
	return nil
}

func (r *Role) BeforeUpdate(tx *gorm.DB) error {
	tx.Statement.SetColumn("version", gorm.Expr("version + 1"))
	return nil
}

// GrantsList decodes the stored grants.
//
// A malformed value yields NO permissions rather than an error: this is an
// authorization path, and the safe failure mode is to deny.
func (r *Role) GrantsList() []string {
	if r.Grants == "" {
		return nil
	}
	var out []string
	if err := json.Unmarshal([]byte(r.Grants), &out); err != nil {
		return nil
	}
	return out
}

func (r *Role) SetGrants(grants []string) error {
	if grants == nil {
		grants = []string{}
	}
	b, err := json.Marshal(grants)
	if err != nil {
		return err
	}
	r.Grants = string(b)
	return nil
}

// MarshalJSON exposes grants as a real array to API clients while keeping the
// column a string internally.
func (r Role) MarshalJSON() ([]byte, error) {
	type alias Role
	return json.Marshal(struct {
		alias
		Grants []string `json:"grants"`
	}{alias(r), r.GrantsList()})
}

// UserRole assigns a Role to a User.
//
// No DeletedAt on purpose — see the note on roleModelGo. Re-granting a
// previously removed role must be idempotent, and a tombstone row makes the
// composite PK reject it.
type UserRole struct {
	UserID    string    `gorm:"primaryKey;size:36;index" json:"user_id"`
	RoleID    string    `gorm:"primaryKey;size:36;index" json:"role_id"`
	CreatedAt time.Time `json:"created_at"`
}

func (UserRole) TableName() string { return "user_roles" }

// DefaultRoles are seeded on first boot.
//
// The grants mirror what the routes enforced BEFORE permissions existed, so
// upgrading an app doesn't change who can do what:
//
//	ADMIN  — everything, via the "*" superuser grant
//	EDITOR — content, matching the role's existing meaning
//	USER   — nothing privileged; ordinary users hold no admin permissions
//
// Note this is NOT "every role gets every permission". The route guard passes if
// the caller matches the legacy role name OR holds the permission, so granting
// USER the full catalog would hand every signed-up user the admin panel.
func DefaultRoles() []Role {
	return []Role{
		{
			Name:        RoleAdmin,
			Description: "Full access to every feature and action.",
			IsSystem:    true,
			Grants:      `["*"]`,
		},
		{
			Name:        RoleEditor,
			Description: "Manages content and uploads. No user or system administration.",
			IsSystem:    true,
			Grants:      `["uploads.create","uploads.view","uploads.delete","users.view"]`,
		},
		{
			Name:        RoleUser,
			Description: "Standard account. No administrative permissions.",
			IsSystem:    true,
			Grants:      `[]`,
		},
	}
}

// PlatformRoles narrows a query to the roles the platform defines, leaving
// out any an organization made for itself.
//
// Every lookup of a role BY NAME has to go through this. A name is unique per
// owner, not globally, so "the role called ADMIN" is a question with as many
// answers as there are organizations, and the one meant is almost always the
// platform's. The four places that forgot are how a customer's "Accountant"
// could be picked up as if the platform had defined it. See grit#130.
func PlatformRoles(q *gorm.DB) *gorm.DB {
	return q.Where("owner_org_id = ?", "")
}

// OrgRoles narrows a query to the roles one organization defined for itself.
func OrgRoles(q *gorm.DB, orgID string) *gorm.DB {
	return q.Where("owner_org_id = ?", orgID)
}

// dropLegacyRoleNameIndex removes the unique index on roles.name alone.
//
// A role's name is unique per OWNER now, so two organizations can each have
// an "Accountant". AutoMigrate creates idx_roles_owner_name and leaves the
// old idx_roles_name in place, and while that one exists the second
// Accountant is still refused: the feature would be present and not work.
// See grit#130.
//
// Called from SeedRoles because that runs during migrate, right after
// AutoMigrate has created the replacement and before anything reads the
// table. Dropping first would leave a window with no uniqueness at all,
// which is where two platform roles called ADMIN come from.
//
// A failure is reported rather than swallowed. A project that still has the
// old index has a feature that looks available and is not, and finding that
// out from a constraint violation months later is worse than a loud migrate.
func dropLegacyRoleNameIndex(db *gorm.DB) error {
	mig := db.Migrator()
	if !mig.HasIndex(&Role{}, "idx_roles_name") {
		return nil
	}
	if !mig.HasIndex(&Role{}, "idx_roles_owner_name") {
		log.Println("roles: idx_roles_owner_name is missing, so the old unique " +
			"index on name was left alone. Organizations cannot define roles of " +
			"their own until the schema is migrated (grit#130).")
		return nil
	}
	if err := mig.DropIndex(&Role{}, "idx_roles_name"); err != nil {
		return fmt.Errorf("dropping the old unique index on roles.name: %w", err)
	}
	log.Println("roles: name is unique per owner now, not across the platform")
	return nil
}

// SeedRoles inserts the default roles if they are missing.
//
// Idempotent, and deliberately NON-destructive: an existing role's grants are
// left alone. Re-applying defaults on every boot would silently revert an
// operator's edits — a real bug in the system this was modelled on, where
// seeding ran on every roles-page load and quietly undid their changes.
// "Reset to defaults" is an explicit action in the UI instead.
func SeedRoles(db *gorm.DB) error {
	if err := dropLegacyRoleNameIndex(db); err != nil {
		return err
	}
	for _, want := range DefaultRoles() {
		var existing Role
		// Find, not First: on a fresh database every role is missing, and First
		// logs each miss as "record not found" — three scary-looking lines on
		// the first migrate even though creating them is exactly the point.
		// Find treats zero rows as normal and stays quiet.
		// Platform roles only. An organization that named a role ADMIN for
		// itself must not stop the platform's ADMIN being seeded, and must
		// not be mistaken for it.
		if err := PlatformRoles(db).Where("name = ?", want.Name).Limit(1).Find(&existing).Error; err != nil {
			return err
		}
		if existing.ID != "" {
			continue // already present — leave the operator's grants intact
		}
		role := want
		if err := db.Create(&role).Error; err != nil {
			return err
		}
	}
	return nil
}
