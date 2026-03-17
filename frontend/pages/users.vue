<script setup lang="ts">
const api = useApi();
const auth = useAuthStore();

if (auth.user.value?.role !== 'admin') {
  await navigateTo('/');
}

const { data: users } = await useAsyncData('users', () => api('/users'));
</script>

<template>
  <div class="space-y-6">
    <section class="panel p-6">
      <p class="text-xs uppercase tracking-[0.35em] text-[color:var(--muted)]">
        Administracion
      </p>
      <h1 class="mt-3 text-4xl font-semibold">Usuarios y roles</h1>
      <p class="mt-3 max-w-2xl text-[color:var(--muted)]">
        Control base de admins y responsables comerciales con visibilidad de asignaciones.
      </p>
    </section>

    <section class="panel overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-stone-900 text-stone-100">
            <tr>
              <th class="px-4 py-3">Nombre</th>
              <th class="px-4 py-3">Email</th>
              <th class="px-4 py-3">Rol</th>
              <th class="px-4 py-3">Clientes asignados</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in users"
              :key="item.id"
              class="border-t border-[color:var(--line)]"
            >
              <td class="px-4 py-3 font-medium">{{ item.nombre }}</td>
              <td class="px-4 py-3">{{ item.email }}</td>
              <td class="px-4 py-3">{{ item.role }}</td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="assignment in item.assignments"
                    :key="assignment.id"
                    class="rounded-full bg-stone-200 px-3 py-1 text-xs"
                  >
                    {{ assignment.client.nombre }}
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
