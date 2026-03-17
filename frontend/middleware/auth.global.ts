export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();

  if (to.path === '/login') {
    return;
  }

  if (!auth.token.value) {
    return navigateTo('/login');
  }

  if (!auth.user.value) {
    try {
      await auth.fetchMe();
    } catch {
      auth.logout();
      return navigateTo('/login');
    }
  }
});
