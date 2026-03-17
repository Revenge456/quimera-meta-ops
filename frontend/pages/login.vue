<script setup lang="ts">
const auth = useAuthStore();
const email = ref('admin@quimera.local');
const password = ref('admin123456');
const errorMessage = ref('');
const loading = ref(false);

watchEffect(async () => {
  if (auth.token.value) {
    await navigateTo('/');
  }
});

const onSubmit = async () => {
  loading.value = true;
  errorMessage.value = '';

  try {
    await auth.login(email.value, password.value);
    await navigateTo('/');
  } catch {
    errorMessage.value = 'No se pudo iniciar sesion. Revisa tus credenciales.';
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4 py-10">
    <div class="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section class="panel p-8 lg:p-10">
        <p class="text-xs uppercase tracking-[0.35em] text-[color:var(--muted)]">
          Plataforma interna
        </p>
        <h1 class="mt-4 max-w-xl text-5xl font-semibold leading-tight">
          Sistema operativo de marketing para Quimera.
        </h1>
        <p class="mt-6 max-w-xl text-lg text-[color:var(--muted)]">
          Fase 1 lista para operar autenticacion, permisos por cliente y trazabilidad
          administrativa desde una sola base.
        </p>
      </section>

      <section class="panel p-8">
        <h2 class="text-2xl font-semibold">Iniciar sesion</h2>
        <p class="mt-2 text-sm text-[color:var(--muted)]">
          Usa los usuarios seed para validar el flujo inicial.
        </p>

        <form class="mt-6 space-y-4" @submit.prevent="onSubmit">
          <div>
            <label class="mb-2 block text-sm font-medium">Email</label>
            <input v-model="email" type="email" class="field" />
          </div>

          <div>
            <label class="mb-2 block text-sm font-medium">Password</label>
            <input v-model="password" type="password" class="field" />
          </div>

          <p v-if="errorMessage" class="text-sm text-red-700">{{ errorMessage }}</p>

          <button class="btn-primary w-full" :disabled="loading">
            {{ loading ? 'Entrando...' : 'Entrar' }}
          </button>
        </form>
      </section>
    </div>
  </div>
</template>
