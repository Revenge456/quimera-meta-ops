<script setup lang="ts">
type HistoryEngine = 'strategist' | 'advisor';

const props = defineProps<{
  modelValue: HistoryEngine;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: HistoryEngine];
}>();

const options: Array<{
  value: HistoryEngine;
  label: string;
  eyebrow: string;
  description: string;
}> = [
  {
    value: 'strategist',
    label: 'Ads Strategist',
    eyebrow: 'Analisis tecnico',
    description: 'Clasificacion, riesgos, oportunidades y decisiones por entidad.',
  },
  {
    value: 'advisor',
    label: 'Commercial Advisor',
    eyebrow: 'Narrativa comercial',
    description: 'Traduccion ejecutiva y comercial del criterio tecnico para el cliente.',
  },
];
</script>

<template>
  <section class="grid gap-4 lg:grid-cols-2">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="archive-tab text-left"
      :class="{ 'archive-tab-active': props.modelValue === option.value }"
      @click="emit('update:modelValue', option.value)"
    >
      <p class="font-mono text-[11px] uppercase tracking-[0.3em] text-[color:var(--muted)]">
        {{ option.eyebrow }}
      </p>
      <h2 class="mt-3 text-2xl font-semibold">
        {{ option.label }}
      </h2>
      <p class="mt-3 text-sm text-[color:var(--muted)]">
        {{ option.description }}
      </p>
    </button>
  </section>
</template>
