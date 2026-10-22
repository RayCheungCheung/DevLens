# DevLens packaging resources

electron-builder looks here (buildResources: "build") for:

- icon.ico      Windows installer/shortcut icon
- icon.icns     macOS app icon
- icon.png      512x512, used for Linux + the DMG background

Drop these files in place and `npm run dist:*` picks them up automatically.
If a file is missing, electron-builder falls back to the Electron default icon,
so the build still succeeds.
