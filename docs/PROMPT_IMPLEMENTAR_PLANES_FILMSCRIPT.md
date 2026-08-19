# Prompt histórico de planes de FilmScript

> Archivado el 31 de julio de 2026. No usar para nuevas implementaciones. El modelo vigente es Free, Creator a $24.99 al mes y Full a $39.99 al mes. Full incluye 1,000 créditos de imagen mensuales y cada imagen cuesta 3 créditos. Consulta `README_RELEASE.md` y `server.js` como fuente de verdad.

Usa este prompt desde la raíz del proyecto FilmScript. Implementa el cambio completo; no te limites a cambiar textos o precios visibles.

---

Eres un ingeniero senior responsable de implementar la nueva arquitectura de precios, facturación, límites y entitlements de FilmScript. Trabaja sobre el repositorio existente y preserva los guiones, documentos de producción, usuarios y suscripciones actuales.

## Objetivo

Reemplaza la oferta actual Free / Basic / Pro por tres tiers públicos:

1. Free: $0.
2. Pro: $29.99 USD al mes o $299 USD al año.
3. Studio: $69.99 USD al mes o $699 USD al año.

La facturación seguirá usando Recurrente. El backend debe ser la única fuente de verdad para precios, productos, suscripciones, consumo y acceso. Nunca confíes en el precio, plan, saldo o contador enviado por el frontend.

## Reglas comerciales exactas

### Free

- Un guion editable completo.
- Breakdowns manuales.
- Diez preguntas a Lumiere durante toda la vida de la cuenta; no se renuevan mensualmente.
- Una vista de demostración del análisis básico.
- Las funciones asistidas por Lumiere permanecen visibles para que el usuario entienda el producto.
- Permite exportar el guion básico en PDF. Si ya existe una exportación funcional, consérvala.
- Bloquea la exportación del análisis asistido.
- Bloquea acciones donde Lumiere modifique, genere o aplique cambios al guion.
- Sin breakdown generado por Lumiere.
- Sin imágenes ni Smart Storyboard.
- Cuando el usuario llegue a una función bloqueada, conserva su trabajo y muestra un upgrade contextual; no borres datos ni lo saques del flujo.

### Pro

- $29.99 USD mensual.
- $299 USD anual.
- Incluye todas las funciones de texto de Lumiere.
- Incluye análisis, breakdown asistido, stripboard, shot list, títulos, nombres, formato, presupuesto, calendario y exportaciones profesionales.
- Incluye Canvas y propuestas que usen recursos subidos por el usuario.
- Sin generación de imágenes.
- Sin Smart Storyboard.
- Límites por cuenta:
  - 250 prompts de Lumiere por ciclo mensual.
  - 30 prompts dentro de cualquier ventana móvil de seis horas.
  - 300 procesos de escena por ciclo mensual.
  - 120 procesos de escena dentro de cualquier ventana móvil de seis horas.
  - 4 análisis completos por ciclo mensual.
  - 1 análisis completo dentro de cualquier ventana móvil de seis horas.

### Studio

- $69.99 USD mensual.
- $699 USD anual.
- Incluye todo Pro.
- Incluye generación de imágenes con el proveedor configurado para GPT Image 2.
- Incluye cuadros de referencia conectados a cada escena.
- Incluye Smart Storyboard.
- Incluye imágenes en el board para propuestas creativas.
- Incluye propuesta visual exportable a PDF.
- Límites por cuenta:
  - 350 prompts de Lumiere por ciclo mensual.
  - 40 prompts dentro de cualquier ventana móvil de seis horas.
  - 500 procesos de escena por ciclo mensual.
  - 160 procesos de escena dentro de cualquier ventana móvil de seis horas.
  - 6 análisis completos por ciclo mensual.
  - 2 análisis completos dentro de cualquier ventana móvil de seis horas.
  - 120 créditos de imagen por ciclo mensual.
  - 24 créditos de imagen dentro de cualquier ventana móvil de seis horas.
- Una imagen de calidad media consume 1 crédito.
- Una imagen de calidad alta consume 4 créditos.
- No ofrezcas imágenes ni storyboards ilimitados.
- Prepara un producto adicional de 100 créditos de imagen por $19.99 USD. Debe ser una compra única y solo puede aplicarse a cuentas Studio activas.

