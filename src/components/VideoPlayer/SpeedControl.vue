<template>
  <div class="speed-control">
    <!-- Speed Indicator/Reset Button -->
    <v-btn
      :class="{ 'speed-modified': currentSpeed !== 1.0 }"
      @click="resetSpeed"
      variant="text"
      color="white"
      size="small"
      class="speed-indicator"
    >
      <v-icon size="16" class="mr-1">mdi-speedometer</v-icon>
      {{ formatSpeed(currentSpeed) }}
    </v-btn>

    <!-- Speed Selection Menu -->
    <v-menu offset-y>
      <template v-slot:activator="{ props }">
        <v-btn
          icon
          v-bind="props"
          variant="text"
          color="white"
          size="small"
        >
          <v-icon size="18">mdi-chevron-up</v-icon>
        </v-btn>
      </template>
      
      <v-list density="compact" class="speed-menu">
        <!-- Preset Speeds -->
        <v-list-subheader>Presets</v-list-subheader>
        <v-list-item 
          v-for="speed in speedPresets"
          :key="speed"
          @click="changeSpeed(speed)"
          :class="{ 'active-speed': currentSpeed === speed }"
        >
          <template v-slot:prepend>
            <v-icon v-if="currentSpeed === speed" size="16">
              mdi-check
            </v-icon>
            <div v-else style="width: 16px;"></div>
          </template>
          <v-list-item-title>{{ formatSpeed(speed) }}</v-list-item-title>
          <template v-slot:append>
            <span class="speed-description">{{ getSpeedDescription(speed) }}</span>
          </template>
        </v-list-item>

        <v-divider class="my-2" />

        <!-- Custom Speed Input -->
        <v-list-item>
          <v-text-field
            v-model="customSpeedInput"
            @keyup.enter="setCustomSpeed"
            @blur="setCustomSpeed"
            label="Custom"
            suffix="x"
            density="compact"
            hide-details
            variant="outlined"
            style="max-width: 100px;"
          />
        </v-list-item>

        <v-divider class="my-2" />

        <!-- Quick Actions -->
        <v-list-item @click="stepSpeed(-0.25)" :disabled="currentSpeed <= 0.25">
          <template v-slot:prepend>
            <v-icon size="16">mdi-minus</v-icon>
          </template>
          <v-list-item-title>Slower (-0.25x)</v-list-item-title>
        </v-list-item>
        
        <v-list-item @click="stepSpeed(0.25)" :disabled="currentSpeed >= 3.0">
          <template v-slot:prepend>
            <v-icon size="16">mdi-plus</v-icon>
          </template>
          <v-list-item-title>Faster (+0.25x)</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  speed: {
    type: Number,
    default: 1.0
  }
})

const emit = defineEmits(['speed-change'])

// Local state
const customSpeedInput = ref('')
const currentSpeed = ref(props.speed)

// Speed presets
const speedPresets = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0]

// Watch for external speed changes
watch(() => props.speed, (newSpeed) => {
  currentSpeed.value = newSpeed
})

// Methods
function changeSpeed(speed) {
  currentSpeed.value = speed
  emit('speed-change', speed)
}

function resetSpeed() {
  changeSpeed(1.0)
}

function stepSpeed(increment) {
  const newSpeed = Math.max(0.25, Math.min(3.0, currentSpeed.value + increment))
  const roundedSpeed = Math.round(newSpeed * 4) / 4 // Round to nearest 0.25
  changeSpeed(roundedSpeed)
}

function setCustomSpeed() {
  const speed = parseFloat(customSpeedInput.value)
  if (speed && speed >= 0.1 && speed <= 5.0) {
    changeSpeed(speed)
  }
  customSpeedInput.value = ''
}

function formatSpeed(speed) {
  // Format speed nicely (1.0 → "1x", 1.25 → "1.25x")
  return speed === 1.0 ? '1x' : `${speed}x`
}

function getSpeedDescription(speed) {
  const descriptions = {
    0.25: 'Very Slow',
    0.5: 'Half Speed',
    0.75: 'Slow',
    1.0: 'Normal',
    1.25: 'Fast',
    1.5: 'Faster',
    1.75: 'Very Fast',
    2.0: 'Double',
    2.5: 'Ultra Fast',
    3.0: 'Maximum'
  }
  return descriptions[speed] || ''
}
</script>

<style scoped>
.speed-control {
  display: flex;
  align-items: center;
  gap: 2px;
}

.speed-indicator {
  font-size: 12px;
  font-weight: 500;
  min-width: 50px;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.speed-modified {
  background: rgba(33, 150, 243, 0.2);
  color: #2196f3 !important;
}

.speed-indicator:hover {
  background: rgba(255, 255, 255, 0.1);
}

.speed-menu {
  min-width: 180px;
}

.active-speed {
  background: rgba(33, 150, 243, 0.1);
  color: #2196f3;
}

.speed-description {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  margin-left: 8px;
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .speed-control {
    gap: 1px;
  }
  
  .speed-indicator {
    min-width: 45px;
    font-size: 11px;
  }
}
</style>