<script setup lang="ts">
type ManagerLevel = 'campaigns' | 'ad-sets' | 'ads';

type PerformanceMetrics = {
  spend: number;
  impressions: number;
  clicks: number;
  results: number | null;
  resultType: string | null;
  purchases: number;
  cpa?: number | null;
  ctr: number | null;
};

type ManagerRow = {
  id: string;
  name: string;
  effectiveStatus?: string | null;
  metrics: PerformanceMetrics;
  adAccount?: {
    name: string;
    client: {
      nombre: string;
      empresa: string;
    };
  };
  campaign?: {
    id: string;
    name: string;
    adAccount: {
      name: string;
      client: {
        nombre: string;
      };
    };
  };
  adSet?: {
    id: string;
    name: string;
  };
  _count?: {
    adSets?: number;
    ads?: number;
    creatives?: number;
  };
};

const props = defineProps<{
  level: ManagerLevel;
  rows: ManagerRow[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  } | null;
  pending?: boolean;
  selectedId?: string | null;
}>();

const emit = defineEmits<{
  select: [row: ManagerRow];
  drill: [row: ManagerRow];
}>();

const currency = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const compact = new Intl.NumberFormat('es-PE', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const headers = computed(() => {
  if (props.level === 'campaigns') {
    return ['Nombre', 'Cliente', 'Cuenta', 'Estado', 'Spend', 'Clicks', 'Resultado', 'Drill'];
  }

  if (props.level === 'ad-sets') {
    return ['Nombre', 'Campaign', 'Cliente', 'Estado', 'Spend', 'CTR', 'Resultado', 'Drill'];
  }

  return ['Nombre', 'Ad Set', 'Campaign', 'Estado', 'Spend', 'Clicks', 'Compras', 'Detalle'];
});

function rowResult(row: ManagerRow) {
  if (row.metrics.results === null || !row.metrics.resultType) {
    return 'Sin resultado principal';
  }

  return `${compact.format(row.metrics.results)} ${row.metrics.resultType}`;
}
</script>

<template>
  <section class="panel overflow-hidden">
    <div class="table-scroll">
      <table class="min-w-full text-left text-sm">
        <thead class="table-head">
          <tr>
            <th v-for="header in headers" :key="header" class="px-4 py-3">
              {{ header }}
            </th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="row in rows"
            :key="row.id"
            class="table-row"
            :class="{ 'table-row-active': selectedId === row.id }"
          >
            <td class="px-4 py-3">
              <button class="block text-left" @click="emit('select', row)">
                <span class="block font-semibold">{{ row.name }}</span>
                <span class="mt-1 block text-xs text-[color:var(--muted)]">
                  {{
                    props.level === 'campaigns'
                      ? `${row._count?.adSets ?? 0} ad sets · ${row._count?.ads ?? 0} ads`
                      : props.level === 'ad-sets'
                        ? `${row._count?.ads ?? 0} ads`
                        : `${row._count?.creatives ?? 0} creatives`
                  }}
                </span>
              </button>
            </td>

            <td v-if="props.level === 'campaigns'" class="px-4 py-3">
              <span class="block font-medium">{{ row.adAccount?.client.nombre }}</span>
              <span class="text-xs text-[color:var(--muted)]">{{ row.adAccount?.client.empresa }}</span>
            </td>
            <td v-else-if="props.level === 'ad-sets'" class="px-4 py-3">
              <span class="block font-medium">{{ row.campaign?.name }}</span>
              <span class="text-xs text-[color:var(--muted)]">{{ row.campaign?.adAccount.name }}</span>
            </td>
            <td v-else class="px-4 py-3">
              <span class="block font-medium">{{ row.adSet?.name }}</span>
              <span class="text-xs text-[color:var(--muted)]">{{ row.adSet?.id }}</span>
            </td>

            <td v-if="props.level === 'campaigns'" class="px-4 py-3">
              {{ row.adAccount?.name }}
            </td>
            <td v-else-if="props.level === 'ad-sets'" class="px-4 py-3">
              {{ row.campaign?.adAccount.client.nombre }}
            </td>
            <td v-else class="px-4 py-3">
              {{ row.campaign?.name }}
            </td>

            <td class="px-4 py-3">
              <span class="status-chip">{{ row.effectiveStatus || 'unknown' }}</span>
            </td>

            <td class="px-4 py-3 font-medium">
              {{ currency.format(row.metrics.spend || 0) }}
            </td>

            <td v-if="props.level === 'ad-sets'" class="px-4 py-3">
              {{ row.metrics.ctr !== null ? `${row.metrics.ctr.toFixed(2)}%` : '—' }}
            </td>
            <td v-else class="px-4 py-3">
              {{ compact.format(row.metrics.clicks || 0) }}
            </td>

            <td class="px-4 py-3">
              {{ props.level === 'ads' ? compact.format(row.metrics.purchases || 0) : rowResult(row) }}
            </td>

            <td class="px-4 py-3">
              <button
                v-if="props.level !== 'ads'"
                class="btn-secondary px-4 py-2 text-xs"
                @click="emit('drill', row)"
              >
                {{ props.level === 'campaigns' ? 'Abrir ad sets' : 'Abrir ads' }}
              </button>
              <button v-else class="btn-secondary px-4 py-2 text-xs" @click="emit('select', row)">
                Ver panel
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="border-t border-[color:var(--line)] px-4 py-3 text-xs text-[color:var(--muted)]">
      Sort {{ meta?.sortBy ?? 'createdAt' }} / {{ meta?.sortOrder ?? 'desc' }}
    </div>

    <div v-if="pending" class="border-t border-[color:var(--line)] px-4 py-3 text-sm text-[color:var(--muted)]">
      Cargando tabla operativa...
    </div>

    <div v-if="!pending && rows.length === 0" class="border-t border-[color:var(--line)] px-4 py-3 text-sm text-[color:var(--muted)]">
      No hay filas para este nivel y filtro.
    </div>
  </section>
</template>
