package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:     "store2",
		Width:     1280,
		Height:    800,
		MinWidth:  1000,
		MinHeight: 700,
		Frameless: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 10, G: 10, B: 15, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
		// Drag region: any HTML element with style "--wails-draggable: drag"
		CSSDragProperty: "--wails-draggable",
		CSSDragValue:    "drag",

		Windows: &windows.Options{
			WebviewIsTransparent:              false,
			WindowIsTranslucent:               false,
			DisableWindowIcon:                 false,
			DisableFramelessWindowDecorations: false,
			BackdropType:                      windows.Mica,
		},
		Mac: &mac.Options{
			TitleBar: &mac.TitleBar{
				TitlebarAppearsTransparent: true,
				HideTitle:                  true,
				HideTitleBar:               false,
				FullSizeContent:            true,
				UseToolbar:                 false,
			},
			Appearance:           mac.NSAppearanceNameDarkAqua,
			WebviewIsTransparent: true,
			About: &mac.AboutInfo{
				Title:   "store2",
				Message: "Built with Grit",
			},
		},
		Linux: &linux.Options{
			WindowIsTranslucent: false,
			WebviewGpuPolicy:    linux.WebviewGpuPolicyAlways,
		},
	})
	if err != nil {
		log.Fatal(err)
	}
}
