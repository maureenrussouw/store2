package database

import (
	"github.com/brianvoe/gofakeit/v7"
	"gorm.io/gorm"
	"store2/apps/api/internal/files"
	"store2/apps/api/internal/models"
)

// SeedCategories tops categories up to 10 fake rows. It is what
// "grit seed" runs; "grit seed Category --count N" runs SeedCategoriesTo with any
// other target.
func SeedCategories(db *gorm.DB) error {
	return SeedCategoriesTo(db, 10)
}

func init() {
	RegisterSeeder("Category", SeedCategoriesTo, "categories", "categories")
}

// SeedCategoriesTo tops categories up to target rows. It counts what is there and
// inserts only the rest, in batches, so running it twice does nothing the second
// time and a run that stopped partway resumes where it stopped. Row i is the
// row's number in the table, which keeps a unique column unique however many
// rows are asked for. Swap the gofakeit calls for your own values.
func SeedCategoriesTo(db *gorm.DB, target int64) error {
	return SeedTopUp(db, "categories", SeedPlan[models.Category]{
		Target: target,
		Make: func(n int64) models.Category {
			return models.Category{
				Name:     gofakeit.ProductName(),
				Image:    &files.FileRef{URL: "https://picsum.photos/seed/" + gofakeit.UUID() + "/600/400", Name: "sample.jpg", MIME: "image/jpeg"},
				Featured: gofakeit.Bool(),
			}
		},
	})
}
