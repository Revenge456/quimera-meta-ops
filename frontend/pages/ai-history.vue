<script setup lang="ts">
type HistoryEngine = 'strategist' | 'advisor';
type AnalysisLevel = 'campaign' | 'ad_set' | 'ad';

type HistoryMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
};

type ClientOption = {
  id: string;
  nombre: string;
  empresa: string;
};

type StrategistHistorySummary = {
  id: string;
  client: ClientOption;
  generated_by: {
    id: string;
    nombre: string;
    email: string;
  } | null;
  level: AnalysisLevel;
  date_from: string;
  date_to: string;
  generated_at: string;
  filters: Record<string, string | undefined>;
  context_hash: string | null;
  exact_context_match?: boolean;
  executive_summary: string;
  entities_analyzed: number;
};

type CommercialAdvisorHistorySummary = {
  id: string;
  client: ClientOption;
  generated_by: {
    id: string;
    nombre: string;
    email: string;
  } | null;
  level: AnalysisLevel;
  date_from: string;
  date_to: string;
  generated_at: string;
  filters: Record<string, string | undefined>;
  context_hash: string | null;
  exact_context_match?: boolean;
  executive_summary: string;
  client_ready_summary: string;
  strategist_analysis_id: string | null;
};

type StrategistHistoryDetail = StrategistHistorySummary & {
  context_snapshot: {
    entities_total?: number;
    entities_analyzed?: number;
  } | null;
  output: {
    key_findings: string[];
    entity_analysis: Array<{
      entity_id: string;
      entity_name: string;
      classification: string;
      confidence: string;
      reasoning: string;
      detected_issues: string[];
      opportunities: string[];
      recommended_actions: string[];
    }>;
    global_recommendations: string[];
    risks_detected: string[];
    next_tests: string[];
    client_summary: string;
  };
};

type CommercialAdvisorHistoryDetail = CommercialAdvisorHistorySummary & {
  strategist_output_snapshot: {
    executive_summary: string;
  } | null;
  output: {
    performance_explanation: string;
    decision_justifications: Array<{
      entity_id: string;
      entity_name: string;
      classification: string;
      justification: string;
    }>;
    objection_handling: {
      performance: string;
      budget: string;
    };
    additional_commercial_opportunity: string;
    next_phase_recommendation: string;
    agency_positioning_narrative: string;
    client_talking_points: string[];
    client_ready_summary: string;
  };
};

type HistoryListResponse = {
  data: Array<StrategistHistorySummary | CommercialAdvisorHistorySummary>;
  meta: HistoryMeta;
};

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
    level: AnalysisLevel;
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

type FiltersState = {
  engine: HistoryEngine;
  clientId: string;
  level: '' | AnalysisLevel;
  dateFrom: string;
  dateTo: string;
  generatedFrom: string;
  generatedTo: string;
  contextHash: string;
  page: number;
  pageSize: number;
};

const api = useApi();
const route = useRoute();

function getQueryValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function parseEngine(value: string): HistoryEngine {
  return value === 'advisor' ? 'advisor' : 'strategist';
}

function parseLevel(value: string): '' | AnalysisLevel {
  return value === 'campaign' || value === 'ad_set' || value === 'ad' ? value : '';
}

