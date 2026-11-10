package services

import (
	"context"
	"fmt"
	"math"

	"gorm.io/gorm"

	"store2/apps/api/internal/models"
)

// BlogService handles business logic for blogs.
type BlogService struct {
	DB *gorm.DB
}

// NewBlogService creates a new BlogService instance.
func NewBlogService(db *gorm.DB) *BlogService {
	return &BlogService{DB: db}
}

// searchScope is what searching a blog means, written once.
//
// The list and the admin's stat cards both narrow by the same text, and when
// each built its own WHERE they could answer different questions: add a column
// to one clause and the table filtered by it while the counts above it did
// not. One definition, two callers, so that cannot happen.
func (s *BlogService) searchScope(query *gorm.DB, search string) *gorm.DB {
	if search == "" {
		return query
	}
	// Portable case-insensitive search, ILIKE is Postgres-only.
	return query.Where("LOWER(title) LIKE LOWER(?) OR LOWER(content) LIKE LOWER(?)", "%"+search+"%", "%"+search+"%")
}

// CountQuery is the list's query for a search, without paging or ordering.
//
// It exists for the handler's stat cards, which need to count the same rows
// the list is about to return. Exported so the handler can ask the service for
// it rather than reaching past the service to the database and rebuilding the
// search by hand, which is the version that drifts.
func (s *BlogService) CountQuery(ctx context.Context, search string) *gorm.DB {
	return s.searchScope(s.DB.WithContext(ctx).Model(&models.Blog{}), search)
}

// List returns a paginated list of all blogs (admin).
func (s *BlogService) List(page, pageSize int, search, sortKey, sortDir string) ([]models.Blog, int64, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	if sortDir != "asc" && sortDir != "desc" {
		sortDir = "desc"
	}
	if sortKey == "" {
		sortKey = "created_at"
	}

	query := s.searchScope(s.DB.Model(&models.Blog{}), search)

	var total int64
	query.Count(&total)

	var blogs []models.Blog
	offset := (page - 1) * pageSize
	if err := query.Order(sortKey + " " + sortDir).Offset(offset).Limit(pageSize).Find(&blogs).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching blogs: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(pageSize)))
	return blogs, total, pages, nil
}

// ListPublished returns a paginated list of published blogs (public).
func (s *BlogService) ListPublished(page, pageSize int) ([]models.Blog, int64, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	query := s.DB.Model(&models.Blog{}).Where("published = ?", true)

	var total int64
	query.Count(&total)

	var blogs []models.Blog
	offset := (page - 1) * pageSize
	if err := query.Order("published_at DESC").Offset(offset).Limit(pageSize).Find(&blogs).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching published blogs: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(pageSize)))
	return blogs, total, pages, nil
}

// GetByID returns a single blog by ID.
func (s *BlogService) GetByID(id string) (*models.Blog, error) {
	var blog models.Blog
	if err := s.DB.First(&blog, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("blog not found: %w", err)
	}
	return &blog, nil
}

// GetBySlug returns a single published blog by slug.
func (s *BlogService) GetBySlug(slug string) (*models.Blog, error) {
	var blog models.Blog
	if err := s.DB.Where("slug = ? AND published = ?", slug, true).First(&blog).Error; err != nil {
		return nil, fmt.Errorf("blog not found: %w", err)
	}
	return &blog, nil
}

// Create creates a new blog.
func (s *BlogService) Create(blog *models.Blog) error {
	if err := s.DB.Create(blog).Error; err != nil {
		return fmt.Errorf("creating blog: %w", err)
	}
	return nil
}

// Update modifies an existing blog.
func (s *BlogService) Update(id string, data map[string]interface{}) (*models.Blog, error) {
	var blog models.Blog
	if err := s.DB.First(&blog, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("blog not found: %w", err)
	}

	if err := s.DB.Model(&blog).Updates(data).Error; err != nil {
		return nil, fmt.Errorf("updating blog: %w", err)
	}

	s.DB.First(&blog, "id = ?", id)
	return &blog, nil
}

// Delete soft-deletes a blog.
func (s *BlogService) Delete(id string) error {
	var blog models.Blog
	if err := s.DB.First(&blog, "id = ?", id).Error; err != nil {
		return fmt.Errorf("blog not found: %w", err)
	}
	if err := s.DB.Delete(&blog).Error; err != nil {
		return fmt.Errorf("deleting blog: %w", err)
	}
	return nil
}
