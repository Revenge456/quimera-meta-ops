# Quimera Meta Ops

Plataforma operativa y analitica para gestion interna de cuentas publicitarias.

## Workspaces

- `backend`: NestJS + Prisma + PostgreSQL
- `frontend`: Nuxt 4 + Vue 3 + Tailwind CSS

## Inicio rapido

1. Instalar dependencias:

```bash
npm install
```

2. Copiar variables de entorno:

```bash
copy backend\\.env.example backend\\.env
copy frontend\\.env.example frontend\\.env
```

3. Ejecutar migraciones y seed:

```bash
npm run prisma:migrate -w backend
npm run prisma:seed -w backend
```

4. Levantar los proyectos:

```bash
npm run dev:backend
npm run dev:frontend
```
