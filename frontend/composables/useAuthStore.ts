type SessionUser = {
  id?: string;
  sub?: string;
  email: string;
  nombre: string;
  role: 'admin' | 'commercial_manager';
  active?: boolean;
};

export function useAuthStore() {
  const token = useState<string | null>('auth-token', () => null);
  const user = useState<SessionUser | null>('auth-user', () => null);

  if (import.meta.client && !token.value) {
    token.value = localStorage.getItem('quimera-token');
    const rawUser = localStorage.getItem('quimera-user');
    user.value = rawUser ? (JSON.parse(rawUser) as SessionUser) : null;
  }

  const persistSession = (nextToken: string, nextUser: SessionUser) => {
    token.value = nextToken;
    user.value = nextUser;
    if (import.meta.client) {
      localStorage.setItem('quimera-token', nextToken);
      localStorage.setItem('quimera-user', JSON.stringify(nextUser));
    }
  };

  const login = async (email: string, password: string) => {
    const api = useApi();
    const response = await api<{
      accessToken: string;
      user: SessionUser;
    }>('/auth/login', {
      method: 'POST',
      body: {
        email,
        password,
      },
    });

    persistSession(response.accessToken, response.user);
    return response;
  };

  const fetchMe = async () => {
    const api = useApi();
    const response = await api<SessionUser>('/auth/me');
    user.value = response;
    if (import.meta.client) {
      localStorage.setItem('quimera-user', JSON.stringify(response));
    }
    return response;
  };

  const logout = () => {
    token.value = null;
    user.value = null;
    if (import.meta.client) {
      localStorage.removeItem('quimera-token');
      localStorage.removeItem('quimera-user');
    }
  };

  return {
    token,
    user,
    login,
    fetchMe,
    logout,
  };
}
