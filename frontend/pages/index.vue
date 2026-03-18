<script setup lang="ts">
import { buildAnalysisContextHash } from '../utils/analysisContext';

type ManagerLevel = 'campaigns' | 'ad-sets' | 'ads';
type AnalysisLevel = 'campaign' | 'ad_set' | 'ad';

type FiltersState = {
  level: ManagerLevel;
  clienteId: string;
  status: string;
  search: string;
  dateFrom: string;
  dateTo: string;
  campaignId: string;
  adSetId: string;
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
};

type ClientOption = {
  id: string;
  nombre: string;
  empresa: string;
};

type HistorySummary = {
  id: string;
  executive_summary: string;
  generated_at: string;
  level: AnalysisLevel;
  context_hash?: string | null;
  exact_context_match?: boolean;
  strategist_analysis_id?: string | null;
};

type HistoryResponse = {
  data: HistorySummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
};

type ListResponse = {
  data: any[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
};

const api = useApi();
const route = useRoute();

function getQueryValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function parseLevel(value: string): ManagerLevel {
  if (value === 'ad-sets' || value === 'ads' || value === 'campaigns') {
    return value;
  }

  return 'campaigns';
}

function parsePositiveNumber(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

const today = new Date();
const defaultFrom = new Date();
defaultFrom.setDate(today.getDate() - 13);

const draft = reactive<FiltersState>({
  level: parseLevel(getQueryValue(route.query.level)),
  clienteId: getQueryValue(route.query.clienteId),
  status: getQueryValue(route.query.status),
  search: getQueryValue(route.query.search),
  dateFrom: getQueryValue(route.query.dateFrom) || formatDate(defaultFrom),
  dateTo: getQueryValue(route.query.dateTo) || formatDate(today),
  campaignId: getQueryValue(route.query.campaignId),
  adSetId: getQueryValue(route.query.adSetId),
  page: parsePositiveNumber(getQueryValue(route.query.page), 1),
  pageSize: parsePositiveNumber(getQueryValue(route.query.pageSize), 25),
  sortBy: getQueryValue(route.query.sortBy) || 'createdAt',
  sortOrder: getQueryValue(route.query.sortOrder) === 'asc' ? 'asc' : 'desc',
});

const applied = reactive<FiltersState>({ ...draft });
const selectedId = ref<string | null>(null);
const selectedMetric = ref<'spend' | 'impressions' | 'clicks' | 'results' | 'purchases' | 'purchaseValue'>('spend');
const strategistRunning = ref(false);
const advisorRunning = ref(false);
const aiWorkflowError = ref<string | null>(null);
const latestStrategistId = ref<string | null>(null);
const latestAdvisorId = ref<string | null>(null);
const currentContextHash = ref<string>('');
const metricOptions: Array<'spend' | 'impressions' | 'clicks' | 'results' | 'purchases' | 'purchaseValue'> = [
  'spend',
  'impressions',
  'clicks',
  'results',
  'purchases',
  'purchaseValue',
];
const breadcrumb = reactive({
  campaignName: '',
  adSetName: '',
});

const sortOptions = computed(() => {
  if (applied.level === 'campaigns') {
    return [
      { value: 'createdAt', label: 'Recientes' },
      { value: 'name', label: 'Nombre' },
      { value: 'status', label: 'Estado' },
      { value: 'spend', label: 'Spend' },
      { value: 'clicks', label: 'Clicks' },
      { value: 'results', label: 'Resultados' },
      { value: 'roas', label: 'ROAS' },
    ];
  }

  return [
    { value: 'createdAt', label: 'Recientes' },
    { value: 'name', label: 'Nombre' },
    { value: 'status', label: 'Estado' },
    { value: 'spend', label: 'Spend' },
    { value: 'clicks', label: 'Clicks' },
    { value: 'results', label: 'Resultados' },
    { value: 'purchases', label: 'Compras' },
    { value: 'roas', label: 'ROAS' },
  ];
});

const levelTitle = computed(() => {
  if (applied.level === 'campaigns') {
    return 'Campaigns';
  }

  if (applied.level === 'ad-sets') {
    return 'Ad Sets';
  }

  return 'Ads';
});

const analysisLevel = computed<AnalysisLevel>(() => {
  if (applied.level === 'campaigns') {
    return 'campaign';
  }

  if (applied.level === 'ad-sets') {
    return 'ad_set';
  }

  return 'ad';
});

const selectedClient = computed(
  () => (clients.value ?? []).find((client) => client.id === applied.clienteId) ?? null,
);

const aiWorkflowReady = computed(() => Boolean(applied.clienteId));

const currentEndpoint = computed(() => `/${applied.level}`);

const currentQuery = computed(() => ({
  ...(applied.clienteId ? { clienteId: applied.clienteId } : {}),
  ...(applied.status ? { status: applied.status } : {}),
  ...(applied.search ? { search: applied.search } : {}),
  ...(applied.dateFrom ? { dateFrom: applied.dateFrom } : {}),
  ...(applied.dateTo ? { dateTo: applied.dateTo } : {}),
  page: applied.page,
  pageSize: applied.pageSize,
  sortBy: applied.sortBy,
  sortOrder: applied.sortOrder,
  ...(applied.level !== 'campaigns' && applied.campaignId
    ? { campaignId: applied.campaignId }
    : {}),
  ...(applied.level === 'ads' && applied.adSetId ? { adSetId: applied.adSetId } : {}),
}));

const listKey = computed(() => JSON.stringify({ endpoint: currentEndpoint.value, query: currentQuery.value }));

const { data: clients } = await useAsyncData<ClientOption[]>(
  'ads-manager-clients',
  () => api('/clients'),
  {
    lazy: true,
  },
);

const {
  data: listResponse,
  pending,
  refresh,
} = await useAsyncData<ListResponse>(
  () => `ads-manager:${listKey.value}`,
  () =>
    api(currentEndpoint.value, {
      query: currentQuery.value,
    }),
  {
    watch: [listKey],
    lazy: true,
    default: () => ({
      data: [],
      meta: {
        page: 1,
        pageSize: 25,
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

const detailKey = computed(() =>
  selectedId.value
    ? JSON.stringify({
        endpoint: currentEndpoint.value,
        id: selectedId.value,
        dateFrom: applied.dateFrom,
        dateTo: applied.dateTo,
      })
    : null,
);

const { data: selectedDetail } = await useAsyncData<any | null>(
  () => `ads-manager-detail:${detailKey.value ?? 'empty'}`,
  () =>
    selectedId.value
      ? api(`${currentEndpoint.value}/${selectedId.value}`, {
          query: {
            dateFrom: applied.dateFrom,
            dateTo: applied.dateTo,
          },
        })
      : null,
  {
    watch: [detailKey],
    lazy: true,
    default: () => null,
  },
);

const { data: chart } = await useAsyncData<any | null>(
  () => `ads-manager-chart:${detailKey.value ?? 'empty'}`,
  () =>
    selectedId.value
      ? api(`${currentEndpoint.value}/${selectedId.value}/daily-chart`, {
          query: {
            dateFrom: applied.dateFrom,
            dateTo: applied.dateTo,
          },
        })
      : null,
  {
    watch: [detailKey],
    lazy: true,
    default: () => null,
  },
);

const strategistHistoryQuery = computed(() =>
  applied.clienteId
    ? {
        clientId: applied.clienteId,
        level: analysisLevel.value,
        dateFrom: applied.dateFrom,
        dateTo: applied.dateTo,
        ...(currentContextHash.value ? { contextHash: currentContextHash.value } : {}),
        page: 1,
        pageSize: 8,
      }
    : null,
);

const {
  data: strategistHistory,
  pending: strategistHistoryPending,
  refresh: refreshStrategistHistory,
} = await useAsyncData<HistoryResponse>(
  () =>
    `ads-manager-strategist-history:${JSON.stringify(strategistHistoryQuery.value ?? {})}`,
  () =>
    strategistHistoryQuery.value
      ? api('/ai-strategist/history', {
          query: strategistHistoryQuery.value,
        })
      : {
          data: [],
          meta: {
            page: 1,
            pageSize: 8,
            total: 0,
            totalPages: 1,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          },
        },
  {
    watch: [strategistHistoryQuery],
    lazy: true,
    default: () => ({
      data: [],
      meta: {
        page: 1,
        pageSize: 8,
        total: 0,
        totalPages: 1,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
    }),
  },
);

const advisorHistoryQuery = computed(() =>
  applied.clienteId
    ? {
        clientId: applied.clienteId,
        level: analysisLevel.value,
        dateFrom: applied.dateFrom,
        dateTo: applied.dateTo,
        ...(currentContextHash.value ? { contextHash: currentContextHash.value } : {}),
        page: 1,
        pageSize: 8,
      }
    : null,
);

const {
  data: advisorHistory,
  pending: advisorHistoryPending,
  refresh: refreshAdvisorHistory,
} = await useAsyncData<HistoryResponse>(
  () =>
    `ads-manager-advisor-history:${JSON.stringify(advisorHistoryQuery.value ?? {})}`,
  () =>
    advisorHistoryQuery.value
      ? api('/commercial-advisor/history', {
          query: advisorHistoryQuery.value,
        })
      : {
          data: [],
          meta: {
            page: 1,
            pageSize: 8,
            total: 0,
            totalPages: 1,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          },
        },
  {
    watch: [advisorHistoryQuery],
    lazy: true,
    default: () => ({
      data: [],
      meta: {
        page: 1,
        pageSize: 8,
        total: 0,
        totalPages: 1,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
    }),
  },
);

const recentStrategistRows = computed(() => strategistHistory.value?.data ?? []);
const recentAdvisorRows = computed(() => advisorHistory.value?.data ?? []);

watch(
  rows,
  (nextRows) => {
    if (!nextRows || nextRows.length === 0) {
      selectedId.value = null;
      return;
    }

    if (!selectedId.value || !nextRows.some((row) => row.id === selectedId.value)) {
      selectedId.value = nextRows[0].id;
    }
  },
  { immediate: true },
);

function applyFilters() {
  aiWorkflowError.value = null;

  if (
    draft.clienteId !== applied.clienteId &&
    (draft.level === 'ad-sets' || draft.level === 'ads')
  ) {
    draft.level = 'campaigns';
    resetHierarchy();
  }

  applied.level = draft.level;
  applied.clienteId = draft.clienteId;
  applied.status = draft.status;
  applied.search = draft.search;
  applied.dateFrom = draft.dateFrom;
  applied.dateTo = draft.dateTo;
  applied.campaignId = draft.campaignId;
  applied.adSetId = draft.adSetId;
  applied.page = draft.page;
  applied.pageSize = draft.pageSize;
  applied.sortBy = draft.sortBy;
  applied.sortOrder = draft.sortOrder;
  refresh();
}

function resetHierarchy() {
  draft.campaignId = '';
  draft.adSetId = '';
  draft.page = 1;
  breadcrumb.campaignName = '';
  breadcrumb.adSetName = '';
}

function onLevelChange(level: ManagerLevel) {
  draft.level = level;
  draft.page = 1;

  if (level === 'campaigns') {
    resetHierarchy();
  }

  if (level === 'ad-sets') {
    draft.adSetId = '';
    breadcrumb.adSetName = '';
  }

  applyFilters();
}

function selectRow(row: any) {
  selectedId.value = row.id;
}

function drillRow(row: any) {
  if (applied.level === 'campaigns') {
    draft.level = 'ad-sets';
    draft.campaignId = row.id;
    draft.adSetId = '';
    draft.page = 1;
    breadcrumb.campaignName = row.name;
    breadcrumb.adSetName = '';
  } else if (applied.level === 'ad-sets') {
    draft.level = 'ads';
    draft.campaignId = row.campaignId;
    draft.adSetId = row.id;
    draft.page = 1;
    breadcrumb.campaignName = row.campaign?.name ?? breadcrumb.campaignName;
    breadcrumb.adSetName = row.name;
  }

  applyFilters();
}

function goToCampaigns() {
  draft.level = 'campaigns';
  resetHierarchy();
  applyFilters();
}

function goToAdSets() {
  draft.level = 'ad-sets';
  draft.adSetId = '';
  draft.page = 1;
  breadcrumb.adSetName = '';
  applyFilters();
}

function applyAndResetPage() {
  draft.page = 1;
  applyFilters();
}

function goToPage(page: number) {
  draft.page = page;
  applyFilters();
}

function currentAiFilters() {
  return {
    ...(applied.status ? { status: applied.status } : {}),
    ...(applied.search ? { search: applied.search } : {}),
    ...(applied.campaignId ? { campaignId: applied.campaignId } : {}),
    ...(applied.adSetId ? { adSetId: applied.adSetId } : {}),
  };
}

async function syncCurrentContextHash() {
  if (!applied.clienteId) {
    currentContextHash.value = '';
    return;
  }

  currentContextHash.value = await buildAnalysisContextHash({
    clientId: applied.clienteId,
    level: analysisLevel.value,
    dateFrom: applied.dateFrom,
    dateTo: applied.dateTo,
    filters: currentAiFilters(),
  });
}

function buildAiHistoryQuery(
  engine: 'strategist' | 'advisor',
  id?: string,
) {
  return {
    engine,
    ...(applied.clienteId ? { clientId: applied.clienteId } : {}),
    level: analysisLevel.value,
    dateFrom: applied.dateFrom,
    dateTo: applied.dateTo,
    ...(currentContextHash.value ? { contextHash: currentContextHash.value } : {}),
    ...(id ? { id } : {}),
  };
}

async function openAiHistory(engine: 'strategist' | 'advisor') {
  await navigateTo({
    path: '/ai-history',
    query: buildAiHistoryQuery(engine),
  });
}

async function openAiHistoryRecord(payload: {
  engine: 'strategist' | 'advisor';
  id: string;
}) {
  await navigateTo({
    path: '/ai-history',
    query: buildAiHistoryQuery(payload.engine, payload.id),
  });
}

async function runStrategist() {
  if (!aiWorkflowReady.value) {
    aiWorkflowError.value = 'Selecciona un cliente para lanzar el analisis.';
    return;
  }

  strategistRunning.value = true;
  aiWorkflowError.value = null;

  try {
    const response = await api('/ai-strategist/analyze', {
      method: 'POST',
      body: {
        clientId: applied.clienteId,
        level: analysisLevel.value,
        dateFrom: applied.dateFrom,
        dateTo: applied.dateTo,
        filters: currentAiFilters(),
      },
    });

    latestStrategistId.value = response.analysisId ?? null;
    await refreshStrategistHistory();
  } catch (error: any) {
    aiWorkflowError.value =
      error?.data?.message ?? 'No pudimos generar el analisis estrategico para este contexto.';
  } finally {
    strategistRunning.value = false;
  }
}

async function runAdvisorFresh() {
  if (!aiWorkflowReady.value) {
    aiWorkflowError.value = 'Selecciona un cliente para generar advisory.';
    return;
  }

  advisorRunning.value = true;
  aiWorkflowError.value = null;

  try {
    const response = await api('/commercial-advisor/generate', {
      method: 'POST',
      body: {
        clientId: applied.clienteId,
        level: analysisLevel.value,
        dateFrom: applied.dateFrom,
        dateTo: applied.dateTo,
        filters: currentAiFilters(),
      },
    });

    latestAdvisorId.value = response.advisoryId ?? null;
    latestStrategistId.value = response.strategistAnalysisId ?? latestStrategistId.value;
    await Promise.all([refreshStrategistHistory(), refreshAdvisorHistory()]);
  } catch (error: any) {
    aiWorkflowError.value =
      error?.data?.message ?? 'No pudimos generar el advisory comercial para este contexto.';
  } finally {
    advisorRunning.value = false;
  }
}

async function runAdvisorFromStrategist(strategistAnalysisId: string) {
  if (!aiWorkflowReady.value) {
    aiWorkflowError.value = 'Selecciona un cliente para reutilizar un strategist.';
    return;
  }

  advisorRunning.value = true;
  aiWorkflowError.value = null;

  try {
    const response = await api('/commercial-advisor/generate', {
      method: 'POST',
      body: currentContextHash.value && recentStrategistExactRows.value.length > 0
        ? {
            clientId: applied.clienteId,
            level: analysisLevel.value,
            dateFrom: applied.dateFrom,
            dateTo: applied.dateTo,
            contextHash: currentContextHash.value,
          }
        : {
            clientId: applied.clienteId,
            level: analysisLevel.value,
            dateFrom: applied.dateFrom,
            dateTo: applied.dateTo,
            strategistAnalysisId,
          },
    });

    latestAdvisorId.value = response.advisoryId ?? null;
    latestStrategistId.value = response.strategistAnalysisId ?? strategistAnalysisId;
    await refreshAdvisorHistory();
  } catch (error: any) {
    aiWorkflowError.value =
      error?.data?.message ?? 'No pudimos generar el advisory desde el strategist seleccionado.';
  } finally {
    advisorRunning.value = false;
  }
}

watch(
  () => [
    applied.clienteId,
    analysisLevel.value,
    applied.dateFrom,
    applied.dateTo,
    applied.status,
    applied.search,
    applied.campaignId,
    applied.adSetId,
  ],
  () => {
    void syncCurrentContextHash();
  },
  { immediate: true },
);

const recentStrategistExactRows = computed(() =>
  recentStrategistRows.value.filter((row) => row.exact_context_match),
);

const recentStrategistSimilarRows = computed(() =>
  recentStrategistRows.value.filter((row) => !row.exact_context_match),
);

const recentAdvisorExactRows = computed(() =>
  recentAdvisorRows.value.filter((row) => row.exact_context_match),
);

const recentAdvisorSimilarRows = computed(() =>
  recentAdvisorRows.value.filter((row) => !row.exact_context_match),
);
</script>

<template>
  <div class="space-y-6">
    <section class="panel hero-panel p-6 lg:p-8">
      <div class="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div class="max-w-4xl">
          <p class="font-mono text-[11px] uppercase tracking-[0.35em] text-[color:var(--muted)]">
            Operacion publicitaria
          </p>
          <h1 class="mt-4 text-4xl font-semibold md:text-5xl">
            Quimera Ads Manager
          </h1>
          <p class="mt-4 max-w-3xl text-base text-[color:var(--muted)] md:text-lg">
            Experiencia operativa tipo Meta Ads Manager para navegar catalogo, revisar rendimiento diario
            y bajar por niveles sin salir de la base propia.
          </p>
        </div>

        <div class="editorial-note max-w-sm">
          <p class="font-mono text-[11px] uppercase tracking-[0.3em] text-[color:var(--muted)]">
            Fuente de lectura
          </p>
          <p class="mt-3 text-sm">
            Todo lo que ves viene del backend y de PostgreSQL propio. El frontend no consulta Meta.
          </p>
        </div>
      </div>
    </section>

    <AdsManagerLevelTabs :model-value="draft.level" @update:model-value="onLevelChange" />

    <section class="panel p-6">
      <div class="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_1fr_0.8fr_0.8fr_auto]">
        <select v-model="draft.clienteId" class="field">
          <option value="">Todos los clientes</option>
          <option v-for="client in clients ?? []" :key="client.id" :value="client.id">
            {{ client.nombre }} - {{ client.empresa }}
          </option>
        </select>

        <input v-model="draft.search" class="field" type="text" placeholder="Buscar por nombre" />

        <select v-model="draft.status" class="field">
          <option value="">Todos los estados</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="PAUSED">PAUSED</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </select>

        <div class="grid grid-cols-2 gap-3">
          <input v-model="draft.dateFrom" class="field" type="date" />
          <input v-model="draft.dateTo" class="field" type="date" />
        </div>

        <select v-model="draft.sortBy" class="field">
          <option v-for="option in sortOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>

        <select v-model="draft.sortOrder" class="field">
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>

        <button class="btn-primary" @click="applyAndResetPage">
          Aplicar
        </button>
      </div>

      <div class="mt-5 flex flex-wrap items-center gap-3">
        <button class="breadcrumb-chip" :class="{ 'breadcrumb-chip-active': applied.level === 'campaigns' }" @click="goToCampaigns">
          Campaigns
        </button>
        <button
          v-if="breadcrumb.campaignName"
          class="breadcrumb-chip"
          :class="{ 'breadcrumb-chip-active': applied.level === 'ad-sets' }"
          @click="goToAdSets"
        >
          {{ breadcrumb.campaignName }}
        </button>
        <span v-if="breadcrumb.adSetName" class="breadcrumb-chip breadcrumb-chip-static">
          {{ breadcrumb.adSetName }}
        </span>
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_420px]">
      <div class="space-y-6">
        <section class="panel p-5">
          <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p class="font-mono text-[11px] uppercase tracking-[0.3em] text-[color:var(--muted)]">
                Tabla operativa
              </p>
              <h2 class="mt-3 text-2xl font-semibold">{{ levelTitle }}</h2>
              <p class="mt-2 text-sm text-[color:var(--muted)]">
                Rango global {{ applied.dateFrom }} a {{ applied.dateTo }}.
              </p>
            </div>
            <div class="text-sm text-[color:var(--muted)]">
              {{ listMeta?.total ?? rows.length }} filas totales
            </div>
          </div>
        </section>

        <AdsManagerPerformanceTable
          :level="applied.level"
          :rows="rows"
          :meta="listMeta"
          :pending="pending"
          :selected-id="selectedId"
          @select="selectRow"
          @drill="drillRow"
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
        <AdsManagerAiWorkflowPanel
          :ready="aiWorkflowReady"
          :client-name="selectedClient?.nombre ?? null"
          :level-label="levelTitle"
          :date-from="applied.dateFrom"
          :date-to="applied.dateTo"
          :strategist-exact-rows="recentStrategistExactRows"
          :strategist-similar-rows="recentStrategistSimilarRows"
          :advisor-exact-rows="recentAdvisorExactRows"
          :advisor-similar-rows="recentAdvisorSimilarRows"
          :strategist-pending="strategistHistoryPending"
          :advisor-pending="advisorHistoryPending"
          :strategist-running="strategistRunning"
          :advisor-running="advisorRunning"
          :has-current-context-hash="Boolean(currentContextHash)"
          :last-strategist-id="latestStrategistId"
          :last-advisor-id="latestAdvisorId"
          :error-message="aiWorkflowError"
          @run-strategist="runStrategist"
          @run-advisor-fresh="runAdvisorFresh"
          @run-advisor-from-strategist="runAdvisorFromStrategist(recentStrategistRows[0]?.id ?? '')"
          @open-history="openAiHistory"
          @open-history-record="openAiHistoryRecord"
        />

        <AdsManagerEntityDetailPanel :level="applied.level" :entity="selectedDetail" />

        <section class="panel p-5">
          <div class="mb-4 flex flex-wrap gap-2">
            <button
              v-for="metric in metricOptions"
              :key="metric"
              class="metric-chip"
              :class="{ 'metric-chip-active': selectedMetric === metric }"
              @click="selectedMetric = metric"
            >
              {{ metric }}
            </button>
          </div>

          <AdsManagerDailyMetricChart
            :rows="chart?.rows ?? []"
            :metric="selectedMetric"
          />
        </section>
      </div>
    </section>
  </div>
</template>