## Ciclos y contadores

- Define el ciclo por las fechas reales de la suscripción confirmadas por Recurrente, no por el primer día del mes calendario.
- Las ventanas de seis horas deben ser móviles y calculadas en servidor.
- Guarda consumo de manera durable por usuario, categoría, timestamp, idempotency key y operación relacionada.
- Antes de ejecutar una operación costosa, reserva el consumo de forma atómica. Si la operación falla antes de enviar una solicitud facturable, libera la reserva; si el proveedor ya facturó, registra el consumo.
- Los reintentos internos no deben cobrar doble al usuario, pero sí deben quedar registrados para costos operativos.
- Devuelve al frontend un resumen de límites y saldos; el frontend solo lo presenta.
- Nunca uses localStorage como fuente de verdad para cuotas o entitlements.

## Recurrente

- Crea o documenta cuatro productos de suscripción en Recurrente:
  - Pro mensual: $29.99.
  - Pro anual: $299.
  - Studio mensual: $69.99.
  - Studio anual: $699.
- Crea o documenta el producto de compra única de 100 créditos por $19.99.
- Los productos se configuran en el panel de Recurrente y el código usa únicamente sus IDs.
- Añade variables de entorno con nombres claros, por ejemplo:
  - `RECURRENTE_PRO_MONTHLY_PRODUCT_ID`
  - `RECURRENTE_PRO_ANNUAL_PRODUCT_ID`
  - `RECURRENTE_STUDIO_MONTHLY_PRODUCT_ID`
  - `RECURRENTE_STUDIO_ANNUAL_PRODUCT_ID`
  - `RECURRENTE_IMAGE_PACK_100_PRODUCT_ID`
- No pongas secretos ni IDs reales en el repositorio.
- El endpoint de checkout debe aceptar únicamente una combinación autorizada de `plan` y `cadence`, resolver el Product ID en servidor y enviar ese producto a Recurrente.
- Incluye `plan`, `cadence`, `product_id`, `app_user_id` e idioma en metadata.
- Verifica siempre el Product ID confirmado por Recurrente antes de activar acceso.
- Mantén la validación de firma Svix, la idempotencia de webhooks y la reconciliación de suscripciones.
- Upgrade, downgrade, renovación, cancelación, pago fallido y expiración deben actualizar entitlements sin borrar trabajo existente.
- Si Recurrente no permite modificar una suscripción activa entre productos, crea el flujo seguro de cancelación/cambio documentado por el proveedor; no inventes endpoints.

## Migración y compatibilidad

El código actual usa `basic` y `lumiere` en `BILLING_PLAN_KEYS`, `planConfig`, sesiones locales, checkouts y pruebas.

- Introduce claves canónicas nuevas: `free`, `pro` y `studio`.
- Conserva el reconocimiento de `RECURRENTE_BASIC_PRODUCT_ID` y `RECURRENTE_LUMIERE_PRODUCT_ID` para suscripciones activas existentes.
- Mapea las suscripciones antiguas a entitlements legacy explícitos; no cambies silenciosamente el precio ni el producto de un cliente existente.
- Los nuevos checkouts solo deben usar los productos nuevos.
- Un usuario legacy conserva acceso hasta cancelar o migrar de forma explícita.
- Guarda `plan`, `cadence`, `productId`, `status`, `currentPeriodStart`, `currentPeriodEnd`, `checkoutId` y `subscriptionId` cuando estén disponibles.
- La migración debe poder ejecutarse más de una vez sin duplicar ni degradar datos.

## Arquitectura de acceso

- Sustituye comprobaciones dispersas como `hasActiveLumierePlan()` por un servicio central de entitlements.
- Proporciona funciones de servidor equivalentes a:
  - `getEntitlements(userId)`
  - `requireEntitlement(userId, capability)`
  - `getUsageSummary(userId)`
  - `reserveUsage(userId, category, amount, idempotencyKey)`
  - `commitUsage(...)`
  - `releaseUsage(...)`
