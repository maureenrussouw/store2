package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"store2/apps/api/internal/respond"
	"store2/apps/api/internal/services"
)

// ProductTreeHandler serves the hierarchy: the whole tree for a picker, the
// breadcrumbs for a detail page, and the two writes a drag-and-drop tree makes.
// Every query is the tree service's; this reads the request and answers.
type ProductTreeHandler struct {
	DB   *gorm.DB
	Tree *services.ProductTreeService
}

func NewProductTreeHandler(db *gorm.DB) *ProductTreeHandler {
	return &ProductTreeHandler{DB: db, Tree: services.NewProductTreeService(db)}
}

// GetTree handles GET /api/v1/products/tree.
func (h *ProductTreeHandler) GetTree(c *gin.Context) {
	nodes, err := h.Tree.Tree(c.Request.Context())
	if err != nil {
		respond.Fail(c, respond.CodeInternalError, "Failed to load the tree")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": nodes})
}

// GetBreadcrumbs handles GET /api/v1/products/:id/breadcrumbs.
func (h *ProductTreeHandler) GetBreadcrumbs(c *gin.Context) {
	rows, err := h.Tree.Breadcrumbs(c.Request.Context(), c.Param("id"))
	if err != nil {
		respond.Fail(c, respond.CodeNotFound, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// Move handles PATCH /api/v1/products/:id/move.
//
// parent_id is a pointer so the JSON can distinguish "move to the root"
// (parent_id: "") from "leave the parent alone" (field absent). Without that
// distinction a reorder within one parent would silently promote the node.
func (h *ProductTreeHandler) Move(c *gin.Context) {
	var req struct {
		ParentID *string `json:"parent_id"`
		Position int     `json:"position"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	// parent_id absent (nil) keeps the parent the node has: a reorder.
	if err := h.Tree.Move(c.Request.Context(), c.Param("id"), req.ParentID, req.Position); err != nil {
		// A refused move is the caller's mistake, not a server fault: it is
		// almost always an attempt to drop a node inside its own subtree.
		respond.Fail(c, respond.CodeInvalidMove, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Moved"})
}

// RebuildPaths handles POST /api/v1/products/rebuild-tree.
//
// Exists for one specific moment: --tree was added to a resource that already
// had rows, so every one of them has a NULL path and the tree renders flat.
// Also the repair for a bulk import that went around the hooks.
func (h *ProductTreeHandler) RebuildPaths(c *gin.Context) {
	if err := h.Tree.RebuildPaths(c.Request.Context()); err != nil {
		respond.Fail(c, respond.CodeInternalError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Paths rebuilt"})
}

// Reorder handles POST /api/v1/products/reorder, the ids of one parent's children
// in their new order.
func (h *ProductTreeHandler) Reorder(c *gin.Context) {
	var req struct {
		ParentID string   `json:"parent_id"`
		IDs      []string `json:"ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}
	if err := h.Tree.Reorder(c.Request.Context(), req.ParentID, req.IDs); err != nil {
		respond.Fail(c, respond.CodeInternalError, "Failed to reorder")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Reordered"})
}
