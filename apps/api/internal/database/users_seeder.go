package database

import (
	"fmt"
	"log"
	"os"
	"time"

	"gorm.io/gorm"
	"store2/apps/api/internal/models"
)

// SeedUsers creates the default admin account plus a few demo accounts.
// Edit the slices below to change who gets seeded.
func SeedUsers(db *gorm.DB) error {
	if err := seedAdminUser(db); err != nil {
		return fmt.Errorf("seeding admin user: %w", err)
	}
	if err := seedDemoUsers(db); err != nil {
		return fmt.Errorf("seeding demo users: %w", err)
	}
	return nil
}

// seedAdminUser creates the default admin account.
func seedAdminUser(db *gorm.DB) error {
	var count int64
	db.Model(&models.User{}).Where("email = ?", "admin@example.com").Count(&count)
	if count > 0 {
		log.Println("Admin user already exists, skipping...")
		return nil
	}

	// SEED_ADMIN_PASSWORD wins, so a real deployment seeds a strong credential.
	// The documented "admin123" is for APP_ENV=development only. It was the
	// fallback for every environment except the one spelled "production", so a
	// staging or "prod" database got an administrator anyone could guess.
	password := os.Getenv("SEED_ADMIN_PASSWORD")
	if password == "" {
		if !seedDevDefaults() {
			return fmt.Errorf("refusing to seed admin@example.com with the development password: APP_ENV is %q, so set SEED_ADMIN_PASSWORD to a password of at least 12 characters", os.Getenv("APP_ENV"))
		}
		password = "admin123"
	} else if !seedDevDefaults() && len(password) < 12 {
		return fmt.Errorf("refusing to seed admin@example.com: SEED_ADMIN_PASSWORD is shorter than 12 characters and APP_ENV is %q", os.Getenv("APP_ENV"))
	}

	// Verified, because these addresses are not real and nobody can click a
	// link sent to them. A seeded account with email_verified_at null cannot
	// accept an organization invitation, change its email, or do anything else
	// gated on a confirmed address, so the first thing somebody tries on a
	// fresh project answers EMAIL_NOT_VERIFIED and offers no way forward.
	// Found trying the invitation flow from grit#184.
	//
	// Only seeded accounts. Registration still sends a link and still waits for
	// it: this is the seeder saying "pretend these were confirmed", which is
	// the same licence it already takes with "admin123".
	verifiedAt := time.Now()
	admin := models.User{
		FirstName:       "Admin",
		LastName:        "User",
		Email:           "admin@example.com",
		Password:        password,
		Role:            "ADMIN",
		Active:          true,
		EmailVerifiedAt: &verifiedAt,
	}

	if err := db.Create(&admin).Error; err != nil {
		return fmt.Errorf("creating admin user: %w", err)
	}

	if os.Getenv("SEED_ADMIN_PASSWORD") != "" {
		log.Println("Created admin user: admin@example.com (password from SEED_ADMIN_PASSWORD)")
	} else {
		log.Println("Created admin user: admin@example.com / admin123 (dev default: change before production)")
	}
	return nil
}

// seedDemoUsers creates sample user accounts for development.
// All demo users share the password "admin123" — the same as the admin
// seed — so the Concepts course / first-look lesson works without
// remembering a second password.
func seedDemoUsers(db *gorm.DB) error {
	// Demo users are development fixtures sharing a weak password, so they are
	// seeded with APP_ENV=development and nowhere else.
	if !seedDevDefaults() {
		log.Printf("Skipping demo users: APP_ENV is %q, not development", os.Getenv("APP_ENV"))
		return nil
	}
	users := []models.User{
		{FirstName: "Jane", LastName: "Cooper", Email: "jane@example.com", Password: "admin123", Role: "EDITOR", Active: true},
		{FirstName: "Robert", LastName: "Fox", Email: "robert@example.com", Password: "admin123", Role: "USER", Active: true},
		{FirstName: "Emily", LastName: "Davis", Email: "emily@example.com", Password: "admin123", Role: "USER", Active: true},
		{FirstName: "Michael", LastName: "Chen", Email: "michael@example.com", Password: "admin123", Role: "USER", Active: false},
	}

	verifiedAt := time.Now()
	for _, u := range users {
		var count int64
		db.Model(&models.User{}).Where("email = ?", u.Email).Count(&count)
		if count > 0 {
			continue
		}
		// See seedAdminUser: a seeded address cannot receive a link, so it
		// arrives confirmed.
		u.EmailVerifiedAt = &verifiedAt

		if err := db.Create(&u).Error; err != nil {
			log.Printf("Warning: failed to create user %s: %v", u.Email, err)
			continue
		}
		log.Printf("Created user: %s / admin123", u.Email)
	}

	return nil
}

// seedDevDefaults reports whether the weak development accounts may be seeded:
// only when APP_ENV says development. Unset, staging and prod are not.
func seedDevDefaults() bool {
	return os.Getenv("APP_ENV") == "development"
}
