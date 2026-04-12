# Nexora - Plataforma Unificada de Publicidad Digital

Gestiona todos tus anuncios de Instagram, Facebook, Google Ads y TikTok desde una única plataforma inteligente.

## 🚀 Características

### Plataforma Usuario
- **Dashboard Unificado**: Ve todas tus campañas en un solo lugar
- **Integraciones Conectadas**: Sincroniza con Instagram, Facebook, Google Ads y TikTok
- **Análisis en Tiempo Real**: ROI, CPC, CTR, conversiones y más
- **Automatización Inteligente**: Reglas personalizadas para optimizar campañas
- **Planes Flexibles**: Desde $30/mes hasta soluciones enterprise
- **Prueba Gratuita**: 14 días de acceso completo sin tarjeta requerida
- **Modo App (PWA)**: Instalable en desktop y móvil, con experiencia standalone

### Panel de Administración
- **Gestión de Usuarios**: Ver, suspender, activar y eliminar usuarios
- **Control de Suscripciones**: Gestionar planes, pausar, reanudar y cancelar
- **Administración de Campañas**: Monitorear y controlar todas las campañas de la plataforma
- **Configuración de Pagos**: Configurar destinos de pago (Stripe, PayPal, cuentas bancarias)
- **Analíticas Globales**: Métricas de toda la plataforma (ingresos, usuarios, campañas)
- **Configuración del Sistema**: Modo mantenimiento, precios por defecto, información legal

## 📲 Modo App (PWA)

Nexora incluye Web App Manifest + Service Worker para abrirse como aplicación standalone.

### Instalar en Chrome / Edge (Desktop)

1. Abre Nexora en producción.
2. Pulsa el icono de instalar en la barra del navegador.
3. Abre Nexora desde el acceso directo como app.

### Instalar en iPhone (Safari)

1. Abre Nexora en Safari.
2. Pulsa Compartir.
3. Selecciona "Agregar a pantalla de inicio".

### Incluye

- Inicio tipo app en `/dashboard/studio-v2`
- Manifest con iconos y modo standalone
- Cache del shell para carga más rápida
- Fallback offline básico

## 📋 Requisitos Previos

- Node.js 18+
- npm o yarn
- PostgreSQL 13+
- Cuentas en plataformas publicitarias (opcional para testing)

## 🛠️ Instalación

### 1. Clonar el repositorio

```bash
cd my-landing-page
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copia el archivo `.env.example` a `.env.local`:

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus datos:

```env
# Database
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/nexora_db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="tu-clave-secreta-aleatoria"

# JWT
JWT_SECRET="tu-jwt-secret-aleatorio"

# Stripe (obtén estas claves en https://dashboard.stripe.com)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."

# OAuth Meta (Instagram/Facebook)
META_APP_ID="123456789012345"
META_APP_SECRET="tu-meta-app-secret"
CONNECT_OAUTH_REDIRECT_BASE_URL="http://localhost:3000"

# API URLs
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
```

Para produccion en Vercel, configura las mismas variables en Project Settings > Environment Variables.
La redirect URI que debes registrar en Meta es:

```text
https://tu-dominio.com/api/connect/oauth/callback
```

### 4. Configurar base de datos

```bash
# Generar cliente Prisma
npm run db:generate

# Ejecutar migraciones
npm run db:migrate

# (Opcional) Seed de datos de prueba
npm run db:seed
```

### 5. Ejecutar en desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## 📚 Estructura del Proyecto

```
src/
├── app/                    # App Router de Next.js
│   ├── api/               # Rutas de API
│   │   ├── auth/          # Autenticación (login, register)
│   │   ├── users/         # Users endpoints
│   │   ├── stripe/        # Pagos y suscripciones
│   │   └── ads/           # Integraciones publicitarias
│   ├── auth/              # Páginas de autenticación
│   ├── dashboard/         # Panel de control
│   ├── layout.tsx         # Layout raíz
│   └── page.tsx           # Página de inicio
├── components/            # Componentes reutilizables
│   ├── Navbar.tsx
│   ├── Hero.tsx
│   ├── Features.tsx
│   ├── Pricing.tsx
│   ├── Demo.tsx
│   ├── FAQ.tsx
│   └── Footer.tsx
├── lib/                   # Utilidades
│   ├── auth.ts           # Funciones de autenticación
│   └── prisma.ts         # Cliente Prisma
├── types/                # TypeScript types
├── utils/                # Funciones helper
└── styles/               # CSS global

