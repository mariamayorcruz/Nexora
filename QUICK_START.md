# 🚀 Inicio Rápido - Nexora

## Opción 1: Con Docker (Recomendado)

```bash
# 1. Asegúrate de tener Docker instalado
# 2. Inicia los servicios
docker-compose up

# 3. En otra terminal, ejecuta las migraciones
docker exec nexora-app npm run db:migrate

# 4. (Opcional) Carga datos de demostración
docker exec nexora-app npm run db:seed

# 5. Abre http://localhost:3000
```

### Credenciales de demostración (después de correr seed):
- **Email:** demo@example.com
- **Password:** DemoUser123!

## Opción 2: Instalación Manual

### Requisitos
- Node.js 18+
- PostgreSQL 13+
- npm o yarn

### Pasos

```bash
# 1. Clona el repositorio
cd my-landing-page

# 2. Instala dependencias
npm install

# 3. Configura variables de entorno
cp .env.example .env.local

# 4. Configura PostgreSQL
# En Windows:
# Opción A: Usando PostgreSQL instalado localmente
SET DATABASE_URL=postgresql://postgres:password@localhost:5432/nexora_db

# Opción B: Usando Docker solo para DB
docker run --name postgres-nexora -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:15-alpine

# 5. Inicializa la base de datos
npm run db:generate
npm run db:migrate

# 6. (Opcional) Carga datos de demostración
npm run db:seed

# 7. Inicia el servidor
npm run dev

# 8. Abre http://localhost:3000
```

## URLs Importantes

- **Landing Page:** http://localhost:3000
- **Login:** http://localhost:3000/auth/login
- **Signup:** http://localhost:3000/auth/signup
- **Dashboard:** http://localhost:3000/dashboard

## Principales Características

✅ Landing page moderna
✅ Autenticación con JWT
✅ Dashboard interactivo
✅ 3 planes de precios
✅ Integración Stripe
✅ Estructura para OAuth (Instagram, Facebook, Google, TikTok)

## Próximas Acciones

1. **Configura Stripe:**
   - Ve a https://dashboard.stripe.com/apikeys
   - Obtén tus claves de test
   - Actualiza `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` y `STRIPE_SECRET_KEY`

2. **Implementa OAuth:**
   - Instagram Ads
   - Facebook Ads
   - Google Ads
   - TikTok Ads

3. **Personaliza:**
   - Cambia colores en `tailwind.config.ts`
   - Actualiza contenido en componentes
   - Añade tu logo

## Problemas Comunes

### PostgreSQL connection refused
```bash
# Verifica que PostgreSQL está corriendo
# Si usas Docker:
docker ps | grep postgres

# Si usas Local:
psql -U postgres -d nexora_db
```

### Puerto 3000 en uso
```bash
npm run dev -- -p 3001
```

### Node modules error
```bash
rm -rf node_modules
npm install
```

## Estructura de Carpetas

```
src/
├── app/                 # Next.js App Router
│   ├── api/            # API endpoints
│   ├── auth/           # Login/Signup
│   ├── dashboard/      # Panel de control
│   └── page.tsx        # Home
├── components/         # Componentes React
├── lib/               # Utilidades
├── styles/            # CSS global
└── types/             # TypeScript

public/                # Assets públicos
prisma/               # Base de datos
```

## Comandos Útiles

```bash
# Desarrollo
npm run dev

# Build
npm run build

# Producción
npm run start

# Linting
npm run lint

# Base de datos
npm run db:generate    # Generar Prisma Client
npm run db:migrate     # Ejecutar migraciones
npm run db:seed        # Datos de prueba
npm run db:studio      # Abrir Prisma Studio en http://localhost:5555

# Docker
docker-compose up      # Inicia servicios
docker-compose down    # Para servicios
docker-compose logs    # Ve los logs
```

## 📞 Soporte

- 📖 [Documentación completa](README.md)
- 🐛 Reporte issues en GitHub
- 💬 [Documentación de Copilot](#github-copilot-instructions)

¡Listo! Ahora puedes comenzar a desarrollar. 🎉
