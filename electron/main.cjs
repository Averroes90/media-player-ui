const { app, BrowserWindow, screen, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra'); // or const fs = require('fs').promises;
// const MPV = require('node-mpv');
const os = require('os');
let nativeModule = null;
try {
  try {
    nativeModule = require('../native/native.darwin-arm64.node');
  } catch {
    nativeModule = require('../native/native.node');
  }

  console.log('✅ Rust module loaded successfully!');
  // Initialize mpv
  const mpvInit = nativeModule.mediaInit();
  console.log('MPV initialization:', mpvInit ? 'Success' : 'Failed');
} catch (error) {
  console.error('❌ Failed to load Rust module:', error);
}
class MediaPlayerApp {
  constructor() {
    this.mainWindow = null;
    this.mpvPlayer = null;
    this.currentVideo = null;
    this.subtitleTracks = [];
    this.watchedFiles = new Map(); // Track current session files only
    this.fileValidationCache = new Map(); // Short-term validation cache
    this.playbackState = {
      playing: false,
      currentTime: 0,
      duration: 0,
      volume: 100,
    };
    this.userConfig = {
      preferredDisplay: 1, // Configurable
      windowPosition: { x: 100, y: 100 },
      autoTranscribe: true,
      defaultServices: ['google', 'openai'],
    };
  }

  async createWindow() {
    // GET displays first, then use them
    const displays = screen.getAllDisplays();

    console.log('Available displays:', displays.length);
    displays.forEach((display, index) => {
      console.log(`Display ${index}:`, display.bounds);
    });
    const targetDisplay =
      displays[this.userConfig.preferredDisplay] || displays[0];
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      x: targetDisplay.bounds.x + this.userConfig.windowPosition.x,
      y: targetDisplay.bounds.y + this.userConfig.windowPosition.y,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    // Load your Vue app
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    if (isDev) {
      // Try different ports that Vite might use
      const possiblePorts = [5173, 5174, 5175, 3000];
      let loaded = false;

      for (const port of possiblePorts) {
        try {
          await this.mainWindow.loadURL(`http://localhost:${port}`);
          console.log(`Successfully loaded from port ${port}`);
          loaded = true;
          break;
        } catch (error) {
          console.log(`Failed to load from port ${port}, trying next...`);
        }
      }

      if (!loaded) {
        console.error('Could not connect to Vite dev server on any port');
        // Fallback to showing an error or waiting
        await this.mainWindow.loadURL(
          'data:text/html,<h1>Waiting for Vite dev server...</h1>'
        );
      }

      this.mainWindow.webContents.openDevTools();
    } else {
      await this.mainWindow.loadFile(
        path.join(__dirname, '../dist/index.html')
      );
    }

    // Initialize MPV
    await this.initializeMPV();
    this.setupEventListeners();
    this.startFileMonitoring();
  }

  async initializeMPV() {
    try {
      // Initialize MPV with options
      this.mpvPlayer = new MPV(
        {
          binary: '/usr/local/bin/mpv', // Adjust path if needed
          socket: '/tmp/mpv-socket', // Unix socket for communication
        },
        [
          '--no-video', // We'll handle video display in renderer
          '--idle=yes',
          '--keep-open=yes',
          '--no-terminal',
          '--no-input-default-bindings',
          '--input-vo-keyboard=no',
          '--no-sub', // Disable built-in subtitles
          '--audio-display=no',
          '--speed=1.0',
        ]
      );

      await this.mpvPlayer.start();
      console.log('MPV initialized successfully');

      // Set up MPV event listeners
      this.setupMPVListeners();
    } catch (error) {
      console.error('Failed to initialize MPV:', error);
      // Fallback or error handling
    }
  }

  setupMPVListeners() {
    if (!this.mpvPlayer) return;

    // Playback events
    this.mpvPlayer.on('timeposition', (time) => {
      this.playbackState.currentTime = time;
      this.sendToRenderer('playback-time-update', time);
    });

    this.mpvPlayer.on('duration', (duration) => {
      this.playbackState.duration = duration;
      this.sendToRenderer('playback-duration-update', duration);
    });

    this.mpvPlayer.on('pause', () => {
      this.playbackState.playing = false;
      this.sendToRenderer('playback-state-change', { playing: false });
    });

    this.mpvPlayer.on('unpause', () => {
      this.playbackState.playing = true;
      this.sendToRenderer('playback-state-change', { playing: true });
    });

    this.mpvPlayer.on('seek', (position) => {
      this.sendToRenderer('playback-seek', position);
    });
  }

  setupEventListeners() {
    // File operations
    ipcMain.handle('open-video-file', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openFile'],
        filters: [
          {
            name: 'Video Files',
            extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm'],
          },
        ],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        return await this.loadVideo(result.filePaths[0]);
      }
      return null;
    });

    ipcMain.handle('open-subtitle-file', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Subtitle Files', extensions: ['srt', 'vtt', 'ass'] },
        ],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        return await this.loadSubtitles(result.filePaths);
      }
      return null;
    });

    // Playback controls
    ipcMain.handle('play-pause', () => this.togglePlayback());
    ipcMain.handle('seek', (event, position) => this.seek(position));
    ipcMain.handle('set-volume', (event, volume) => this.setVolume(volume));
    // ipcMain.handle('get-playback-state', () => this.playbackState);
    ipcMain.handle('get-playback-state', () => {
      console.log('get-playback-state called - returning dummy data');
      return {
        playing: false,
        currentTime: 0,
        duration: 0,
        volume: 100,
      };
    });
    // Drag and drop
    ipcMain.handle('handle-file-drop', async (event, filePaths) => {
      return await this.handleFilesDrop(filePaths);
    });
    ipcMain.handle('set-speed', (event, speed) => this.setSpeed(speed));
    ipcMain.handle('validate-current-files', () => this.validateCurrentFiles());
    // Rust module test handlers
    ipcMain.handle('rust-hello', () => {
      if (nativeModule) {
        return nativeModule.helloFromRust();
      }
      return 'Rust module not available';
    });

    ipcMain.handle('rust-system-info', () => {
      if (nativeModule) {
        return nativeModule.getSystemInfo();
      }
      return 'Rust module not available';
    });
    ////////////////////
    // Media control handlers (will call Rust functions)
    ipcMain.handle('media-play-pause', async () => {
      if (nativeModule && nativeModule.mediaPlayPause) {
        return await nativeModule.mediaPlayPause();
      }
      // Fallback to existing MPV for now
      return this.togglePlayback();
    });

    ipcMain.handle('media-seek', async (event, position) => {
      if (nativeModule && nativeModule.mediaSeek) {
        return await nativeModule.mediaSeek(position);
      }
      return this.seek(position);
    });

    ipcMain.handle('media-load-video', async (event, filePath) => {
      if (nativeModule && nativeModule.mediaLoadVideo) {
        return await nativeModule.mediaLoadVideo(filePath);
      }
      return this.loadVideo(filePath);
    });

    ipcMain.handle('media-get-state', () => {
      if (nativeModule && nativeModule.mediaGetState) {
        return nativeModule.mediaGetState();
      }
      return this.playbackState;
    });
  }
  async validateCurrentFiles() {
    const results = {
      currentVideo: null,
      subtitles: [],
      issues: [],
    };

    // Validate current video
    if (this.currentVideo) {
      const validation = await this.validateFile(this.currentVideo);
      results.currentVideo = validation;
      if (!validation.valid) {
        results.issues.push(`Video file issue: ${validation.error}`);
      }
    }

    // Validate subtitle files
    for (const subtitle of this.subtitleTracks) {
      const validation = await this.validateFile(subtitle.filePath);
      results.subtitles.push({
        id: subtitle.id,
        name: subtitle.name,
        validation,
      });
      if (!validation.valid) {
        results.issues.push(`Subtitle '${subtitle.name}': ${validation.error}`);
      }
    }

    return results;
  }
  startFileMonitoring() {
    // Check file integrity every 30 seconds during playback
    this.fileMonitorInterval = setInterval(async () => {
      if (this.playbackState.playing && this.currentVideo) {
        const validation = await this.validateFile(this.currentVideo);
        if (!validation.valid) {
          this.handleFileIssue(this.currentVideo, validation.error);
        }
      }
    }, 30000);
  }

  stopFileMonitoring() {
    if (this.fileMonitorInterval) {
      clearInterval(this.fileMonitorInterval);
      this.fileMonitorInterval = null;
    }
  }

  handleFileIssue(filePath, error) {
    console.error(`File issue detected: ${filePath} - ${error}`);

    // Pause playback
    this.mpvPlayer.pause();

    // Notify renderer
    this.sendToRenderer('file-issue', {
      filePath,
      error,
      timestamp: new Date(),
    });
  }
  async validateFile(filePath) {
    const cached = this.fileValidationCache.get(filePath);
    const now = new Date();

    // Use cache if recent (within 30 seconds)
    if (cached && now - cached.validatedAt < 30000) {
      return cached;
    }

    const validation = await this.validateAndTrackFile(filePath);

    // Cache validation result
    this.fileValidationCache.set(filePath, {
      ...validation,
      validatedAt: now,
    });

    return validation;
  }
  async loadVideo(filePath) {
    try {
      // Security: Validate file path (prevent directory traversal)
      const resolvedPath = path.resolve(filePath);
      if (!this.isPathAllowed(resolvedPath)) {
        throw new Error('File path not allowed');
      }
      // Validate file exists and get metadata
      const fileInfo = await this.validateAndTrackFile(filePath);
      if (!fileInfo.valid) {
        throw new Error(`File validation failed: ${fileInfo.error}`);
      }
      if (!this.mpvPlayer) {
        throw new Error('MPV not initialized');
      }

      await this.mpvPlayer.load(filePath);
      this.currentVideo = filePath;

      // Get video properties
      const duration = await this.mpvPlayer.getDuration();
      this.playbackState.duration = duration;

      // Update file tracking
      this.watchedFiles.set(filePath, {
        ...fileInfo.metadata,
        loadedAt: new Date(),
        duration,
      });
      console.log(`Loaded video: ${filePath}`);
      return {
        success: true,
        filePath,
        duration,
        fileInfo: fileInfo.metadata,
      };
    } catch (error) {
      console.error('Error loading video:', error);
      // Clean up on failure
      if (this.watchedFiles.has(filePath)) {
        this.watchedFiles.delete(filePath);
      }
      return { success: false, error: error.message };
    }
  }

  async loadSubtitles(filePaths) {
    const loadedSubs = [];

    for (const filePath of filePaths) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const parsed = this.parseSubtitleFile(content, filePath);

        const subtitle = {
          id: Date.now() + Math.random(),
          filePath,
          name: path.basename(filePath),
          content: parsed,
          enabled: true,
        };

        this.subtitleTracks.push(subtitle);
        loadedSubs.push(subtitle);
      } catch (error) {
        console.error(`Error loading subtitle ${filePath}:`, error);
      }
    }

    this.sendToRenderer('subtitles-loaded', loadedSubs);
    return loadedSubs;
  }

  parseSubtitleFile(content, filePath) {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.srt') {
      return this.parseSRT(content);
    }
    // Add other formats as needed
    return [];
  }

  parseSRT(content) {
    const blocks = content.trim().split(/\n\s*\n/);
    const subtitles = [];

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length >= 3) {
        const timeMatch = lines[1].match(
          /(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/
        );

        if (timeMatch) {
          const startTime = this.timeToSeconds(
            timeMatch[1],
            timeMatch[2],
            timeMatch[3],
            timeMatch[4]
          );
          const endTime = this.timeToSeconds(
            timeMatch[5],
            timeMatch[6],
            timeMatch[7],
            timeMatch[8]
          );
          const text = lines.slice(2).join('\n');

          subtitles.push({
            start: startTime,
            end: endTime,
            text: text,
          });
        }
      }
    }

    return subtitles;
  }

  timeToSeconds(hours, minutes, seconds, milliseconds) {
    return (
      parseInt(hours) * 3600 +
      parseInt(minutes) * 60 +
      parseInt(seconds) +
      parseInt(milliseconds) / 1000
    );
  }

  async togglePlayback() {
    if (!this.mpvPlayer || !this.currentVideo) return false;

    try {
      if (this.playbackState.playing) {
        await this.mpvPlayer.pause();
      } else {
        await this.mpvPlayer.unpause();
      }
      return true;
    } catch (error) {
      console.error('Error toggling playback:', error);
      return false;
    }
  }

  async seek(position) {
    if (!this.mpvPlayer) return false;

    try {
      await this.mpvPlayer.seek(position);
      return true;
    } catch (error) {
      console.error('Error seeking:', error);
      return false;
    }
  }

  async setVolume(volume) {
    if (!this.mpvPlayer) return false;

    try {
      await this.mpvPlayer.volume(volume);
      this.playbackState.volume = volume;
      return true;
    } catch (error) {
      console.error('Error setting volume:', error);
      return false;
    }
  }

  async handleFilesDrop(filePaths) {
    const results = { videos: [], subtitles: [] };

    for (const filePath of filePaths) {
      const ext = path.extname(filePath).toLowerCase();

      if (['.mp4', '.mkv', '.avi', '.mov', '.webm'].includes(ext)) {
        if (!this.currentVideo) {
          const result = await this.loadVideo(filePath);
          if (result.success) {
            results.videos.push(result);
          }
        }
      } else if (['.srt', '.vtt', '.ass'].includes(ext)) {
        const subs = await this.loadSubtitles([filePath]);
        results.subtitles.push(...subs);
      }
    }

    return results;
  }
  async setSpeed(speed) {
    if (!this.mpvPlayer) return false;
    try {
      await this.mpvPlayer.property('speed', speed);
      this.playbackState.speed = speed;
      this.sendToRenderer('playback-speed-change', speed);
      return true;
    } catch (error) {
      console.error('Error setting speed:', error);
      return false;
    }
  }
  async validateAndTrackFile(filePath) {
    try {
      // Check if file exists
      const exists = await fs.pathExists(filePath);
      if (!exists) {
        return { valid: false, error: 'File does not exist' };
      }

      // Get file stats
      const stats = await fs.stat(filePath);

      // Security: Check file size (prevent loading huge files accidentally)
      const maxSize = 50 * 1024 * 1024 * 1024; // 50GB limit
      if (stats.size > maxSize) {
        return { valid: false, error: 'File too large' };
      }

      // Validate file extension
      const ext = path.extname(filePath).toLowerCase();
      const allowedExtensions = [
        '.mp4',
        '.mkv',
        '.avi',
        '.mov',
        '.webm',
        '.m4v',
        '.flv',
      ];
      if (!allowedExtensions.includes(ext)) {
        return { valid: false, error: 'Unsupported file format' };
      }

      // Create file fingerprint for integrity checking
      const metadata = {
        path: filePath,
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
        extension: ext,
        fingerprint: this.createFileFingerprint(stats),
        validatedAt: new Date(),
      };

      return { valid: true, metadata };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  createFileFingerprint(stats) {
    // Create a simple fingerprint without reading file contents
    return `${stats.size}-${stats.mtime.getTime()}`;
  }

  isPathAllowed(filePath) {
    // Security: Prevent directory traversal and system file access
    const normalized = path.normalize(filePath);

    // Block system directories
    const blockedPaths = [
      '/System/',
      '/usr/bin/',
      '/etc/',
      'C:\\Windows\\',
      'C:\\Program Files\\',
    ];

    return !blockedPaths.some((blocked) => normalized.startsWith(blocked));
  }
  sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  async cleanup() {
    // Stop file monitoring
    this.stopFileMonitoring();
    // Clear caches (privacy-focused)
    this.watchedFiles.clear();
    this.fileValidationCache.clear();
    if (this.mpvPlayer) {
      try {
        await this.mpvPlayer.quit();
      } catch (error) {
        console.error('Error cleaning up MPV:', error);
      }
    }
    // Clear any temporary state
    this.currentVideo = null;
    this.subtitleTracks = [];
  }
}

// Initialize the app
const mediaPlayer = new MediaPlayerApp();

app.whenReady().then(() => {
  mediaPlayer.createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mediaPlayer.createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  mediaPlayer.cleanup();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  mediaPlayer.cleanup();
});