- Capacidades mínimas:
  - `script.write`
  - `script.export_basic`
  - `lumiere.chat`
  - `lumiere.modify_script`
  - `analysis.preview`
  - `analysis.generate`
  - `analysis.export`
  - `breakdown.manual`
  - `breakdown.generate`
  - `shotlist.generate`
  - `production.export`
  - `image.generate`
  - `storyboard.smart`
  - `visual_proposal.export`
- Protege cada endpoint en servidor. Ocultar un botón no es seguridad.
- Responde con errores estructurados como `plan_required`, `quota_exceeded`, `window_limit_exceeded` y `subscription_inactive`, incluyendo plan requerido, saldo y fecha de renovación cuando corresponda.

## Interfaz y copy

- Actualiza `Pricing.dc.html` a tres tarjetas: Free, Pro y Studio.
- Añade un selector Mensual / Anual. Muestra el total anual real, no un precio mensual engañoso.
- Marca Pro como la opción recomendada para la mayoría.
- Presenta Studio como el flujo visual completo: guion → análisis → breakdown → shot list → cuadros → propuesta → PDF.
- No vendas “prompts”; vende resultados. Los límites detallados pueden aparecer en FAQ o administración de cuenta.
- En funciones bloqueadas, permite ver el control y una explicación breve del resultado que desbloquea cada plan.
- El análisis de demostración de Free debe ser legible, pero sus exportaciones y acciones de aplicación deben quedar bloqueadas.
- Muestra créditos de imagen restantes en Studio y el costo en créditos antes de confirmar calidad alta.
- Actualiza textos en inglés y español.
- Actualiza `Features.dc.html`, `Pricing.dc.html`, `App.dc.html`, `Editor v5.dc.html`, `Subscription.dc.html`, `language-preference.js` y cualquier copia con `$12.99`, `$19.99`, Basic o el plan legacy.
- No cambies el lenguaje visual actual de FilmScript salvo lo necesario para presentar los planes claramente.

## Infraestructura y documentación

- Actualiza `aws/filmscript-backend.yml`, `.env.example`, `aws/README.md`, `docs/DEPLOYMENT.md`, `README_RELEASE.md` y la documentación de Recurrente con las nuevas variables.
- No escribas precios como fuente de verdad en múltiples archivos. Centraliza el catálogo de planes y deriva etiquetas de UI y API cuando la arquitectura lo permita.
- El catálogo debe diferenciar precio mostrado, Product ID y entitlements, pero la activación siempre depende del producto confirmado por Recurrente.

## Pruebas obligatorias

- Conserva las pruebas existentes y actualiza las que dependan de nombres o precios anteriores.
- Añade pruebas para:
  - Free recibe exactamente 10 preguntas de Lumiere durante toda la vida de la cuenta.
  - El frontend no puede falsificar plan, precio, créditos ni cadencia.
  - Pro permite texto y producción, pero bloquea imágenes y Smart Storyboard.
  - Studio descuenta correctamente 1 o 4 créditos y bloquea al llegar a cero.
  - Los límites mensuales y las ventanas móviles de seis horas se aplican en servidor.
  - El mismo idempotency key no descuenta dos veces.
  - Los productos mensual y anual activan el plan correcto.
  - Un Product ID desconocido nunca activa acceso.
  - Los webhooks repetidos son idempotentes.
  - Cancelación o pago fallido bloquean nueva generación sin borrar contenido existente.
  - Las suscripciones legacy `basic` y `lumiere` siguen siendo reconocidas.
  - Los paquetes de imágenes solo se acreditan después de pago confirmado y únicamente a Studio.

## Criterios de aceptación

- No quedan precios públicos antiguos ni mensajes contradictorios.
- Free, Pro y Studio funcionan de extremo a extremo en inglés y español.
- Todos los endpoints costosos están protegidos por plan y cuota en servidor.
- Recurrente activa únicamente productos permitidos y verificados.
- Las suscripciones antiguas siguen funcionando sin cobros ni migraciones silenciosas.
- Los guiones y documentos existentes nunca se eliminan al cancelar o cambiar de plan.
- La suite completa pasa.
- Entrega un resumen de archivos modificados, variables que el propietario debe crear en Recurrente/AWS y pasos manuales pendientes. No despliegues a producción ni cambies productos reales de Recurrente sin autorización explícita.

---
