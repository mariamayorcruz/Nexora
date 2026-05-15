# Nexora — Claude Code Guidelines

## Stack
- Next.js 14 App Router
- TypeScript estricto
- Prisma + Supabase PostgreSQL
- Tailwind CSS
- Vercel deployment

## Reglas absolutas

### Antes de cualquier cambio
1. Leer el archivo completo antes de editar
2. Identificar exactamente qué líneas cambiar
3. NO reescribir archivos completos — solo editar lo necesario
4. Verificar imports existentes antes de agregar nuevos

### Después de cualquier cambio
1. Ejecutar: npx tsc --noEmit
2. Ejecutar: npm run build
3. Si el build falla — revertir el cambio inmediatamente
4. NO hacer git push si el build falla

### Encoding
- Todos los archivos son UTF-8
- Nunca usar caracteres escapados como Ã³ Â· â€"
- Usar directamente: ó · — ¿ ¡ á é í ú ñ

### Sistema visual
- Fondo: #05080f / #040810 / #030610
- Acento: #06b6d4 (cyan-500)
- Sin borders blancos visibles
- Rounded corners: rounded-[20px] a rounded-[28px]
- Símbolo de marca: ✦

### Patrones prohibidos
- NO usar localStorage para persistencia crítica
- NO hardcodear IDs de usuarios
- NO crear archivos en /mnt/ o rutas del sistema
- NO modificar prisma/schema.prisma sin instrucción explícita
- NO modificar middleware.ts sin instrucción explícita
- NO tocar archivos de auth sin instrucción explícita

### Patrones requeridos
- Siempre usar getUserIdFromAuthorizationHeader para auth en APIs
- Siempre usar prisma de @/lib/prisma
- Variables de entorno solo via process.env
- Componentes client-side: agregar 'use client' al inicio

### APIs
- Auth: Bearer token en header Authorization
- Respuestas: NextResponse.json()
- Errores: { error: string } con status code apropiado

### Git
- Commits descriptivos en inglés
- NO hacer force push
- Siempre push a main
- Un commit por feature/fix

## Estructura de carpetas clave
- /src/app/dashboard/ — páginas del dashboard
- /src/app/api/ — API routes
- /src/components/ — componentes reutilizables
- /src/lib/ — utilidades y helpers
- /src/app/auth/ — páginas de autenticación
- /src/app/admin/ — panel admin interno

## Variables de entorno necesarias
Están en .env.local y Vercel:
- DATABASE_URL
- ANTHROPIC_API_KEY
- GROQ_API_KEY
- FAL_KEY
- GEMINI_API_KEY
- TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- NEXT_PUBLIC_GOOGLE_CLIENT_ID
- ADMIN_SECRET

## Comandos útiles
- npm run dev — desarrollo local
- npm run build — verificar build
- npx tsc --noEmit — verificar tipos
- npx prisma studio — ver base de datos
