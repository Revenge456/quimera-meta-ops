<script setup lang="ts">
type ManagerLevel = 'campaigns' | 'ad-sets' | 'ads';

type DetailEntity = {
  id: string;
  name: string;
  effectiveStatus?: string | null;
  objective?: string | null;
  optimizationGoal?: string | null;
  configuredStatus?: string | null;
  adAccount?: {
    name: string;
    client: {
      nombre: string;
      empresa: string;
    };
  };
  campaign?: {
    name: string;
    adAccount: {
      client: {
        nombre: string;
      };
    };
  };
  adSet?: {
    name: string;
  };
  creatives?: Array<{
    id: string;
    name?: string | null;
    headline?: string | null;
    assetType?: string | null;
    landingUrl?: string | null;
  }>;
  metrics?: {
    spend: number;
    impressions: number;
    clicks: number;
    purchases: number;
    ctr: number | null;
    cpm: number | null;
    cpc: number | null;
    roas: number | null;
    resultType: string | null;
    results: number | null;
  };
};

const props = defineProps<{
  level: ManagerLevel;
  entity: DetailEntity | null;
}>();

const currency = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const metricCards = computed(() => {
  if (!props.entity?.metrics) {
    return [];
  }

  return [
    { label: 'Spend', value: currency.format(props.entity.metrics.spend || 0) },
    {
      label: 'Impresiones',
      value: props.entity.metrics.impressions.toLocaleString('es-PE'),
    },
    { label: 'Clicks', value: props.entity.metrics.clicks.toLocaleString('es-PE') },
    {
      label: 'ROAS',
      value:
        props.entity.metrics.roas !== null
          ? props.entity.metrics.roas.toFixed(2)
          : '--',
    },
  ];
});
</script>

<template>
  <aside class="panel h-full p-5">
    <div
      v-if="!entity"
      class="flex h-full min-h-72 items-center justify-center text-center text-sm text-[color:var(--muted)]"
    >
      Selecciona una fila para abrir el panel operativo y revisar su serie diaria.
    </div>

    <div v-else class="space-y-5">
      <div>
        <p class="font-mono text-[11px] uppercase tracking-[0.3em] text-[color:var(--muted)]">
          {{ level }}
        </p>
        <h2 class="mt-3 text-2xl font-semibold">{{ entity.name }}</h2>
        <div class="mt-3 flex flex-wrap gap-2">
          <span class="status-chip">{{ entity.effectiveStatus || 'unknown' }}</span>
          <span v-if="entity.configuredStatus" class="meta-chip">
            Config {{ entity.configuredStatus }}
          </span>
          <span v-if="entity.objective" class="meta-chip">
            {{ entity.objective }}
          </span>
          <span v-if="entity.optimizationGoal" class="meta-chip">
            {{ entity.optimizationGoal }}
          </span>
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div v-for="card in metricCards" :key="card.label" class="detail-metric">
          <p class="font-mono text-[11px] uppercase tracking-[0.3em] text-[color:var(--muted)]">
            {{ card.label }}
          </p>
          <p class="mt-2 text-lg font-semibold">{{ card.value }}</p>
        </div>
      </div>

      <div class="space-y-3 text-sm">
        <div class="detail-line">
          <span>Cliente</span>
          <strong>
            {{
              entity.adAccount?.client.nombre ||
              entity.campaign?.adAccount.client.nombre ||
              '--'
            }}
          </strong>
        </div>
        <div v-if="entity.adAccount?.name" class="detail-line">
          <span>Cuenta</span>
          <strong>{{ entity.adAccount.name }}</strong>
        </div>
        <div v-if="entity.campaign?.name" class="detail-line">
          <span>Campaign</span>
          <strong>{{ entity.campaign.name }}</strong>
        </div>
        <div v-if="entity.adSet?.name" class="detail-line">
          <span>Ad Set</span>
          <strong>{{ entity.adSet.name }}</strong>
        </div>
        <div class="detail-line">
          <span>Resultado principal</span>
          <strong>
            {{
              entity.metrics?.results !== null && entity.metrics?.resultType
                ? `${entity.metrics.results} ${entity.metrics.resultType}`
                : 'Sin resultado principal'
            }}
          </strong>
        </div>
      </div>

      <div v-if="level === 'ads' && entity.creatives?.length" class="space-y-3">
        <p class="font-mono text-[11px] uppercase tracking-[0.3em] text-[color:var(--muted)]">
          Creatives
        </p>
        <div
          v-for="creative in entity.creatives"
          :key="creative.id"
          class="rounded-2xl border border-[color:var(--line)] bg-white/70 p-4"
        >
          <p class="font-semibold">{{ creative.name || creative.headline || 'Creative' }}</p>
          <p class="mt-1 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            {{ creative.assetType || 'asset' }}
          </p>
          <p v-if="creative.landingUrl" class="mt-3 break-all text-xs text-[color:var(--muted)]">
            {{ creative.landingUrl }}
          </p>
        </div>
      </div>
    </div>
  </aside>
</template>
