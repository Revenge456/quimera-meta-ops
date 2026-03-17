<script setup lang="ts">
type HistoryEngine = 'strategist' | 'advisor';

type StrategistDetail = {
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
  filters: Record<string, string | undefined>;
  context_hash?: string | null;
  exact_context_match?: boolean;
  executive_summary: string;
  entities_analyzed: number;
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

type AdvisorDetail = {
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
  filters: Record<string, string | undefined>;
  context_hash?: string | null;
  exact_context_match?: boolean;
  executive_summary: string;
  client_ready_summary: string;
  strategist_analysis_id: string | null;
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

const props = defineProps<{
  engine: HistoryEngine;
  detail: StrategistDetail | AdvisorDetail | null;
  hasContextHash?: boolean;
  pending?: boolean;
}>();

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

const filterEntries = computed(() => {
  if (!props.detail) {
    return [];
  }

  return Object.entries(props.detail.filters ?? {}).filter(([, value]) => Boolean(value));
});

function toManagerLevel(level: StrategistDetail['level']) {
  if (level === 'campaign') {
    return 'campaigns';
  }

  if (level === 'ad_set') {
    return 'ad-sets';
  }

  return 'ads';
}

const adsManagerLink = computed(() => {
  if (!props.detail) {
    return null;
  }

  return {
    path: '/',
    query: {
      clienteId: props.detail.client.id,
      level: toManagerLevel(props.detail.level),
      dateFrom: props.detail.date_from,
      dateTo: props.detail.date_to,
      ...(props.detail.filters.status ? { status: props.detail.filters.status } : {}),
      ...(props.detail.filters.search ? { search: props.detail.filters.search } : {}),
      ...(props.detail.filters.campaignId
        ? { campaignId: props.detail.filters.campaignId }
        : {}),
      ...(props.detail.filters.adSetId ? { adSetId: props.detail.filters.adSetId } : {}),
    },
  };
});

const linkedStrategistLink = computed(() => {
  if (
    props.engine !== 'advisor' ||
    !props.detail ||
    !(props.detail as AdvisorDetail).strategist_analysis_id
  ) {
    return null;
  }

  return {
    path: '/ai-history',
    query: {
      engine: 'strategist',
      id: (props.detail as AdvisorDetail).strategist_analysis_id ?? undefined,
      clientId: props.detail.client.id,
      level: props.detail.level,
      dateFrom: props.detail.date_from,
      dateTo: props.detail.date_to,
    },
  };
});
</script>

<template>
  <section class="panel min-h-[32rem] p-5">
    <div v-if="pending" class="py-8 text-sm text-[color:var(--muted)]">
      Cargando detalle...
    </div>

    <div v-else-if="!detail" class="py-8 text-sm text-[color:var(--muted)]">
      Selecciona un registro del historial para ver su contenido.
    </div>

    <div v-else class="space-y-6">
      <div>
        <p class="font-mono text-[11px] uppercase tracking-[0.3em] text-[color:var(--muted)]">
          {{ engine === 'strategist' ? 'Analisis persistido' : 'Advisory persistido' }}
        </p>
        <h2 class="mt-3 text-3xl font-semibold">
          {{ detail.executive_summary }}
        </h2>
        <p class="mt-3 text-sm text-[color:var(--muted)]">
          {{ detail.client.nombre }} · {{ detail.client.empresa }} · {{ formatGeneratedAt(detail.generated_at) }}
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <span class="meta-chip">{{ detail.level }}</span>
        <span class="meta-chip">{{ detail.date_from }} -> {{ detail.date_to }}</span>
        <span class="meta-chip">{{ detail.generated_by?.nombre ?? 'Sistema' }}</span>
        <span
          v-if="hasContextHash"
          class="meta-chip"
          :class="detail.exact_context_match ? 'bg-emerald-100 text-emerald-700' : ''"
        >
          {{ detail.exact_context_match ? 'Exact match' : 'Similar' }}
        </span>
        <span
          v-if="engine === 'advisor' && (detail as AdvisorDetail).strategist_analysis_id"
          class="meta-chip"
        >
          strategist_analysis_id: {{ (detail as AdvisorDetail).strategist_analysis_id }}
        </span>
      </div>

      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-if="adsManagerLink"
          :to="adsManagerLink"
          class="btn-secondary px-4 py-2 text-xs"
        >
          Abrir contexto en Ads Manager
        </NuxtLink>
        <NuxtLink
          v-if="linkedStrategistLink"
          :to="linkedStrategistLink"
          class="btn-secondary px-4 py-2 text-xs"
        >
          Ver strategist relacionado
        </NuxtLink>
      </div>

      <div v-if="filterEntries.length > 0" class="archive-section">
        <p class="archive-section-title">Filtros guardados</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <span
            v-for="[key, value] in filterEntries"
            :key="key"
            class="archive-pill"
          >
            {{ key }}: {{ value }}
          </span>
        </div>
      </div>

      <div v-if="engine === 'strategist'" class="space-y-5">
        <div class="archive-section">
          <p class="archive-section-title">Resumen cliente</p>
          <p class="mt-3 text-sm text-[color:var(--muted)]">
            {{ (detail as StrategistDetail).output.client_summary }}
          </p>
        </div>

        <div class="archive-section">
          <p class="archive-section-title">Key findings</p>
          <ul class="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
            <li
              v-for="finding in (detail as StrategistDetail).output.key_findings"
              :key="finding"
            >
              - {{ finding }}
            </li>
          </ul>
        </div>

        <div class="archive-grid">
          <div class="archive-kpi">
            <p class="archive-kpi-label">Entidades analizadas</p>
            <p class="archive-kpi-value">
              {{ (detail as StrategistDetail).entities_analyzed }}
            </p>
          </div>
          <div class="archive-kpi">
            <p class="archive-kpi-label">Total filtrado</p>
            <p class="archive-kpi-value">
              {{ (detail as StrategistDetail).context_snapshot?.entities_total ?? 'n/d' }}
            </p>
          </div>
        </div>

        <div class="archive-section">
          <p class="archive-section-title">Decision por entidad</p>
          <div class="mt-4 space-y-4">
            <article
              v-for="entity in (detail as StrategistDetail).output.entity_analysis"
              :key="entity.entity_id"
              class="archive-summary"
            >
              <div class="flex flex-wrap items-center gap-2">
                <span class="meta-chip">{{ entity.classification }}</span>
                <span class="meta-chip">{{ entity.confidence }}</span>
              </div>
              <h3 class="mt-3 text-lg font-semibold">{{ entity.entity_name }}</h3>
              <p class="mt-2 text-sm text-[color:var(--muted)]">
                {{ entity.reasoning }}
              </p>
              <div class="mt-4 grid gap-3 md:grid-cols-3">
                <div>
                  <p class="archive-mini-title">Issues</p>
                  <ul class="mt-2 space-y-2 text-sm text-[color:var(--muted)]">
                    <li v-for="issue in entity.detected_issues" :key="issue">- {{ issue }}</li>
                  </ul>
                </div>
                <div>
                  <p class="archive-mini-title">Opportunities</p>
                  <ul class="mt-2 space-y-2 text-sm text-[color:var(--muted)]">
                    <li v-for="item in entity.opportunities" :key="item">- {{ item }}</li>
                  </ul>
                </div>
                <div>
                  <p class="archive-mini-title">Recommended actions</p>
                  <ul class="mt-2 space-y-2 text-sm text-[color:var(--muted)]">
                    <li v-for="action in entity.recommended_actions" :key="action">- {{ action }}</li>
                  </ul>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>

      <div v-else class="space-y-5">
        <div class="archive-section">
          <p class="archive-section-title">Client-ready summary</p>
          <p class="mt-3 text-sm text-[color:var(--muted)]">
            {{ (detail as AdvisorDetail).output.client_ready_summary }}
          </p>
        </div>

        <div class="archive-section">
          <p class="archive-section-title">Performance explanation</p>
          <p class="mt-3 text-sm text-[color:var(--muted)]">
            {{ (detail as AdvisorDetail).output.performance_explanation }}
          </p>
        </div>

        <div class="archive-grid">
          <div class="archive-kpi">
            <p class="archive-kpi-label">Strategist link</p>
            <p class="archive-kpi-value text-sm">
              {{ (detail as AdvisorDetail).strategist_analysis_id ?? 'sin link' }}
            </p>
          </div>
          <div class="archive-kpi">
            <p class="archive-kpi-label">Snapshot tecnico</p>
            <p class="mt-2 text-sm text-[color:var(--muted)]">
              {{ (detail as AdvisorDetail).strategist_output_snapshot?.executive_summary ?? 'no disponible' }}
            </p>
          </div>
        </div>

        <div class="archive-section">
          <p class="archive-section-title">Decision justifications</p>
          <div class="mt-4 space-y-4">
            <article
              v-for="item in (detail as AdvisorDetail).output.decision_justifications"
              :key="item.entity_id"
              class="archive-summary"
            >
              <div class="flex flex-wrap items-center gap-2">
                <span class="meta-chip">{{ item.classification }}</span>
              </div>
              <h3 class="mt-3 text-lg font-semibold">{{ item.entity_name }}</h3>
              <p class="mt-2 text-sm text-[color:var(--muted)]">
                {{ item.justification }}
              </p>
            </article>
          </div>
        </div>

        <div class="archive-section">
          <p class="archive-section-title">Objection handling</p>
          <div class="mt-4 space-y-4">
            <div class="archive-summary">
              <p class="archive-mini-title">Performance</p>
              <p class="mt-2 text-sm text-[color:var(--muted)]">
                {{ (detail as AdvisorDetail).output.objection_handling.performance }}
              </p>
            </div>
            <div class="archive-summary">
              <p class="archive-mini-title">Budget</p>
              <p class="mt-2 text-sm text-[color:var(--muted)]">
                {{ (detail as AdvisorDetail).output.objection_handling.budget }}
              </p>
            </div>
          </div>
        </div>

        <div class="archive-section">
          <p class="archive-section-title">Commercial momentum</p>
          <div class="mt-4 space-y-4">
            <div class="archive-summary">
              <p class="archive-mini-title">Additional opportunity</p>
              <p class="mt-2 text-sm text-[color:var(--muted)]">
                {{ (detail as AdvisorDetail).output.additional_commercial_opportunity }}
              </p>
            </div>
            <div class="archive-summary">
              <p class="archive-mini-title">Next phase</p>
              <p class="mt-2 text-sm text-[color:var(--muted)]">
                {{ (detail as AdvisorDetail).output.next_phase_recommendation }}
              </p>
            </div>
            <div class="archive-summary">
              <p class="archive-mini-title">Agency positioning</p>
              <p class="mt-2 text-sm text-[color:var(--muted)]">
                {{ (detail as AdvisorDetail).output.agency_positioning_narrative }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
