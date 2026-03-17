<script setup lang="ts">
type HistoryEngine = 'strategist' | 'advisor';

type HistoryRow = {
  id: string;
  executive_summary: string;
  generated_at: string;
  level: 'campaign' | 'ad_set' | 'ad';
  exact_context_match?: boolean;
  strategist_analysis_id?: string | null;
};

defineProps<{
  ready: boolean;
  clientName?: string | null;
  levelLabel: string;
  dateFrom: string;
  dateTo: string;
  strategistExactRows: HistoryRow[];
  strategistSimilarRows: HistoryRow[];
  advisorExactRows: HistoryRow[];
  advisorSimilarRows: HistoryRow[];
  strategistPending?: boolean;
  advisorPending?: boolean;
  strategistRunning?: boolean;
  advisorRunning?: boolean;
  hasCurrentContextHash?: boolean;
  lastStrategistId?: string | null;
  lastAdvisorId?: string | null;
  errorMessage?: string | null;
}>();

const emit = defineEmits<{
  runStrategist: [];
  runAdvisorFresh: [];
  runAdvisorFromStrategist: [];
  openHistory: [engine: HistoryEngine];
  openHistoryRecord: [payload: { engine: HistoryEngine; id: string }];
}>();

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
</script>

<template>
  <section class="panel p-5">
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p class="font-mono text-[11px] uppercase tracking-[0.3em] text-[color:var(--muted)]">
            Workflow IA
          </p>
          <h2 class="mt-3 text-2xl font-semibold">Strategist + Advisor</h2>
          <p class="mt-2 text-sm text-[color:var(--muted)]">
            Usa el contexto operativo actual para disparar analisis, revisar salidas recientes y saltar al historial relacionado.
          </p>
        </div>

        <button class="btn-secondary px-4 py-2 text-xs" @click="emit('openHistory', 'strategist')">
          Abrir historial IA
        </button>
      </div>

      <div class="rounded-3xl border border-[color:var(--line)] bg-white/70 p-4">
        <div class="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <p class="font-mono text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
              Cliente
            </p>
            <p class="mt-2 font-medium">{{ clientName || 'Selecciona un cliente para habilitar IA' }}</p>
          </div>
          <div>
            <p class="font-mono text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
              Contexto
            </p>
            <p class="mt-2 font-medium">{{ levelLabel }} · {{ dateFrom }} a {{ dateTo }}</p>
          </div>
        </div>
      </div>

      <div
        v-if="errorMessage"
        class="rounded-3xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        {{ errorMessage }}
      </div>

      <div class="grid gap-3 md:grid-cols-3">
        <button
          class="btn-primary w-full"
          :disabled="!ready || strategistRunning"
          @click="emit('runStrategist')"
        >
          {{ strategistRunning ? 'Analizando...' : 'Analizar contexto' }}
        </button>

        <button
          class="btn-secondary w-full"
          :disabled="!ready || advisorRunning"
          @click="emit('runAdvisorFresh')"
        >
          {{ advisorRunning ? 'Generando...' : 'Advisor nuevo' }}
        </button>

        <button
          class="btn-secondary w-full"
          :disabled="!ready || advisorRunning || (strategistExactRows.length === 0 && strategistSimilarRows.length === 0)"
          @click="emit('runAdvisorFromStrategist')"
        >
          Advisor desde strategist reciente
        </button>
      </div>

      <p class="text-xs text-[color:var(--muted)]">
        Exact match usa el mismo `context_hash`. Contexto similar mantiene el fallback por cliente, nivel y rango.
        <span v-if="hasCurrentContextHash">
          Si existe exact match, el advisory reutiliza ese strategist antes que cualquier similar.
        </span>
      </p>

      <div class="grid gap-4 xl:grid-cols-2">
        <article class="rounded-3xl border border-[color:var(--line)] bg-white/70 p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="font-mono text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Ads Strategist
              </p>
              <p class="mt-2 text-sm text-[color:var(--muted)]">
                Priorizado por contexto exacto y luego por contexto similar.
              </p>
            </div>

            <button
              class="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]"
              @click="emit('openHistory', 'strategist')"
            >
              Ver todo
            </button>
          </div>

          <div v-if="strategistPending" class="mt-4 text-sm text-[color:var(--muted)]">
            Cargando strategist...
          </div>

          <div
            v-else-if="strategistExactRows.length === 0 && strategistSimilarRows.length === 0"
            class="mt-4 text-sm text-[color:var(--muted)]"
          >
            No hay analisis recientes para este contexto.
          </div>

          <div v-else class="mt-4 space-y-4">
            <div>
              <div class="mb-3 flex items-center justify-between gap-3">
                <p class="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Exact match</p>
                <span class="text-xs text-[color:var(--muted)]">{{ strategistExactRows.length }}</span>
              </div>

              <div v-if="strategistExactRows.length === 0" class="text-sm text-[color:var(--muted)]">
                No hay strategist con hash exacto para este contexto.
              </div>

              <div v-else class="space-y-3">
                <button
                  v-for="item in strategistExactRows"
                  :key="item.id"
                  type="button"
                  class="archive-list-item w-full rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-left"
                  @click="emit('openHistoryRecord', { engine: 'strategist', id: item.id })"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="text-sm font-semibold">{{ item.executive_summary }}</p>
                      <p class="mt-2 text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        {{ item.level }} · {{ formatGeneratedAt(item.generated_at) }}
                      </p>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                      <span class="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        Exact match
                      </span>
                      <span
                        v-if="lastStrategistId === item.id"
                        class="rounded-full bg-stone-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
                      >
                        Nuevo
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <div class="mb-3 flex items-center justify-between gap-3">
                <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">Contexto similar</p>
                <span class="text-xs text-[color:var(--muted)]">{{ strategistSimilarRows.length }}</span>
              </div>

              <div v-if="strategistSimilarRows.length === 0" class="text-sm text-[color:var(--muted)]">
                No hay strategist similares para este rango.
              </div>

              <div v-else class="space-y-3">
                <button
                  v-for="item in strategistSimilarRows"
                  :key="item.id"
                  type="button"
                  class="archive-list-item w-full rounded-2xl border border-[color:var(--line)] px-4 py-3 text-left"
                  @click="emit('openHistoryRecord', { engine: 'strategist', id: item.id })"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="text-sm font-semibold">{{ item.executive_summary }}</p>
                      <p class="mt-2 text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        {{ item.level }} · {{ formatGeneratedAt(item.generated_at) }}
                      </p>
                    </div>
                    <span class="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700">
                      Similar
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </article>

        <article class="rounded-3xl border border-[color:var(--line)] bg-white/70 p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="font-mono text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Commercial Advisor
              </p>
              <p class="mt-2 text-sm text-[color:var(--muted)]">
                Advisory separados por exact match y contexto similar.
              </p>
            </div>

            <button
              class="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]"
              @click="emit('openHistory', 'advisor')"
            >
              Ver todo
            </button>
          </div>

          <div v-if="advisorPending" class="mt-4 text-sm text-[color:var(--muted)]">
            Cargando advisory...
          </div>

          <div
            v-else-if="advisorExactRows.length === 0 && advisorSimilarRows.length === 0"
            class="mt-4 text-sm text-[color:var(--muted)]"
          >
            No hay advisory recientes para este contexto.
          </div>

          <div v-else class="mt-4 space-y-4">
            <div>
              <div class="mb-3 flex items-center justify-between gap-3">
                <p class="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Exact match</p>
                <span class="text-xs text-[color:var(--muted)]">{{ advisorExactRows.length }}</span>
              </div>

              <div v-if="advisorExactRows.length === 0" class="text-sm text-[color:var(--muted)]">
                No hay advisory exactos para este contexto.
              </div>

              <div v-else class="space-y-3">
                <button
                  v-for="item in advisorExactRows"
                  :key="item.id"
                  type="button"
                  class="archive-list-item w-full rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-left"
                  @click="emit('openHistoryRecord', { engine: 'advisor', id: item.id })"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="text-sm font-semibold">{{ item.executive_summary }}</p>
                      <p class="mt-2 text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        {{ item.level }} · {{ formatGeneratedAt(item.generated_at) }}
                      </p>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                      <span class="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        Exact match
                      </span>
                      <span
                        v-if="lastAdvisorId === item.id"
                        class="rounded-full bg-stone-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
                      >
                        Nuevo
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <div class="mb-3 flex items-center justify-between gap-3">
                <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">Contexto similar</p>
                <span class="text-xs text-[color:var(--muted)]">{{ advisorSimilarRows.length }}</span>
              </div>

              <div v-if="advisorSimilarRows.length === 0" class="text-sm text-[color:var(--muted)]">
                No hay advisory similares para este rango.
              </div>

              <div v-else class="space-y-3">
                <button
                  v-for="item in advisorSimilarRows"
                  :key="item.id"
                  type="button"
                  class="archive-list-item w-full rounded-2xl border border-[color:var(--line)] px-4 py-3 text-left"
                  @click="emit('openHistoryRecord', { engine: 'advisor', id: item.id })"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="text-sm font-semibold">{{ item.executive_summary }}</p>
                      <p class="mt-2 text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        {{ item.level }} · {{ formatGeneratedAt(item.generated_at) }}
                      </p>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                      <span class="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-700">
                        Similar
                      </span>
                      <span
                        v-if="item.strategist_analysis_id"
                        class="rounded-full bg-stone-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
                      >
                        Con strategist
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
