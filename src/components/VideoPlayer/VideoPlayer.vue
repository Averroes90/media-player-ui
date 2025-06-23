<template>
  <v-container fluid class="pa-0">
    <div class="media-player-container" ref="playerContainer">
      <!-- Video Display Area (MPV renders here) -->
      <div 
        class="video-display"
        @drop="handleDrop"
        @dragover.prevent
        @dragenter.prevent
      >
        <!-- Subtitle Overlay -->
        <SubtitleOverlay 
          :subtitles="subtitleTracks"
          :current-time="playbackState.currentTime"
          :video-dimensions="videoDimensions"
        />
        
        <!-- Loading State -->
        <div v-if="loading" class="loading-overlay">
          <v-progress-circular indeterminate size="64" />
          <p class="mt-4">Loading video...</p>
        </div>

        <!-- Drop Zone -->
        <div v-if="!currentVideo" class="drop-zone">
          <v-icon size="64" class="mb-4">mdi-video-plus</v-icon>
          <h3>Drop video files here</h3>
          <p class="text-medium-emphasis">or click to browse</p>
          <v-btn @click="openVideoFile" variant="outlined" class="mt-4">
            Browse Files
          </v-btn>
        </div>
      </div>

      <!-- Controls -->
      <MediaControls
        :playback-state="playbackState"
        :subtitle-tracks="subtitleTracks"
        @play-pause="togglePlayback"
        @seek="seek"
        @volume-change="setVolume"
        @open-video="openVideoFile"
        @open-subtitles="openSubtitleFile"
        @toggle-subtitle="toggleSubtitle"
      />
    </div>
  </v-container>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import SubtitleOverlay from './SubtitleOverlay.vue';
import MediaControls from './MediaControls.vue';

// Reactive state
const loading = ref(false);
const currentVideo = ref(null);
const subtitleTracks = ref([]);
const videoDimensions = reactive({ width: 0, height: 0 });

const playbackState = reactive({
  playing: false,
  currentTime: 0,
  duration: 0,
  volume: 100
});

// Refs
const playerContainer = ref(null);

// Event listener cleanup functions
let cleanupFunctions = [];

onMounted(async () => {
  await initializePlayer();
  setupEventListeners();
});

onUnmounted(() => {
  cleanupEventListeners();
});

async function initializePlayer() {
  try {
    const state = await window.electronAPI.getPlaybackState();
    Object.assign(playbackState, state);
  } catch (error) {
    console.error('Failed to initialize player:', error);
  }
}

function setupEventListeners() {
  // Playback events
  const timeUpdateCleanup = window.electronAPI.onPlaybackTimeUpdate((event, time) => {
    playbackState.currentTime = time;
  });
  
  const durationUpdateCleanup = window.electronAPI.onPlaybackDurationUpdate((event, duration) => {
    playbackState.duration = duration;
  });
  
  const stateChangeCleanup = window.electronAPI.onPlaybackStateChange((event, state) => {
    Object.assign(playbackState, state);
  });
  
  const subtitlesLoadedCleanup = window.electronAPI.onSubtitlesLoaded((event, subs) => {
    subtitleTracks.value.push(...subs);
  });

  cleanupFunctions.push(
    timeUpdateCleanup,
    durationUpdateCleanup,
    stateChangeCleanup,
    subtitlesLoadedCleanup
  );
}

function cleanupEventListeners() {
  cleanupFunctions.forEach(cleanup => cleanup());
  cleanupFunctions = [];
}

async function openVideoFile() {
  loading.value = true;
  try {
    const result = await window.electronAPI.openVideoFile();
    if (result && result.success) {
      currentVideo.value = result.filePath;
      playbackState.duration = result.duration;
    }
  } catch (error) {
    console.error('Error opening video file:', error);
  } finally {
    loading.value = false;
  }
}

async function openSubtitleFile() {
  try {
    const result = await window.electronAPI.openSubtitleFile();
    if (result && result.length > 0) {
      subtitleTracks.value.push(...result);
    }
  } catch (error) {
    console.error('Error opening subtitle file:', error);
  }
}

async function togglePlayback() {
  try {
    await window.electronAPI.playPause();
  } catch (error) {
    console.error('Error toggling playback:', error);
  }
}

async function seek(position) {
  try {
    await window.electronAPI.seek(position);
  } catch (error) {
    console.error('Error seeking:', error);
  }
}

async function setVolume(volume) {
  try {
    await window.electronAPI.setVolume(volume);
    playbackState.volume = volume;
  } catch (error) {
    console.error('Error setting volume:', error);
  }
}

function toggleSubtitle(subtitleId) {
  const subtitle = subtitleTracks.value.find(s => s.id === subtitleId);
  if (subtitle) {
    subtitle.enabled = !subtitle.enabled;
  }
}

async function handleDrop(event) {
  event.preventDefault();
  const files = Array.from(event.dataTransfer.files);
  const filePaths = files.map(file => file.path);
  
  try {
    loading.value = true;
    const result = await window.electronAPI.handleFileDrop(filePaths);
    
    if (result.videos.length > 0) {
      currentVideo.value = result.videos[0].filePath;
      playbackState.duration = result.videos[0].duration;
    }
    
    if (result.subtitles.length > 0) {
      subtitleTracks.value.push(...result.subtitles);
    }
  } catch (error) {
    console.error('Error handling dropped files:', error);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.media-player-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.video-display {
  flex: 1;
  position: relative;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drop-zone {
  text-align: center;
  color: rgba(255, 255, 255, 0.7);
  padding: 2rem;
}

.loading-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: white;
}
</style>