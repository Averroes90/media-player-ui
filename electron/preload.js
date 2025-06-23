const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  openVideoFile: () => ipcRenderer.invoke('open-video-file'),
  openSubtitleFile: () => ipcRenderer.invoke('open-subtitle-file'),
  handleFileDrop: (filePaths) => ipcRenderer.invoke('handle-file-drop', filePaths),

  // Playback controls
  playPause: () => ipcRenderer.invoke('play-pause'),
  seek: (position) => ipcRenderer.invoke('seek', position),
  setVolume: (volume) => ipcRenderer.invoke('set-volume', volume),
  getPlaybackState: () => ipcRenderer.invoke('get-playback-state'),

  // Event listeners
  onPlaybackTimeUpdate: (callback) => {
    ipcRenderer.on('playback-time-update', callback);
    return () => ipcRenderer.removeListener('playback-time-update', callback);
  },
  
  onPlaybackDurationUpdate: (callback) => {
    ipcRenderer.on('playback-duration-update', callback);
    return () => ipcRenderer.removeListener('playback-duration-update', callback);
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
  }
});