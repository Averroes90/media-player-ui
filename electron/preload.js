const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  openVideoFile: () => ipcRenderer.invoke('open-video-file'),
  openSubtitleFile: () => ipcRenderer.invoke('open-subtitle-file'),
  handleFileDrop: (filePaths) =>
    ipcRenderer.invoke('handle-file-drop', filePaths),
  validateCurrentFiles: () => ipcRenderer.invoke('validate-current-files'),
  // Playback controls
  playPause: () => ipcRenderer.invoke('play-pause'),
  seek: (position) => ipcRenderer.invoke('seek', position),
  setVolume: (volume) => ipcRenderer.invoke('set-volume', volume),
  getPlaybackState: () => ipcRenderer.invoke('get-playback-state'),
  setSpeed: (speed) => ipcRenderer.invoke('set-speed', speed),
  // Event listeners
  onPlaybackTimeUpdate: (callback) => {
    ipcRenderer.on('playback-time-update', callback);
    return () => ipcRenderer.removeListener('playback-time-update', callback);
  },

  onPlaybackDurationUpdate: (callback) => {
    ipcRenderer.on('playback-duration-update', callback);
    return () =>
      ipcRenderer.removeListener('playback-duration-update', callback);
  },

  onPlaybackStateChange: (callback) => {
    ipcRenderer.on('playback-state-change', callback);
    return () => ipcRenderer.removeListener('playback-state-change', callback);
  },

  onPlaybackSeek: (callback) => {
    ipcRenderer.on('playback-seek', callback);
    return () => ipcRenderer.removeListener('playback-seek', callback);
  },

  onSubtitlesLoaded: (callback) => {
    ipcRenderer.on('subtitles-loaded', callback);
    return () => ipcRenderer.removeListener('subtitles-loaded', callback);
  },
  onPlaybackSpeedChange: (callback) => {
    ipcRenderer.on('playback-speed-change', callback);
    return () => ipcRenderer.removeListener('playback-speed-change', callback);
  },
  onFileIssue: (callback) => {
    ipcRenderer.on('file-issue', callback);
    return () => ipcRenderer.removeListener('file-issue', callback);
  },
});
contextBridge.exposeInMainWorld('nativeAPI', {
  // Test functions
  helloFromRust: () => ipcRenderer.invoke('rust-hello'),
  getSystemInfo: () => ipcRenderer.invoke('rust-system-info'),
});
contextBridge.exposeInMainWorld('mediaAPI', {
  // Playback control
  playPause: () => ipcRenderer.invoke('media-play-pause'),
  seek: (position) => ipcRenderer.invoke('media-seek', position),
  setVolume: (volume) => ipcRenderer.invoke('media-set-volume', volume),
  setSpeed: (speed) => ipcRenderer.invoke('media-set-speed', speed),

  // File operations
  loadVideo: (filePath) => ipcRenderer.invoke('media-load-video', filePath),
  getPlaybackState: () => ipcRenderer.invoke('media-get-state'),

  // Event listeners for real-time updates
  onTimeUpdate: (callback) => ipcRenderer.on('playback-time-update', callback),
  onStateChange: (callback) =>
    ipcRenderer.on('playback-state-change', callback),
  onDurationUpdate: (callback) =>
    ipcRenderer.on('playback-duration-update', callback),
});
