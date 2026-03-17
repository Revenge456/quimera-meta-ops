<script setup lang="ts">
const api = useApi();
const auth = useAuthStore();

if (auth.user.value?.role !== 'admin') {
  await navigateTo('/');
}

const { data: logs } = await useAsyncData('system-logs', () =>
  api('/system-logs', {
    query: {
      page: 1,
      pageSize: 20,
    },
  }),
);
</script>

<template>
  <div class="space-y-6">
    <section class="panel p-6">
      <p class="text-xs uppercase tracking-[0.35em] text-[color:var(--muted)]">
        Observabilidad
      </p>
      <h1 class="mt-3 text-4xl font-semibold">Salud del sistema</h1>
      <p class="mt-3 max-w-2xl text-[color:var(--muted)]">
        Vista inicial de logs estructurados para monitorear autenticacion, usuarios y
        asignaciones.
      </p>
    </section>

    <section class="panel overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-stone-900 text-stone-100">
            <tr>
              <th class="px-4 py-3">Fecha</th>
              <th class="px-4 py-3">Nivel</th>
              <th class="px-4 py-3">Modulo</th>
              <th class="px-4 py-3">Evento</th>
              <th class="px-4 py-3">Mensaje</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in logs?.data ?? []"
              :key="item.id"
              class="border-t border-[color:var(--line)]"
            >
              <td class="px-4 py-3">{{ new Date(item.createdAt).toLocaleString() }}</td>
              <td class="px-4 py-3 uppercase">{{ item.level }}</td>
              <td class="px-4 py-3">{{ item.module }}</td>
              <td class="px-4 py-3">{{ item.eventName }}</td>
              <td class="px-4 py-3">{{ item.message }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