prisma/
└── schema.prisma         # Esquema de base de datos

## 👑 Panel de Administración

### Acceso al Admin Panel

El panel de administración está disponible en el subdominio `admin.tudominio.com` y requiere credenciales especiales.

### Funcionalidades del Admin

#### Dashboard
- Estadísticas globales: usuarios totales, ingresos, suscripciones activas
- Gráficos de crecimiento mensual
- Estado del sistema

#### Gestión de Usuarios
- Lista completa de usuarios con filtros
- Acciones: suspender, activar, eliminar
- Ver detalles de usuario y suscripciones

#### Gestión de Suscripciones
- Ver todas las suscripciones activas
- Acciones: pausar, reanudar, cancelar
- Historial de pagos

#### Gestión de Campañas
- Ver todas las campañas de la plataforma
- Control de estado: pausar, reanudar, detener
- Métricas de rendimiento por campaña

#### Configuración de Pagos
- Configurar webhooks de Stripe
- Destinos de pago: cuentas bancarias, PayPal
- Tasas de comisión y pagos mínimos

#### Analíticas Globales
- Ingresos por mes
- Crecimiento de usuarios
- Distribución por plataformas
- Campañas más performantes

#### Configuración del Sistema
- Modo mantenimiento
- Control de nuevos registros
- Precios por defecto
- Información legal y de soporte```

## 🔐 Autenticación

### Registro

```bash
POST /api/auth/register
Content-Type: application/json

{
  "name": "Juan García",
  "email": "juan@example.com",
  "password": "Contraseña123!"
}
```

### Login

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "juan@example.com",
  "password": "Contraseña123!"
}
```

Ambos endpoints retornan un JWT token que debe enviarse en el header `Authorization: Bearer <token>`

## 💳 Sistema de Suscripciones

### Planes

| Plan | Precio/Mes | Precio/Año | Características |
|------|------------|-----------|-----------------|
| **Starter** | $30 | $300 | 3 cuentas, Dashboard básico, Reportes mensuales |
| **Professional** | $79 | $790 | 10 cuentas, Dashboard avanzado, Tiempo real, Automatizaciones |
| **Enterprise** | $199 | $1,990 | Ilimitado, IA avanzada, Soporte VIP 24/7 |

### Crear Sesión de Checkout

```bash
POST /api/stripe/checkout
Authorization: Bearer <token>
Content-Type: application/json

{
  "plan": "professional",
  "billingCycle": "monthly"
}
```

## 🔌 Integraciones Publicitarias

### Estructura de Datos

```typescript
// Ad Account
{
  id: string
  userId: string
  platform: 'instagram' | 'facebook' | 'google' | 'tiktok'
  accountId: string
  accessToken: string (encriptado)
  accountName: string
  connected: boolean
}

// Campaign
{
  id: string
  userId: string
  adAccountId: string
  name: string
  budget: number
  status: 'active' | 'paused' | 'completed'
  startDate: DateTime
  analytics: { impressions, clicks, conversions, spend, roi }
}
```

## 📊 Analytics

Las métricas se sincronizan automáticamente desde las plataformas publicitarias:

- Impresiones
- Clicks (CTR)
- Conversiones
- Gasto total (CPC)
- ROI
- Rendimiento por plataforma

## 🚢 Deployment

### Vercel (Recomendado)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Docker

```bash
docker build -t nexora .
docker run -p 3000:3000 nexora
```

### Variables de entorno en producción

Asegúrate de configurar todas las variables en tu proveedor de hosting (Vercel, Netlify, etc.)

## 🧪 Testing

