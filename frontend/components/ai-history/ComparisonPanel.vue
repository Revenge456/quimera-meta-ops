<script setup lang="ts">
type ComparisonResponse = {
  comparison_basis: {
    current_analysis_id: string;
    previous_analysis_id: string | null;
    match_type: 'EXACT_MATCH' | 'CONTEXT_SIMILAR' | 'NO_PREVIOUS';
    context_hash: string | null;
  };
  summary: string;
  key_changes: string[];
  entity_differences: Array<{
    entity_id: string;
    entity_name: string;
    level: 'campaign' | 'ad_set' | 'ad';
    previous_classification: string | null;
    current_classification: string;
    change_type: 'IMPROVED' | 'WORSENED' | 'STABLE' | 'NEW' | 'REMOVED';
    metric_deltas: {
      spend?: number;
      ctr?: number | null;
      cpc?: number | null;
      roas?: number | null;
      results?: number | null;
    };
    insight: string;
  }>;
  improvements: string[];
  deteriorations: string[];
  new_opportunities: string[];
  risks_detected: string[];
  recommended_actions: string[];
};

type PreviousOption = {
  id: string;
  executive_summary: string;
  generated_at: string;
};

defineProps<{
  enabled: boolean;
  pending?: boolean;
  error?: string | null;
  comparison: ComparisonResponse | null;
  manualPreviousId: string;
  previousOptions: PreviousOption[];
}>();

const emit = defineEmits<{
  compareAuto: [];
  compareManual: [];
  'update:manualPreviousId': [value: string];
}>();

function badgeClass(changeType: ComparisonResponse['entity_differences'][number]['change_type']) {
  switch (changeType) {
    case 'IMPROVED':
      return 'bg-emerald-100 text-emerald-700';
    case 'WORSENED':
      return 'bg-rose-100 text-rose-700';
    case 'NEW':
      return 'bg-sky-100 text-sky-700';
    case 'REMOVED':
      return 'bg-stone-200 text-stone-700';
    default:
      return 'bg-stone-100 text-stone-700';
  }
}

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDelta(value?: number | null) {
  if (value == null) {
    return 'n/d';
  }

  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}
</script>

