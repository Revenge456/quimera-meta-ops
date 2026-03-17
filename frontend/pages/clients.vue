<script setup lang="ts">
const api = useApi();
const auth = useAuthStore();
const search = ref('');
const estado = ref('');

const key = computed(() => `clients:${search.value}:${estado.value}`);

const { data: clients, refresh, pending } = await useAsyncData(key, () =>
  api('/clients', {
    query: {
      ...(search.value ? { search: search.value } : {}),
      ...(estado.value ? { estado: estado.value } : {}),
    },
  }),
);
</script>

<template>
  <div class="space-y-6">
    <section class="panel p-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="text-xs uppercase tracking-[0.35em] text-[color:var(--muted)]">
            Operacion comercial
          </p>
          <h1 class="mt-3 text-4xl font-semibold">Clientes</h1>
          <p class="mt-3 max-w-2xl text-[color:var(--muted)]">
            Vista base para administrar cartera y validar que los permisos por cliente
            se apliquen desde backend.
          </p>
        </div>
      </div>

      <div class="mt-6 grid gap-3 md:grid-cols-[1fr_220px_auto]">
        <input
          v-model="search"
          class="field"
          type="text"
          placeholder="Buscar por nombre o empresa"
        />
        <select v-model="estado" class="field">
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="archived">Archivados</option>
        </select>
        <button class="btn-primary" @click="refresh()">Aplicar filtros</button>
      </div>
    </section>

    <section class="panel overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-stone-900 text-stone-100">
            <tr>
              <th class="px-4 py-3">Cliente</th>
              <th class="px-4 py-3">Empresa</th>
              <th class="px-4 py-3">Estado</th>
              <th class="px-4 py-3">Asignados</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="client in clients"
              :key="client.id"
              class="border-t border-[color:var(--line)]"
            >
              <td class="px-4 py-3 font-medium">{{ client.nombre }}</td>
              <td class="px-4 py-3">{{ client.empresa }}</td>
              <td class="px-4 py-3">
                <span class="rounded-full bg-stone-200 px-3 py-1 text-xs uppercase tracking-[0.2em]">
                  {{ client.estado }}
                </span>
              </td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="assignment in client.assignments"
                    :key="assignment.id"
                    class="rounded-full bg-cyan-100 px-3 py-1 text-xs"
                  >
                    {{ assignment.user.nombre }}
                  </span>
                  <span v-if="client.assignments.length === 0" class="text-[color:var(--muted)]">
                    Sin asignaciones
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="pending" class="border-t border-[color:var(--line)] px-4 py-3 text-sm text-[color:var(--muted)]">
        Cargando clientes...
      </div>
      <div
        v-if="!pending && clients && clients.length === 0"
        class="border-t border-[color:var(--line)] px-4 py-3 text-sm text-[color:var(--muted)]"
      >
        No hay clientes para este filtro. Si eres comercial, recuerda que solo veras los clientes asignados.
      </div>
    </section>

    <section v-if="auth.user.value?.role === 'admin'" class="panel p-6">
      <p class="text-sm text-[color:var(--muted)]">
        La gestion de alta de clientes y asignaciones ya existe en API. La operacion publicitaria
        diaria ya vive en la vista Ads Manager.
      </p>
    </section>
  </div>
</template>
