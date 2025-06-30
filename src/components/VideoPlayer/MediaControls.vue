<template>
  <div class="media-controls">
    <!-- Progress Bar -->
    <div class="progress-container">
      <v-slider
        v-model="seekPosition"
        :max="playbackState.duration"
        :min="0"
        @update:model-value="handleSeek"
        @mousedown="seeking = true"
        @mouseup="seeking = false"
        class="progress-slider"
        color="primary"
        track-color="rgba(255,255,255,0.3)"
        thumb-color="primary"
        hide-details
      />
      <div class="time-display">
        <span>{{ formatTime(playbackState.currentTime) }}</span>
        <span>{{ formatTime(playbackState.duration) }}</span>
      </div>
    </div>

    <!-- Main Controls -->
    <div class="main-controls">
      <!-- Left Controls -->
      <div class="left-controls">
        <v-btn
          icon
          @click="$emit('play-pause')"
          size="large"
          variant="text"
          color="white"
        >
          <v-icon size="32">
            {{ playbackState.playing ? 'mdi-pause' : 'mdi-play' }}
          </v-icon>
        </v-btn>

        <div class="volume-control">
          <v-btn
            icon
            @click="toggleMute"
            variant="text"
            color="white"
          >
            <v-icon>{{ volumeIcon }}</v-icon>
          </v-btn>
          <v-slider
            v-model="volume"
            :max="100"
            :min="0"
            @update:model-value="handleVolumeChange"
            class="volume-slider"
            color="white"
            track-color="rgba(255,255,255,0.3)"
            thumb-color="white"
            hide-details
          />
        </div>
        <SpeedControl 
  :speed="playbackState.speed || 1.0"
  @speed-change="handleSpeedChange"
/>
      </div>

      <!-- Right Controls -->
      <div class="right-controls">
        <!-- Subtitle Controls -->
        <v-menu offset-y>
          <template v-slot:activator="{ props }">
            <v-btn
              icon
              v-bind="props"
              variant="text"
              color="white"
            >
              <v-icon>mdi-subtitles</v-icon>
            </v-btn>
          </template>
          <v-list>
            <v-list-item
              v-for="subtitle in subtitleTracks"
              :key="subtitle.id"
              @click="$emit('toggle-subtitle', subtitle.id)"
            >
              <template v-slot:prepend>
                <v-checkbox
                  :model-value="subtitle.enabled"
                  @click.stop
                  @update:model-value="$emit('toggle-subtitle', subtitle.id)"
                />
              </template>
              <v-list-item-title>{{ subtitle.name }}</v-list-item-title>
            </v-list-item>
            <v-divider />
            <v-list-item @click="$emit('open-subtitles')">
              <template v-slot:prepend>
                <v-icon>mdi-plus</v-icon>
              </template>
              <v-list-item-title>Add Subtitles</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>

        <!-- File Menu -->
        <v-menu offset-y>
          <template v-slot:activator="{ props }">
            <v-btn
              icon
              v-bind="props"
              variant="text"
              color="white"
            >
              <v-icon>mdi-folder-open</v-icon>
            </v-btn>
          </template>
          <v-list>
            <v-list-item @click="$emit('open-video')">
              <template v-slot:prepend>
                <v-icon>mdi-video</v-icon>
              </template>
              <v-list-item-title>Open Video</v-list-item-title>
            </v-list-item>
            <v-list-item @click="$emit('open-subtitles')">
              <template v-slot:prepend>
                <v-icon>mdi-subtitles</v-icon>
              </template>
              <v-list-item-title>Open Subtitles</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import SpeedControl from './SpeedControl.vue'
const props = defineProps({
  playbackState: {
    type: Object,
    required: true
  },
  subtitleTracks: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'play-pause',
  'seek',
  'volume-change',
  'open-video',
  'open-subtitles',
  'toggle-subtitle',
  'speed-change'
])

// Local state
const seeking = ref(false)
const volume = ref(100)
const muted = ref(false)
const previousVolume = ref(100)

// Computed
const seekPosition = computed({
  get() {
    return seeking.value ? seekPosition.value : props.playbackState.currentTime
  },
  set(value) {
    if (seeking.value) {
      seekPosition._value = value
    }
  }
})

const volumeIcon = computed(() => {
  if (muted.value || volume.value === 0) return 'mdi-volume-off'
  if (volume.value < 50) return 'mdi-volume-low'
  return 'mdi-volume-high'
})

// Watch for volume changes from parent
watch(() => props.playbackState.volume, (newVolume) => {
  if (!seeking.value) {
    volume.value = newVolume
  }
})

// Methods
function handleSeek(value) {
  if (seeking.value) {
    emit('seek', value)
  }
}

function handleVolumeChange(value) {
  volume.value = value
  muted.value = value === 0
  emit('volume-change', value)
}
function handleSpeedChange(speed) {
  emit('speed-change', speed)
}

function toggleMute() {
  if (muted.value) {
    volume.value = previousVolume.value
    muted.value = false
  } else {
    previousVolume.value = volume.value
    volume.value = 0
    muted.value = true
  }
  emit('volume-change', volume.value)
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
</script>
<style scoped>
.media-controls {
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  padding: 16px;
  color: white;
}

.progress-container {
  margin-bottom: 16px;
}

.progress-slider {
  margin-bottom: 8px;
}

.time-display {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  padding: 0 12px;
}

.main-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.left-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
}

.volume-slider {
  width: 80px;
}

.right-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .volume-control {
    min-width: 80px;
  }
  
  .volume-slider {
    width: 60px;
  }
  
  .left-controls {
    gap: 8px;
  }
}
</style>