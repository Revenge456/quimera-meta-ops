<script setup lang="ts">
type ManagerLevel = 'campaigns' | 'ad-sets' | 'ads';

const props = defineProps<{
  modelValue: ManagerLevel;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: ManagerLevel];
}>();

const levels: Array<{ value: ManagerLevel; label: string; hint: string }> = [
  { value: 'campaigns', label: 'Campaigns', hint: 'Vision de estrategia y estructura' },
  { value: 'ad-sets', label: 'Ad Sets', hint: 'Segmentacion y entrega' },
  { value: 'ads', label: 'Ads', hint: 'Creativos y anuncios finales' },
];
</script>

<template>
  <div class="grid gap-3 md:grid-cols-3">
    <button
      v-for="level in levels"
      :key="level.value"
      class="level-card text-left"
      :class="{ 'level-card-active': props.modelValue === level.value }"
      @click="emit('update:modelValue', level.value)"
    >
      <p class="font-mono text-[11px] uppercase tracking-[0.3em] text-[color:var(--muted)]">
        Nivel
      </p>
      <h3 class="mt-3 text-xl font-semibold">{{ level.label }}</h3>
      <p class="mt-2 text-sm text-[color:var(--muted)]">
        {{ level.hint }}
      </p>
    </button>
  </div>
</template>
