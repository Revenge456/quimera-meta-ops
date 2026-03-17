<script setup lang="ts">
const auth = useAuthStore();
const route = useRoute();

const links = computed(() => [
  { to: '/', label: 'Ads Manager' },
  { to: '/ai-history', label: 'AI History' },
  { to: '/clients', label: 'Clientes' },
  ...(auth.user.value?.role === 'admin'
    ? [
        { to: '/users', label: 'Usuarios' },
        { to: '/system-health', label: 'Salud' },
      ]
    : []),
]);

const onLogout = async () => {
  auth.logout();
  await navigateTo('/login');
};
</script>

<template>
  <div v-if="route.path === '/login'">
    <slot />
  </div>

  <div v-else class="mx-auto flex min-h-screen max-w-7xl gap-6 px-4 py-6 lg:px-6">
    <aside class="panel hidden w-72 shrink-0 p-5 lg:block">
      <div class="mb-8">
        <p class="text-xs uppercase tracking-[0.35em] text-[color:var(--muted)]">
          Quimera
        </p>
        <h1 class="mt-2 text-2xl font-semibold">Ads Manager</h1>
        <p class="mt-2 text-sm text-[color:var(--muted)]">
          Catalogo, performance y lectura operativa desde la base propia.
        </p>
      </div>

      <nav class="space-y-2">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="block rounded-2xl px-4 py-3 transition"
          :class="route.path === link.to ? 'bg-stone-900 text-white' : 'bg-white/50 hover:bg-white'"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>

      <div class="mt-8 rounded-2xl bg-stone-950 px-4 py-4 text-stone-100">
        <p class="text-sm font-medium">{{ auth.user.value?.nombre }}</p>
        <p class="text-xs uppercase tracking-[0.2em] text-stone-400">
          {{ auth.user.value?.role }}
        </p>
        <button class="btn-secondary mt-4 w-full text-stone-900" @click="onLogout">
          Cerrar sesion
        </button>
      </div>
    </aside>

    <main class="min-w-0 flex-1">
      <slot />
    </main>
  </div>
</template>
