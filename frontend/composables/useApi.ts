export function useApi() {
  const config = useRuntimeConfig();
  const auth = useAuthStore();

  return $fetch.create({
    baseURL: config.public.apiBase,
    headers: auth.token.value
      ? {
          Authorization: `Bearer ${auth.token.value}`,
        }
      : undefined,
  });
}
