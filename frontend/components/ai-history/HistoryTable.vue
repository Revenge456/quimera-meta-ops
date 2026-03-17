<script setup lang="ts">
type HistoryEngine = 'strategist' | 'advisor';

type HistoryMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
};

type BaseHistoryRow = {
  id: string;
  client: {
    id: string;
    nombre: string;
    empresa: string;
  };
  generated_by: {
    id: string;
    nombre: string;
    email: string;
  } | null;
  level: 'campaign' | 'ad_set' | 'ad';
  date_from: string;
  date_to: string;
  generated_at: string;
  executive_summary: string;
  exact_context_match?: boolean;
};

type StrategistRow = BaseHistoryRow & {
  entities_analyzed: number;
};

type AdvisorRow = BaseHistoryRow & {
  client_ready_summary: string;
  strategist_analysis_id: string | null;
};

const props = defineProps<{
  engine: HistoryEngine;
  rows: Array<StrategistRow | AdvisorRow>;
  meta?: HistoryMeta | null;
  pending?: boolean;
  hasContextHash?: boolean;
  selectedId?: string | null;
}>();

const emit = defineEmits<{
  select: [row: StrategistRow | AdvisorRow];
}>();

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function levelLabel(level: BaseHistoryRow['level']) {
  if (level === 'campaign') {
    return 'Campaign';
  }

  if (level === 'ad_set') {
    return 'Ad Set';
  }

  return 'Ad';
}

function secondarySummary(row: StrategistRow | AdvisorRow) {
  if (props.engine === 'strategist') {
    return `${(row as StrategistRow).entities_analyzed} entidades analizadas`;
  }

  return (row as AdvisorRow).client_ready_summary;
}
</script>

<template>
  <section class="panel overflow-hidden">
    <div class="border-b border-[color:var(--line)] px-5 py-4">
      <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p class="font-mono text-[11px] uppercase tracking-[0.3em] text-[color:var(--muted)]">
            Historial consultable
          </p>
          <p class="mt-2 text-sm text-[color:var(--muted)]">
            {{ meta?.total ?? rows.length }} registros disponibles, ordenados por generacion reciente.
          </p>
        </div>

        <div class="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {{ meta?.page ?? 1 }}/{{ meta?.totalPages ?? 1 }}
        </div>
      </div>
    </div>

    <div v-if="pending" class="px-5 py-10 text-sm text-[color:var(--muted)]">
      Cargando historial...
    </div>

    <div v-else-if="rows.length === 0" class="px-5 py-10 text-sm text-[color:var(--muted)]">
      No hay registros con los filtros actuales.
    </div>

    <div v-else class="divide-y divide-[color:var(--line)]">
      <button
        v-for="row in rows"
        :key="row.id"
        type="button"
        class="archive-list-item w-full text-left"
        :class="{ 'archive-list-item-active': selectedId === row.id }"
        @click="emit('select', row)"
      >
        <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="meta-chip">{{ levelLabel(row.level) }}</span>
              <span class="meta-chip">
                {{ row.client.nombre }} · {{ row.client.empresa }}
              </span>
              <span
                v-if="hasContextHash"
                class="meta-chip"
                :class="row.exact_context_match ? 'bg-emerald-100 text-emerald-700' : ''"
              >
                {{ row.exact_context_match ? 'Exact match' : 'Similar' }}
              </span>
              <span
                v-if="engine === 'advisor' && (row as AdvisorRow).strategist_analysis_id"
                class="meta-chip"
              >
                Link strategist
              </span>
            </div>

            <h3 class="mt-4 text-xl font-semibold">
              {{ row.executive_summary }}
            </h3>

            <p class="mt-3 text-sm text-[color:var(--muted)]">
              {{ secondarySummary(row) }}
            </p>
          </div>

          <div class="shrink-0 text-right text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
            <p>{{ formatGeneratedAt(row.generated_at) }}</p>
            <p class="mt-2">{{ row.date_from }} -> {{ row.date_to }}</p>
            <p class="mt-2">
              {{ row.generated_by?.nombre ?? 'Sistema' }}
            </p>
          </div>
        </div>
      </button>
    </div>
  </section>
</template>