```bash
# Tests unitarios
npm run test

# Tests con cobertura
npm run test:coverage

# E2E tests
npm run test:e2e
```

## 📖 API Documentation

### Endpoints de Usuario

| Método | Endpoint | Descripción |
|--------|----------|------------|
| POST | `/api/auth/register` | Registrar nuevo usuario |
| POST | `/api/auth/login` | Iniciar sesión |
| GET | `/api/users/me` | Obtener datos del usuario actual |
| POST | `/api/stripe/checkout` | Crear sesión de pago |
| GET | `/api/ads/accounts` | Listar cuentas publicitarias |
| POST | `/api/ads/connect` | Conectar nueva red publicitaria |
| GET | `/api/ads/campaigns` | Listar campañas |
| GET | `/api/ads/analytics` | Obtener analíticas |

### Endpoints de Administración

| Método | Endpoint | Descripción |
|--------|----------|------------|
| GET | `/api/admin/me` | Verificar acceso admin |
| GET | `/api/admin/stats` | Estadísticas del dashboard |
| GET | `/api/admin/users` | Listar todos los usuarios |
| POST | `/api/admin/users/[userId]/[action]` | Acciones en usuarios |
| GET | `/api/admin/subscriptions` | Listar todas las suscripciones |
| POST | `/api/admin/subscriptions/[subId]/[action]` | Acciones en suscripciones |
| GET | `/api/admin/campaigns` | Listar todas las campañas |
| POST | `/api/admin/campaigns/[campId]/[action]` | Acciones en campañas |
| GET | `/api/admin/analytics` | Analíticas globales |
| GET/PUT | `/api/admin/payment-settings` | Configuración de pagos |
| GET/PUT | `/api/admin/settings` | Configuración del sistema |

## 🤝 Estado del Desarrollo

### ✅ Completado
- [x] Landing page completa con todas las secciones
- [x] Sistema de autenticación JWT
- [x] Dashboard de usuario funcional
- [x] Integración con Stripe para pagos
- [x] Base de datos PostgreSQL con Prisma
- [x] Panel de administración completo
- [x] Gestión de usuarios y suscripciones
- [x] Configuración de destinos de pago
- [x] Analíticas globales de plataforma
- [x] Sistema de configuración del admin

### 🔄 Próximas Características
- [ ] Integración con Instagram Ads API
- [ ] Integración con Facebook Ads API
- [ ] Integración con Google Ads API
- [ ] Integración con TikTok Ads API
- [ ] Automatización avanzada con IA
- [ ] Reportes personalizados
- [ ] Webhooks para actualizaciones en tiempo real
- [ ] Equipo y permisos
- [ ] Dark mode
- [ ] Múltiples idiomas

## 📝 Licencia

Propietario - Nexora Inc.

## 💬 Soporte

- Email: support@nexora.com
- Chat: Via dashboard
- Docs: https://docs.nexora.ai

## 👨‍💻 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 🆘 Troubleshooting

### Error: "PostgreSQL connection refused"
- Verifica que PostgreSQL está corriendo
- Comprueba la CONNECTION_STRING en .env.local
- Intenta: `psql postgres://user:password@localhost/dbname`

### Error: "NEXTAUTH_SECRET not configured"
- Genera una clave aleatoria: `openssl rand -base64 32`
- Añádela a .env.local

### Error: "Stripe keys not found"
- Obtén tus claves en https://dashboard.stripe.com/apikeys
- Configúralas en .env.local
- Para testing usa claves de test mode

### Error: "Falta META_APP_ID o FACEBOOK_APP_ID"
- Configura `META_APP_ID` (o `FACEBOOK_APP_ID`) con valor real, no `placeholder`
- Verifica `CONNECT_OAUTH_REDIRECT_BASE_URL` (local: `http://localhost:3000`, prod: tu dominio real)
- En Meta App Dashboard agrega exactamente la callback: `/api/connect/oauth/callback`
- Si usas Vercel, añade estas variables tambien en Environment Variables y redeploy

---

¡Gracias por usar Nexora! 🎉
