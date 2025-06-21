const { app, BrowserWindow, screen } = require('electron')
const path = require('path')

let mainWindow

function createWindow() {
  // Get all displays
  const displays = screen.getAllDisplays()
  
  console.log('Available displays:', displays.length)
  displays.forEach((display, index) => {
    console.log(`Display ${index}:`, display.bounds)
  })
  
  // Choose your target monitor (0 = primary, 1 = second, 2 = third, etc.)
  const targetDisplay = displays[1] || displays[0]  // Third monitor, fallback to primary
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    x: targetDisplay.bounds.x + 100,  // 100px from left edge of target monitor
    y: targetDisplay.bounds.y + 100,  // 100px from top edge of target monitor
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  // Load the app
  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development'
  
  if (isDev) {
    // Development: load from Vite dev server
    mainWindow.loadURL('http://localhost:5173')
    // Open DevTools in development
    mainWindow.webContents.openDevTools()
  } else {
    // Production: load built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// This method will be called when Electron has finished initialization
app.whenReady().then(createWindow)

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// On macOS, re-create window when dock icon is clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})