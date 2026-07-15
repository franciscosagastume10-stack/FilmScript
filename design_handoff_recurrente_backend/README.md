# Handoff: verificación real de pagos con Recurrente para FilmScript

## Resumen
FilmScript es un editor de guiones con un asistente de IA llamado Lumiere. Su plan de pago se llama FilmScript Pro ($20 al mes) e incluye todas las funciones. El identificador interno `lumiere` se conserva por compatibilidad con suscripciones existentes. Este documento describe el backend que verifica la transacción y activa FilmScript Pro solo cuando Recurrente confirma el pago.

## Sobre los archivos de diseño
`FilmScript.dc.html` es una referencia de diseño construida en HTML. Muestra la apariencia y el comportamiento esperado, pero no es código de producción. La tarea es recrear este flujo en el stack real del equipo (Node, Next.js, Rails, Laravel, o el que se prefiera) conectado a la API de Recurrente. Fidelidad: alta. Los colores, tipografías y estados que se ven en el prototipo son los finales.

## Qué es real y qué es simulado hoy
Real (mantener tal cual):
- Toda la interfaz: landing con precios, modal de checkout, estado bloqueado de Lumiere en el editor, panel de cuenta en el avatar.
- El botón "Pay with Recurrente" abre el checkout real de FilmScript Pro.

Simulado (reemplazar con el backend):
- El botón "Mark as paid (prototype)" activa el plan sin verificar nada. Existe solo porque el prototipo no puede recibir webhooks.
- El prototipo antiguo guardaba el plan en `localStorage`; la implementación actual usa el backend y mantiene `lumiere` como identificador interno de FilmScript Pro.
- El registro con Google o email no crea cuentas reales.

## Arquitectura objetivo
1. El usuario, ya autenticado, elige un plan.
2. El frontend llama a `POST /api/checkout` del backend propio con el plan elegido.
3. El backend crea la sesión de cobro en la API de Recurrente y recibe una `checkout_url`. Redirige al usuario ahí.
4. El usuario paga en la página segura de Recurrente.
5. Recurrente envía un webhook al backend avisando que el pago se completó.
6. El backend verifica el webhook, reconsulta la transacción en la API como capa extra, guarda el plan activo en la base de datos, y desde ese momento `GET /api/me` devuelve el plan real. La app desbloquea Lumiere leyendo ese endpoint.

## Paso a paso

### 1. Requisitos previos
- Un servidor propio desplegado (Railway, Render, Fly.io, Vercel con API routes, o similar). Los webhooks requieren una URL pública HTTPS.
- Una base de datos (Postgres o Supabase funcionan bien).
- Autenticación real de usuarios (email y contraseña, o OAuth de Google). Sin cuentas no hay forma de saber de quién es cada pago.

### 2. Llaves de API
En el panel de Recurrente: Configuración, luego Llaves API. Ahí están la llave pública y la secreta. La autenticación con la API se hace enviando los headers `X-PUBLIC-KEY` y `X-SECRET-KEY` en cada request. La Secret Key vive solo en variables de entorno del servidor. Nunca en el frontend ni en el repositorio.

Nota: la llave de prueba que se generó durante el diseño de este prototipo quedó expuesta en un chat. Regenerarla antes de salir a producción.

### 3. `POST /api/checkout`
Recibe `{ plan: "lumiere" }` del frontend (usuario autenticado). Ese identificador representa FilmScript Pro.

El servidor llama a la API de Recurrente para crear la sesión de compra del producto correspondiente y recibe de vuelta una `checkout_url`. Responde al frontend con esa URL para redirigir al usuario.

Recomendación: crear FilmScript Pro como producto de suscripción en el panel de Recurrente y referenciarlo por id, en lugar de mandar montos sueltos.

Guardar en base de datos un registro pendiente: usuario, plan solicitado, id del checkout, fecha.

### 4. `POST /api/webhooks/recurrente`
Configurar esta URL como destino de webhooks en el panel de Recurrente.

