# Nexora Project Instructions

## Project Overview

Nexora es una plataforma SaaS fullstack de código abierto para gestionar campañas publicitarias unificadas desde Instagram Ads, Facebook Ads, Google Ads y TikTok Ads.

**Stack Tecnológico:**
- Frontend: Next.js 14 con TypeScript, Tailwind CSS
- Backend: Node.js con Next.js API Routes
- Base de datos: PostgreSQL con Prisma ORM
- Autenticación: JWT + bcrypt
- Pagos: Stripe
- Hosting: Vercel (recomendado)

## Proyecto Completado

### ✅ Estructura Completada

#### Landing Page
- ✓ Hero section con CTA principal
- ✓ Sección de características (6 features)
- ✓ Video demo interactivo
- ✓ Tabla de precios (Starter, Professional, Enterprise)
- ✓ FAQ con 6 preguntas frecuentes
- ✓ Footer con enlaces

#### Autenticación
- ✓ Sistema de registro (GET /api/auth/register)
- ✓ Sistema de login (GET /api/auth/login)
- ✓ JWT tokens
- ✓ Hash de contraseñas con bcrypt
- ✓ Validación de email y contraseña

#### Dashboard
- ✓ Panel principal con estadísticas
- ✓ Sidebar navegable con 6 sections
- ✓ Página de Conectar Redes (4 plataformas)
- ✓ Página de Campañas con listado
- ✓ Página de Analíticas con métricas
- ✓ Página de Facturación con planes
- ✓ Página de Configuración
- ✓ Layout responsive (mobile + desktop)

#### Base de Datos
- ✓ Schema Prisma con 7 modelos
- ✓ User model con autenticación
- ✓ Subscription model para planes
- ✓ AdAccount model para conexiones
- ✓ Campaign model para campañas
- ✓ Analytics model para métricas
- ✓ Invoice model para facturación
- ✓ VerificationToken modelo

#### Integraciones
- ✓ Stripe checkout integration setup
- ✓ Estructura lista para OAuth (Instagram, Facebook, Google, TikTok)
- ✓ Endpoints de API listos
- ✓ Seed data de prueba

### 🔧 Configuración Necesaria

Antes de usar la aplicación, completa estos pasos:

#### 1. Base de Datos PostgreSQL
```bash
# En Windows con WSL/terminal:
# Instala PostgreSQL o usa Docker:
docker run --name postgres-nexora -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:latest

# Crea la base de datos:
createdb nexora_db
```

#### 2. Variables de Entorno
```bash
cp .env.example .env.local
# Edita .env.local con tus datos
```

#### 3. Instalar Dependencias
```bash
npm install
```

#### 4. Configurar Base de Datos
```bash
# Generar Prisma Client
npm run db:generate

# Ejecutar migraciones
npm run db:migrate

# (Opcional) Cargar datos de prueba
npm run db:seed
```

#### 5. Stripe Setup
- Ve a https://dashboard.stripe.com/apikeys
- Obtén tus claves de TEST
- Configúralas en .env.local:
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`
  - `STRIPE_SECRET_KEY=sk_test_...`

### 🚀 Próximos Pasos

1. **Integraciones OAuth**
   - Instagram Ads OAuth flow
   - Facebook Ads OAuth flow
   - Google Ads OAuth flow
   - TikTok Ads OAuth flow

2. **API para Sincronización**
   - Endpoints para sync de campañas
   - Endpoints para sync de analíticas
   - Webhooks para actualizaciones

3. **Características Avanzadas**
   - IA para recomendaciones
   - Automatización de presupuestos
   - Reportes personalizados
   - Equipo y permisos

4. **Mejoras UI/UX**
   - Gráficos de analíticas (Chart.js)
   - Tablas avanzadas
   - Notificaciones en tiempo real
   - Dark mode

### 📊 URLs Importantes

- Landing: `http://localhost:3000/`
- Login: `http://localhost:3000/auth/login`
- Signup: `http://localhost:3000/auth/signup`
- Dashboard: `http://localhost:3000/dashboard`

### 🧪 Credenciales de Prueba

Después de ejecutar `npm run db:seed`:
- Email: `demo@example.com`
- Contraseña: `DemoUser123!`

### 📚 Estructura de Archivos Importante

```
src/
├── app/api/auth/          # Autenticación
├── app/api/stripe/        # Pagos
├── app/auth/              # Páginas login/signup
├── app/dashboard/         # Dashboard
├── components/            # Componentes reutilizables
├── lib/auth.ts            # Funciones de autenticación
├── lib/prisma.ts          # Cliente Prisma
└── types/index.ts         # TypeScript types
```

### 🔗 Integraciones Pendientes

Para conectar las plataformas publicitarias, necesitarás:

1. **Instagram Ads**
   - App ID y Secret de Meta
   - OAuth redirect URI

2. **Facebook Ads**
   - App ID y Secret
   - Permisos: `ads_read`, `ads_management`

3. **Google Ads**
   - OAuth credentials
   - Developer token

4. **TikTok Ads**
   - Client ID y Secret
   - OAuth permissions

### 🚀 Deployment

Para deployar en Vercel:
```bash
vercel
```

Configura las variables de entorno en Vercel dashboard y ejecuta migrations:
```bash
vercel env pull
npm run db:migrate:deploy
```

---

**Última actualización:** 2024
**Versión:** 0.1.0 (MVP)
