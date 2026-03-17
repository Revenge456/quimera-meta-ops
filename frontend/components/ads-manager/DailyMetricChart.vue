<script setup lang="ts">
type ChartRow = {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  landingPageViews: number;
  results: number | null;
  purchases: number;
  purchaseValue: number;
};

const props = defineProps<{
  rows: ChartRow[];
  metric: keyof ChartRow;
}>();

const chartValues = computed(() =>
  props.rows.map((row) => ({
    date: row.date,
    value: typeof row[props.metric] === 'number' ? Number(row[props.metric]) : 0,
  })),
);

const maxValue = computed(() =>
  Math.max(...chartValues.value.map((row) => row.value), 0),
);

const points = computed(() => {
  if (chartValues.value.length === 0) {
    return '';
  }

  return chartValues.value
    .map((row, index) => {
      const x =
        chartValues.value.length === 1
          ? 290
          : 24 + (index * 532) / (chartValues.value.length - 1);
      const y =
        maxValue.value === 0 ? 156 : 156 - (row.value / maxValue.value) * 120;
      return `${x},${y}`;
    })
    .join(' ');
});

const areaPoints = computed(() => {
  if (!points.value) {
    return '';
  }

  return `24,156 ${points.value} 556,156`;
});
</script>

<template>
  <div class="chart-shell">
    <div class="mb-3 flex items-center justify-between">
      <p class="font-mono text-[11px] uppercase tracking-[0.3em] text-[color:var(--muted)]">
        Serie diaria
      </p>
      <p class="text-xs text-[color:var(--muted)]">
        {{ rows.length }} dias
      </p>
    </div>

    <div v-if="rows.length === 0" class="chart-empty">
      No hay datos diarios para este rango.
    </div>

    <svg v-else viewBox="0 0 580 190" class="h-52 w-full">
      <defs>
        <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(14,116,144,0.34)" />
          <stop offset="100%" stop-color="rgba(14,116,144,0.02)" />
        </linearGradient>
      </defs>

      <line x1="24" y1="156" x2="556" y2="156" stroke="rgba(110,98,86,0.25)" />
      <line x1="24" y1="96" x2="556" y2="96" stroke="rgba(110,98,86,0.1)" />
      <line x1="24" y1="36" x2="556" y2="36" stroke="rgba(110,98,86,0.08)" />

      <polygon :points="areaPoints" fill="url(#chartFill)" />
      <polyline
        :points="points"
        fill="none"
        stroke="var(--accent)"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="3"
      />

      <circle
        v-for="(row, index) in chartValues"
        :key="`${row.date}-${index}`"
        :cx="chartValues.length === 1 ? 290 : 24 + (index * 532) / (chartValues.length - 1)"
        :cy="maxValue === 0 ? 156 : 156 - (row.value / maxValue) * 120"
        r="4"
        fill="var(--accent)"
      />
    </svg>

    <div v-if="rows.length > 0" class="mt-4 flex items-center justify-between gap-4 text-xs text-[color:var(--muted)]">
      <span>{{ rows[0]?.date }}</span>
      <span>Pico: {{ maxValue.toLocaleString('es-PE') }}</span>
      <span>{{ rows.at(-1)?.date }}</span>
    </div>
  </div>
</template>
