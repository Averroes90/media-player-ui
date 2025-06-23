<template>
  <div class="subtitle-overlay">
    <div 
      v-for="subtitle in activeSubtitles" 
      :key="`${subtitle.trackId}-${subtitle.index}`"
      class="subtitle-text"
      :style="getSubtitleStyle(subtitle)"
    >
      <div class="subtitle-content" v-html="formatSubtitleText(subtitle.text)"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  subtitles: {
    type: Array,
    default: () => []
  },
  currentTime: {
    type: Number,
    default: 0
  },
  videoDimensions: {
    type: Object,
    default: () => ({ width: 0, height: 0 })
  }
})

// Find currently active subtitles
const activeSubtitles = computed(() => {
  const active = []
  
  props.subtitles.forEach((track, trackIndex) => {
    if (!track.enabled) return
    
    track.content.forEach((subtitle, index) => {
      if (props.currentTime >= subtitle.start && props.currentTime <= subtitle.end) {
        active.push({
          ...subtitle,
          trackId: track.id,
          trackIndex,
          index,
          trackName: track.name
        })
      }
    })
  })
  
  return active
})

function getSubtitleStyle(subtitle) {
  // Position subtitles vertically based on track index
  const bottomOffset = 60 + (subtitle.trackIndex * 60) // Stack multiple subtitle tracks
  
  return {
    bottom: `${bottomOffset}px`,
    // You can add more styling options here
    zIndex: 10 + subtitle.trackIndex
  }
}

function formatSubtitleText(text) {
  // Basic HTML formatting for subtitles
  return text
    .replace(/\n/g, '<br>')
    .replace(/<i>(.*?)<\/i>/g, '<em>$1</em>')
    .replace(/<b>(.*?)<\/b>/g, '<strong>$1</strong>')
    .replace(/\{[^}]*\}/g, '') // Remove subtitle formatting tags like {pos(x,y)}
}
</script>

<style scoped>
.subtitle-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 10;
}

.subtitle-text {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  max-width: 80%;
}

.subtitle-content {
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 18px;
  font-weight: 500;
  line-height: 1.4;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  display: inline-block;
}

/* Multiple subtitle tracks styling */
.subtitle-text:nth-child(1) .subtitle-content {
  background: rgba(0, 0, 0, 0.8);
  border-left: 3px solid #2196f3;
}

.subtitle-text:nth-child(2) .subtitle-content {
  background: rgba(76, 175, 80, 0.8);
  border-left: 3px solid #4caf50;
}

.subtitle-text:nth-child(3) .subtitle-content {
  background: rgba(255, 152, 0, 0.8);
  border-left: 3px solid #ff9800;
}

/* Responsive font sizing */
@media (max-width: 768px) {
  .subtitle-content {
    font-size: 16px;
    padding: 6px 12px;
  }
}

@media (max-width: 480px) {
  .subtitle-content {
    font-size: 14px;
    padding: 4px 8px;
  }
}
</style>