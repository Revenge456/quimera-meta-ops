<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
  hint: string;
}>();
</script>

<template>
  <section class="panel p-5">
    <p class="text-sm text-[color:var(--muted)]">{{ label }}</p>
    <p class="mt-3 text-3xl font-semibold">{{ value }}</p>
    <p class="mt-2 text-sm text-[color:var(--muted)]">{{ hint }}</p>
  </section>
</template>