function parsePositiveNumber(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const draft = reactive<FiltersState>({
  engine: parseEngine(getQueryValue(route.query.engine)),
  clientId: getQueryValue(route.query.clientId),
  level: parseLevel(getQueryValue(route.query.level)),
  dateFrom: getQueryValue(route.query.dateFrom),
  dateTo: getQueryValue(route.query.dateTo),
  generatedFrom: getQueryValue(route.query.generatedFrom),
  generatedTo: getQueryValue(route.query.generatedTo),
  contextHash: getQueryValue(route.query.contextHash),
  page: parsePositiveNumber(getQueryValue(route.query.page), 1),
  pageSize: parsePositiveNumber(getQueryValue(route.query.pageSize), 10),
});

const applied = reactive<FiltersState>({ ...draft });
const selectedId = ref<string | null>(getQueryValue(route.query.id) || null);
const comparison = ref<ComparisonResponse | null>(null);
const comparisonPending = ref(false);
const comparisonError = ref<string | null>(null);
const manualPreviousId = ref('');

const { data: clients } = await useAsyncData<ClientOption[]>(
  'ai-history-clients',
  () => api('/clients'),
);

const historyBase = computed(() =>
  applied.engine === 'strategist' ? '/ai-strategist/history' : '/commercial-advisor/history',
);

const currentQuery = computed(() => ({
  ...(applied.clientId ? { clientId: applied.clientId } : {}),
  ...(applied.level ? { level: applied.level } : {}),
  ...(applied.dateFrom ? { dateFrom: applied.dateFrom } : {}),
  ...(applied.dateTo ? { dateTo: applied.dateTo } : {}),
  ...(applied.generatedFrom ? { generatedFrom: applied.generatedFrom } : {}),
  ...(applied.generatedTo ? { generatedTo: applied.generatedTo } : {}),
  ...(applied.contextHash ? { contextHash: applied.contextHash } : {}),
  page: applied.page,
  pageSize: applied.pageSize,
}));

const listKey = computed(() =>
  JSON.stringify({
    endpoint: historyBase.value,
    query: currentQuery.value,
  }),
);

const {
  data: listResponse,
  pending: listPending,
  refresh,
} = await useAsyncData<HistoryListResponse>(
  () => `ai-history:${listKey.value}`,
  () =>
    api(historyBase.value, {
      query: currentQuery.value,
    }),
  {
    watch: [listKey],
    default: () => ({
      data: [],
      meta: {
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 1,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
    }),
  },
);

const rows = computed(() => listResponse.value?.data ?? []);
const listMeta = computed(() => listResponse.value?.meta);

watch(
  rows,
  (nextRows) => {
    if (!nextRows || nextRows.length === 0) {
      selectedId.value = null;
      return;
    }

    if (!selectedId.value || !nextRows.some((row) => row.id === selectedId.value)) {
      selectedId.value = nextRows[0]?.id ?? null;
    }
  },
  { immediate: true },
);

const detailKey = computed(() =>
  selectedId.value
    ? JSON.stringify({
        endpoint: historyBase.value,
        id: selectedId.value,
      })
    : null,
);

const { data: selectedDetail, pending: detailPending } = await useAsyncData<
  StrategistHistoryDetail | CommercialAdvisorHistoryDetail | null
>(
  () => `ai-history-detail:${detailKey.value ?? 'empty'}`,
  () =>
    selectedId.value
      ? api(`${historyBase.value}/${selectedId.value}`)
      : null,
  {
    watch: [detailKey],
    default: () => null,
  },
);

const visibleDetail = computed(() =>
  selectedId.value ? selectedDetail.value : null,
);

const strategistRows = computed(
  () => (applied.engine === 'strategist' ? (rows.value as StrategistHistorySummary[]) : []),
);

const comparisonPreviousOptions = computed(() =>
  strategistRows.value.filter((row) => row.id !== selectedId.value),
);

function syncFromRouteQuery() {
  draft.engine = parseEngine(getQueryValue(route.query.engine));
  draft.clientId = getQueryValue(route.query.clientId);
  draft.level = parseLevel(getQueryValue(route.query.level));
  draft.dateFrom = getQueryValue(route.query.dateFrom);
  draft.dateTo = getQueryValue(route.query.dateTo);
  draft.generatedFrom = getQueryValue(route.query.generatedFrom);
  draft.generatedTo = getQueryValue(route.query.generatedTo);
  draft.contextHash = getQueryValue(route.query.contextHash);
  draft.page = parsePositiveNumber(getQueryValue(route.query.page), 1);
  draft.pageSize = parsePositiveNumber(getQueryValue(route.query.pageSize), 10);

  applied.engine = draft.engine;
  applied.clientId = draft.clientId;
  applied.level = draft.level;
  applied.dateFrom = draft.dateFrom;
  applied.dateTo = draft.dateTo;
  applied.generatedFrom = draft.generatedFrom;
  applied.generatedTo = draft.generatedTo;
  applied.contextHash = draft.contextHash;
  applied.page = draft.page;
  applied.pageSize = draft.pageSize;
  selectedId.value = getQueryValue(route.query.id) || null;
}

watch(
  () => route.fullPath,
  () => {
    syncFromRouteQuery();
  },
);

function applyFilters() {
  if (
    draft.clientId !== applied.clientId ||
    draft.level !== applied.level ||
    draft.dateFrom !== applied.dateFrom ||
    draft.dateTo !== applied.dateTo
  ) {
    draft.contextHash = '';
  }

  applied.engine = draft.engine;
  applied.clientId = draft.clientId;
  applied.level = draft.level;
  applied.dateFrom = draft.dateFrom;
  applied.dateTo = draft.dateTo;
  applied.generatedFrom = draft.generatedFrom;
  applied.generatedTo = draft.generatedTo;
  applied.contextHash = draft.contextHash;
  applied.page = draft.page;
  applied.pageSize = draft.pageSize;
  selectedId.value = null;
  comparison.value = null;
  comparisonError.value = null;
  manualPreviousId.value = '';
  refresh();
}

function applyAndResetPage() {
  draft.page = 1;
  applyFilters();
}

function onEngineChange(engine: HistoryEngine) {
  draft.engine = engine;
  draft.page = 1;
  selectedId.value = null;
  comparison.value = null;
  comparisonError.value = null;
  manualPreviousId.value = '';
  applyFilters();
}

function selectRow(row: StrategistHistorySummary | CommercialAdvisorHistorySummary) {
  selectedId.value = row.id;
}

function goToPage(page: number) {
  draft.page = page;
  applyFilters();
}

watch(
  [selectedId, () => applied.engine, comparisonPreviousOptions],
  () => {
    comparison.value = null;
    comparisonError.value = null;

    if (comparisonPreviousOptions.value.length === 0) {
      manualPreviousId.value = '';
      return;
    }

    if (
      !manualPreviousId.value ||
      !comparisonPreviousOptions.value.some((item) => item.id === manualPreviousId.value)
    ) {
      manualPreviousId.value = comparisonPreviousOptions.value[0]?.id ?? '';
    }
  },
  { immediate: true },
);

async function runComparison(previousAnalysisId?: string) {
  if (applied.engine !== 'strategist' || !selectedId.value) {
    return;
  }

  comparisonPending.value = true;
  comparisonError.value = null;

  try {
    comparison.value = await api('/ai-strategist/compare', {
      method: 'POST',
      body: {
        currentAnalysisId: selectedId.value,
        ...(previousAnalysisId ? { previousAnalysisId } : {}),
        ...(visibleDetail.value && 'context_hash' in visibleDetail.value && visibleDetail.value.context_hash
          ? { contextHash: visibleDetail.value.context_hash }
          : {}),
      },
    });
  } catch (error: any) {
    comparisonError.value =
      error?.data?.message ?? 'No pudimos comparar este analisis con una referencia previa.';
  } finally {
    comparisonPending.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <section class="panel hero-panel p-6 lg:p-8">
      <div class="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div class="max-w-4xl">
          <p class="font-mono text-[11px] uppercase tracking-[0.35em] text-[color:var(--muted)]">
            Trazabilidad IA
          </p>
          <h1 class="mt-4 text-4xl font-semibold md:text-5xl">
            Intelligence Archive
          </h1>
          <p class="mt-4 max-w-3xl text-base text-[color:var(--muted)] md:text-lg">
            Archivo operativo para revisar analisis estrategicos y advisory comerciales ya generados,
            sin volver a invocar el LLM cada vez.
          </p>
        </div>

        <div class="editorial-note max-w-sm">
          <p class="font-mono text-[11px] uppercase tracking-[0.3em] text-[color:var(--muted)]">
            Lectura backend-only
          </p>
          <p class="mt-3 text-sm">
            Esta vista consume solo historial persistido desde backend y respeta el alcance real de cada usuario.
          </p>
        </div>
      </div>
    </section>

    <AiHistoryEngineTabs :model-value="draft.engine" @update:model-value="onEngineChange" />

    <section class="panel p-6">
      <div class="grid gap-3 lg:grid-cols-[1.1fr_0.8fr_1fr_1fr_1fr_1fr_auto]">
        <select v-model="draft.clientId" class="field">
          <option value="">Todos los clientes</option>
          <option v-for="client in clients ?? []" :key="client.id" :value="client.id">
            {{ client.nombre }} - {{ client.empresa }}
          </option>
        </select>

        <select v-model="draft.level" class="field">
          <option value="">Todos los niveles</option>
          <option value="campaign">Campaign</option>
          <option value="ad_set">Ad Set</option>
          <option value="ad">Ad</option>
        </select>

        <input v-model="draft.dateFrom" class="field" type="date" />
        <input v-model="draft.dateTo" class="field" type="date" />
        <input v-model="draft.generatedFrom" class="field" type="date" />
        <input v-model="draft.generatedTo" class="field" type="date" />

        <button class="btn-primary" @click="applyAndResetPage">
          Aplicar
        </button>
      </div>

      <p v-if="applied.contextHash" class="mt-4 text-xs text-[color:var(--muted)]">
        Priorizando exact match para el `context_hash` recibido desde el contexto operativo actual.
      </p>
    </section>

    <section class="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div class="space-y-6">
        <AiHistoryHistoryTable
          :engine="applied.engine"
          :rows="rows"
          :meta="listMeta"
          :pending="listPending"
          :has-context-hash="Boolean(applied.contextHash)"
          :selected-id="selectedId"
          @select="selectRow"
        />

        <section class="panel p-4">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div class="text-sm text-[color:var(--muted)]">
              Pagina {{ listMeta?.page ?? 1 }} de {{ listMeta?.totalPages ?? 1 }}
            </div>

            <div class="flex items-center gap-3">
              <select v-model="draft.pageSize" class="field min-w-[120px]" @change="applyAndResetPage">
                <option :value="10">10 / pagina</option>
                <option :value="25">25 / pagina</option>
                <option :value="50">50 / pagina</option>
              </select>

              <button
                class="btn-secondary px-4 py-2 text-xs"
                :disabled="(listMeta?.page ?? 1) <= 1"
                @click="goToPage(Math.max(1, (listMeta?.page ?? 1) - 1))"
              >
                Anterior
              </button>

              <button
                class="btn-secondary px-4 py-2 text-xs"
                :disabled="(listMeta?.page ?? 1) >= (listMeta?.totalPages ?? 1)"
                @click="goToPage(Math.min((listMeta?.totalPages ?? 1), (listMeta?.page ?? 1) + 1))"
              >
                Siguiente
              </button>
            </div>
          </div>
        </section>
      </div>

      <div class="space-y-6">
        <AiHistoryDetailPanel
          :engine="applied.engine"
          :detail="visibleDetail"
          :has-context-hash="Boolean(applied.contextHash)"
          :pending="detailPending"
        />

        <AiHistoryComparisonPanel
          :enabled="applied.engine === 'strategist' && Boolean(selectedId)"
          :pending="comparisonPending"
          :error="comparisonError"
          :comparison="comparison"
          :manual-previous-id="manualPreviousId"
          :previous-options="comparisonPreviousOptions"
          @compare-auto="runComparison()"
          @compare-manual="runComparison(manualPreviousId)"
          @update:manual-previous-id="manualPreviousId = $event"
        />
      </div>
    </section>
  </div>
</template>