<template>
  <section class="panel p-5">
    <div class="flex flex-col gap-4">
      <div>
        <p class="font-mono text-[11px] uppercase tracking-[0.3em] text-[color:var(--muted)]">
          AI Comparison
        </p>
        <h2 class="mt-3 text-2xl font-semibold">Change detection</h2>
        <p class="mt-2 text-sm text-[color:var(--muted)]">
          Compara el strategist actual contra una referencia previa para detectar mejoras, deterioros y cambios accionables.
        </p>
      </div>

      <div v-if="!enabled" class="rounded-3xl border border-[color:var(--line)] bg-white/70 px-4 py-4 text-sm text-[color:var(--muted)]">
        Selecciona un analisis de Ads Strategist para habilitar la comparacion temporal.
      </div>

      <template v-else>
        <div
          v-if="comparison?.comparison_basis.match_type === 'EXACT_MATCH'"
          class="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Exact match: la referencia previa corresponde al mismo `context_hash` del analisis actual.
        </div>

        <div
          v-else-if="comparison?.comparison_basis.match_type === 'CONTEXT_SIMILAR'"
          class="rounded-3xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Contexto similar: no habia exact match disponible y se uso el analisis previo mas reciente del mismo cliente y nivel.
        </div>

        <div
          v-else-if="comparison?.comparison_basis.match_type === 'NO_PREVIOUS'"
          class="rounded-3xl border border-[color:var(--line)] bg-white/70 px-4 py-3 text-sm text-[color:var(--muted)]"
        >
          No hay analisis previo compatible para comparar este strategist.
        </div>

        <div class="grid gap-3 lg:grid-cols-[auto_1fr_auto]">
          <button
            class="btn-primary px-4 py-2 text-sm"
            :disabled="pending"
            @click="emit('compareAuto')"
          >
            {{ pending ? 'Comparando...' : 'Comparar con anterior' }}
          </button>

          <select
            :value="manualPreviousId"
            class="field"
            @change="emit('update:manualPreviousId', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">Selecciona una referencia manual</option>
            <option v-for="option in previousOptions" :key="option.id" :value="option.id">
              {{ formatGeneratedAt(option.generated_at) }} · {{ option.executive_summary }}
            </option>
          </select>

          <button
            class="btn-secondary px-4 py-2 text-sm"
            :disabled="pending || !manualPreviousId"
            @click="emit('compareManual')"
          >
            Comparar seleccion
          </button>
        </div>

        <div
          v-if="error"
          class="rounded-3xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {{ error }}
        </div>

        <div
          v-if="comparison"
          class="space-y-5"
        >
          <div class="archive-section">
            <p class="archive-section-title">Resumen</p>
            <p class="mt-3 text-sm text-[color:var(--muted)]">
              {{ comparison.summary }}
            </p>
          </div>

          <div class="grid gap-4 xl:grid-cols-2">
            <div class="archive-section">
              <p class="archive-section-title">Cambios clave</p>
              <ul class="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                <li v-for="item in comparison.key_changes" :key="item">- {{ item }}</li>
              </ul>
            </div>

            <div class="archive-section">
              <p class="archive-section-title">Acciones recomendadas</p>
              <ul class="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                <li v-for="item in comparison.recommended_actions" :key="item">- {{ item }}</li>
              </ul>
            </div>
          </div>

          <div class="grid gap-4 xl:grid-cols-3">
            <div class="archive-section">
              <p class="archive-section-title">Mejoras</p>
              <ul class="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                <li v-for="item in comparison.improvements" :key="item">- {{ item }}</li>
              </ul>
            </div>
            <div class="archive-section">
              <p class="archive-section-title">Deterioros</p>
              <ul class="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                <li v-for="item in comparison.deteriorations" :key="item">- {{ item }}</li>
              </ul>
            </div>
            <div class="archive-section">
              <p class="archive-section-title">Oportunidades nuevas</p>
              <ul class="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                <li v-for="item in comparison.new_opportunities" :key="item">- {{ item }}</li>
              </ul>
            </div>
          </div>

          <div class="grid gap-4 xl:grid-cols-2">
            <div class="archive-section">
              <p class="archive-section-title">Riesgos detectados</p>
              <ul class="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                <li v-for="item in comparison.risks_detected" :key="item">- {{ item }}</li>
              </ul>
            </div>

            <div class="archive-section">
              <p class="archive-section-title">Entidades con cambios</p>
              <div class="mt-4 space-y-4">
                <article
                  v-for="item in comparison.entity_differences"
                  :key="item.entity_id"
                  class="archive-summary"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="meta-chip" :class="badgeClass(item.change_type)">
                      {{ item.change_type }}
                    </span>
                    <span class="meta-chip">
                      {{ item.previous_classification ?? 'sin previo' }} -> {{ item.current_classification }}
                    </span>
                  </div>

                  <h3 class="mt-3 text-lg font-semibold">{{ item.entity_name }}</h3>
                  <p class="mt-2 text-sm text-[color:var(--muted)]">
                    {{ item.insight }}
                  </p>

                  <p
                    v-if="item.change_type === 'REMOVED'"
                    class="mt-3 rounded-2xl border border-stone-300 bg-stone-100 px-3 py-2 text-sm text-stone-700"
                  >
                    Esta entidad ya no esta presente en el analisis actual.
                  </p>

                  <div class="mt-4 grid gap-2 md:grid-cols-5">
                    <div class="archive-kpi">
                      <p class="archive-kpi-label">Spend</p>
                      <p class="archive-kpi-value text-sm">{{ formatDelta(item.metric_deltas.spend) }}</p>
                    </div>
                    <div class="archive-kpi">
                      <p class="archive-kpi-label">CTR</p>
                      <p class="archive-kpi-value text-sm">{{ formatDelta(item.metric_deltas.ctr) }}</p>
                    </div>
                    <div class="archive-kpi">
                      <p class="archive-kpi-label">CPC</p>
                      <p class="archive-kpi-value text-sm">{{ formatDelta(item.metric_deltas.cpc) }}</p>
                    </div>
                    <div class="archive-kpi">
                      <p class="archive-kpi-label">ROAS</p>
                      <p class="archive-kpi-value text-sm">{{ formatDelta(item.metric_deltas.roas) }}</p>
                    </div>
                    <div class="archive-kpi">
                      <p class="archive-kpi-label">Results</p>
                      <p class="archive-kpi-value text-sm">{{ formatDelta(item.metric_deltas.results) }}</p>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>