Cuando llegue el evento de pago completado:
1. Verificar la firma del webhook según la documentación de Recurrente antes de confiar en el contenido. Rechazar con 401 si no valida.
2. Reconsultar el estado de la transacción directamente en la API de Recurrente usando el id que trae el evento. Esta doble verificación es la práctica que la propia documentación de Recurrente recomienda antes de entregar el producto.
3. Solo entonces marcar en base de datos: `subscriptions.status = active`, plan, id de suscripción de Recurrente, fecha.
4. Responder 200 rápido. Procesar en segundo plano si hace falta. Hacer el handler idempotente: si el mismo evento llega dos veces, no duplicar nada.

Manejar también los eventos de pago fallido y de cancelación de suscripción para desactivar el plan.

### 5. `GET /api/me`
Devuelve `{ email, plan: "lumiere" | null }` leyendo la base de datos. `lumiere` es el identificador compatible de FilmScript Pro. El frontend lo consulta al cargar y después de volver del checkout.

### 6. `POST /api/subscription/cancel`
Llama a la API de Recurrente para cancelar la suscripción del usuario y actualiza la base de datos. Conecta con el botón "Cancel FilmScript Pro" del panel de cuenta.

## Esquema mínimo de base de datos
- `users`: id, email, nombre, fecha de creación.
- `subscriptions`: id, user_id, plan (`lumiere`, identificador interno de FilmScript Pro), status (`pending`, `active`, `canceled`, `past_due`), recurrente_checkout_id, recurrente_subscription_id, updated_at.

## Puntos de conexión en FilmScript.dc.html
- `PAY_LINKS` (constante en la clase): hoy tiene el link directo del plan Writer y `null` para Lumiere. En producción se reemplaza por la llamada a `POST /api/checkout`.
- `confirmCheckout` (botón "Mark as paid (prototype)"): eliminar. El paso de éxito del modal debe mostrarse solo cuando `GET /api/me` confirme el plan activo tras volver del pago.
- `_setPlan` y la llave `filmscript_plan` de localStorage: reemplazar por el estado que devuelve `GET /api/me`.
- `lumiereUnlocked` (en `renderVals`): hoy es `plan === 'lumiere'` leído localmente. Mantener la misma condición pero alimentada por el backend.
- Panel de cuenta (avatar): "Cancel FilmScript Pro" llama al endpoint real.
- Modal de registro: sustituir por la autenticación real.

## Variables de entorno
- `RECURRENTE_PUBLIC_KEY`
- `RECURRENTE_SECRET_KEY`
- `RECURRENTE_WEBHOOK_SECRET` (el secreto de firma del endpoint de webhooks)
- `APP_URL` (para las URLs de retorno del checkout)
- `DATABASE_URL`

## Pruebas
Recurrente ofrece un ambiente sandbox con credenciales separadas para probar todo el flujo sin procesar pagos reales, incluyendo webhooks. Probar ahí: pago exitoso, pago fallido, webhook duplicado, cancelación. Si se hace una prueba en producción, reembolsar el mismo día (los reembolsos del mismo día son al 100%).

## Implementación incluida en este proyecto
El servidor local ya incluye `POST /api/checkout`, `POST /api/webhooks/recurrente`, `POST /api/billing/sync`, `GET /api/me` y `POST /api/subscription/cancel`. El estado de desarrollo se persiste en `billing.json`, el webhook valida la firma Svix y los pagos exitosos se revalidan contra `GET /api/checkouts/:id` antes de activar el plan. Copia `.env.example` a `.env`, agrega las llaves de Recurrente y registra `https://TU_DOMINIO/api/webhooks/recurrente` en el panel de Recurrente. En producción, reemplaza la persistencia JSON por Postgres/Supabase y usa HTTPS.

## Checklist de salida a producción
1. Llaves de producción en variables de entorno, la de prueba expuesta regenerada.
2. Webhook configurado con URL HTTPS pública y verificación de firma activa.
3. Doble verificación: firma del webhook + reconsulta del estado en la API.
4. Handler de webhooks idempotente.
5. `GET /api/me` como única fuente de verdad del plan. Nada de localStorage.
6. Eventos de fallo y cancelación desactivan el plan.
7. Flujo completo probado en sandbox.

## Archivos
- `FilmScript.dc.html`: prototipo completo (landing, precios, checkout, editor, Lumiere bloqueado y desbloqueado, panel de cuenta).
