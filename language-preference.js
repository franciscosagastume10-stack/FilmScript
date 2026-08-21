// Shared, persistent FilmScript interface-language preference.
// Screenplay text, imported documents, script titles and saved conversations are
// deliberately excluded: changing the interface language must never rewrite art.
(() => {
  'use strict';

  const STORAGE_KEY = 'filmscript_language';
  const ACCOUNT_STORAGE_PREFIX = 'filmscript_language_user_';
  const SETTINGS_ID = 'filmscript-language-settings';
  const INITIAL_CHOICE_ID = 'filmscript-language-initial-choice';
  const SUPPORTED = new Set(['en', 'es']);
  const originalText = new WeakMap();
  const lastText = new WeakMap();
  const originalAttributes = new WeakMap();
  const lastAttributes = new WeakMap();
  const observedRoots = new WeakSet();
  const ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'aria-description', 'alt'];
  const accountState = { hydrated: false, id: null, language: null, saving: false };
  let modalReturnFocus = null;
  let modalInerted = [];
  let lockedLanguageModal = null;
  let modalInertObserver = null;

  const ES = Object.freeze({
    // Navigation, accounts and shared actions.
    'Features': 'Funciones',
    'Pricing': 'Precios',
    'Settings': 'Ajustes',
    'Language': 'Idioma',
    'English': 'Inglés',
    'Spanish': 'Español',
    'Open language settings': 'Abrir ajustes de idioma',
    'Close settings': 'Cerrar ajustes',
    'Theme': 'Tema',
    'Dark theme': 'Modo noche',
    'Light theme': 'Modo día',
    'Sign up': 'Crear cuenta',
    'Log in': 'Iniciar sesión',
    'Open Scripts': 'Abrir Guiones',
    'Scripts': 'Guiones',
    'Home': 'Inicio',
    'Projects': 'Proyectos',
    'Overview': 'Resumen',
    'Script': 'Guion',
    'More': 'Más',
    'Activity': 'Actividad',
    'FilmScript navigation': 'Navegación de FilmScript',
    'Project navigation': 'Navegación del proyecto',
    'Go to scripts': 'Ir a guiones',
    'FilmScript, go to scripts': 'FilmScript, ir a guiones',
    'Account menu': 'Menú de cuenta',
    'More tools': 'Más herramientas',
    'Opening your writing desk': 'Abriendo tu escritorio de escritura',
    'Syncing your scripts, preferences and workspace.': 'Sincronizando tus guiones, preferencias y espacio de trabajo.',
    'Your scripts are taking longer than expected. Please try again.': 'Tus guiones están tardando más de lo esperado. Inténtalo de nuevo.',
    'Sign out': 'Cerrar sesión',
    'Account details': 'Detalles de la cuenta',
    'Your identity, preferences and private details in one place.': 'Tu identidad, preferencias y datos privados en un solo lugar.',
    'FilmScript account': 'Cuenta de FilmScript',
    'FilmScript member': 'Miembro de FilmScript',
    'No email available': 'Correo no disponible',
    'Upload photo': 'Subir foto',
    'Choose an icon': 'Elegir un icono',
    'Ten original, hand-drawn film symbols. Pick a background or upload your own photo.': 'Diez símbolos cinematográficos originales dibujados a mano. Elige un fondo o sube tu propia foto.',
    'Use icon': 'Usar icono',
    'Profile icons': 'Iconos de perfil',
    'Background': 'Fondo',
    'Icon background color': 'Color de fondo del icono',
    'Your email stays on one clean line and is never cropped into a broken address.': 'Tu correo permanece en una sola línea y nunca se corta de forma incorrecta.',
    'Name': 'Nombre',
    'First name': 'Nombre',
    'Last name': 'Apellido',
    'FilmScript username': 'Usuario de FilmScript',
    'Email': 'Correo',
    'Verified': 'Verificado',
    'Not signed in': 'Sesión no iniciada',
    'Personal profile': 'Perfil personal',
    'Private account information used only for your FilmScript experience.': 'Información privada de tu cuenta utilizada únicamente para tu experiencia en FilmScript.',
    'How should we refer to you?': '¿Cómo debemos referirnos a ti?',
    'Not set': 'Sin definir',
    'Man': 'Hombre',
    'Woman': 'Mujer',
    'Prefer not to say': 'Prefiero no decirlo',
    'Birthday': 'Cumpleaños',
    'Save details': 'Guardar detalles',
    'Interface': 'Interfaz',
    'Your personal theme follows you across FilmScript.': 'Tu tema personal te acompaña en todo FilmScript.',
    'Personalize Lumiere': 'Personalizar Lumiere',
    'Directors, films and the kind of feedback that serves your voice.': 'Directores, películas y el tipo de feedback que fortalece tu voz.',
    'My scripts': 'Mis guiones',
    'Plan and billing': 'Plan y facturación',
    'Terms & conditions': 'Términos y condiciones',
    'Choose a plan': 'Elegir un plan',
    'Start for free': 'Empezar gratis',
    'Upgrade to Full': 'Mejorar a Full',
    'Upgrade to FilmScript Full': 'Mejorar a FilmScript Full',
    'FilmScript Creator': 'FilmScript Creator',
    'FilmScript Full': 'FilmScript Full',
    'Choose Creator': 'Elegir Creator',
    'Choose Full': 'Elegir Full',
    'Choose FilmScript Creator': 'Elegir FilmScript Creator',
    'Choose FilmScript Creator →': 'Elegir FilmScript Creator →',
    'Choose FilmScript Full': 'Elegir FilmScript Full',
    'Choose FilmScript Full →': 'Elegir FilmScript Full →',
    'View Creator': 'Ver Creator',
    'View Creator · $24.99 / month': 'Ver Creator · $24.99 / mes',
    'View Full': 'Ver Full',
    'View Full · $39.99 / month': 'Ver Full · $39.99 / mes',
    'No active plan': 'Sin plan activo',
    'Active': 'Activo',
    'Inactive': 'Inactivo',
    'Free': 'Gratis',
    'Back': 'Volver',
    'Done': 'Listo',
    'Save': 'Guardar',
    'Saved': 'Guardado',
    'Saving': 'Guardando',
    'Saving…': 'Guardando…',
    'Save failed': 'No se pudo guardar',
    'Could not update profile.': 'No se pudo actualizar el perfil.',
    'First name must contain between 1 and 60 characters.': 'El nombre debe contener entre 1 y 60 caracteres.',
    'Last name must contain between 1 and 60 characters.': 'El apellido debe contener entre 1 y 60 caracteres.',
    'Full name must contain no more than 120 characters.': 'El nombre completo no debe superar los 120 caracteres.',
    'Interface language must be English or Spanish.': 'El idioma de la interfaz debe ser inglés o español.',
    'Birthday must be a real date between 1900 and today.': 'El cumpleaños debe ser una fecha válida entre 1900 y hoy.',
    'Gender must be man, woman, or unspecified.': 'La opción de género debe ser hombre, mujer o sin especificar.',
    'Try again': 'Intentar de nuevo',
    'Close': 'Cerrar',
    'Next': 'Siguiente',
    'Previous': 'Anterior',
    'Delete': 'Eliminar',
    'Edit': 'Editar',
    'Editing': 'Editando',
    'Export': 'Exportar',
    'Live screenplay analysis': 'Análisis del guion en vivo',
    'Lumiere is building a screenplay-specific reading.': 'Lumiere está creando una lectura específica de tu guion.',
    'Lumiere could not finish this pass.': 'Lumiere no pudo terminar esta lectura.',
    'Basic metrics are current. Deep analysis belongs to an earlier script version.': 'Las métricas básicas están actualizadas. El análisis profundo pertenece a una versión anterior del guion.',
    'Basic metrics update as you write.': 'Las métricas básicas se actualizan mientras escribes.',
    'Screenplay observation': 'Observación del guion',
    'What to examine next': 'Qué revisar después',
    'What can be cut?': '¿Qué se puede cortar?',
    'Who feels thin?': '¿Qué personaje necesita más profundidad?',
    'Where does it slow?': '¿Dónde pierde ritmo?',
    'Updating analysis… Previous deep results are clearly marked.': 'Actualizando análisis… Los resultados profundos anteriores están marcados.',
    'Export PDF': 'Exportar PDF',
    'Export A4 PDF': 'Exportar PDF A4',
    'Loading…': 'Cargando…',
    'Name': 'Nombre',
    'Email': 'Correo electrónico',
    'Subscription': 'Suscripción',
    'Your account': 'Tu cuenta',
    'Connected securely with Google.': 'Conectado de forma segura con Google.',
    'Everything about your FilmScript membership.': 'Todo sobre tu membresía de FilmScript.',
    'Manage or cancel your FilmScript plan from the profile menu.': 'Administra o cancela tu plan de FilmScript desde el menú de perfil.',
    'Your writing stays yours.': 'Tu escritura sigue siendo tuya.',
    'You retain ownership of scripts and notes created in FilmScript.': 'Conservas la propiedad de los guiones y notas creados en FilmScript.',
    'You retain ownership of scripts, notes, and material created in FilmScript. We do not sell your writing.': 'Conservas la propiedad de los guiones, notas y material creado en FilmScript. No vendemos tu escritura.',
    'Lumiere is an assistant.': 'Lumiere es un asistente.',
    'It offers suggestions and analysis. You decide what belongs in your work.': 'Ofrece sugerencias y análisis. Tú decides qué pertenece a tu obra.',
    'Credits and limits.': 'Créditos y límites.',
    'Lumiere credits and usage limits.': 'Créditos y límites de uso de Lumiere.',
    'Free includes 5 Lumiere prompts total, one AI script analysis, one AI breakdown, and one AI storyboard or shot list per account. Creator includes 75 prompts per 8-hour session, 250 per week and 600 per month. Full includes 150 prompts per 8-hour session, 500 per week and 1,200 per month, plus 1,000 image credits each monthly cycle. Every AI image in Imagine, Boards, and Shot List uses 3 credits. Your scripts and existing production documents stay available.': 'Free incluye 5 prompts de Lumiere en total, un análisis de guion con IA, un desglose con IA y un storyboard o lista de planos con IA por cuenta. Creator incluye 75 prompts por sesión de 8 horas, 250 por semana y 600 por mes. Full incluye 150 prompts por sesión de 8 horas, 500 por semana y 1,200 por mes, además de 1,000 créditos de imagen por ciclo mensual. Cada imagen de IA en Imagine, Boards y Lista de planos usa 3 créditos. Tus guiones y documentos de producción existentes siguen disponibles.',
    'Lumiere offers editorial suggestions and analysis. You decide what belongs in your work and remain responsible for the final text.': 'Lumiere ofrece sugerencias editoriales y análisis. Tú decides qué pertenece a tu obra y sigues siendo responsable del texto final.',
    'Your Lumiere prompt allowance is currently empty. It refreshes automatically with your plan.': 'Tu límite de prompts de Lumiere está agotado. Se renueva automáticamente según tu plan.',
    'Your Lumiere credits are used up. Choose Creator or Full to keep asking questions.': 'Tus créditos de Lumiere se agotaron. Elige Creator o Full para seguir haciendo preguntas.',
    'Image credits renew automatically with your Creator or Full subscription.': 'Los créditos de imagen se renuevan automáticamente con tu suscripción Creator o Full.',
    'Lumiere pass used': 'Uso gratuito de Lumiere consumido',
    'Keep editing breakdowns, stripboards, shot lists, budgets, and calendars. Creator unlocks Lumiere and 100 image credits each month; Full includes 1,000.': 'Sigue editando desgloses, planes de rodaje, listas de planos, presupuestos y calendarios. Creator desbloquea Lumiere y 100 créditos de imagen cada mes; Full incluye 1,000.',
    'View plans': 'Ver planes',
    'Your screenplay and every existing breakdown, stripboard, shot list, and budget remain available to edit and export. Creator includes Lumiere and 100 image credits; Full includes 1,000.': 'Tu guion y todos los desgloses, planes de rodaje, listas de planos y presupuestos existentes siguen disponibles para editar y exportar. Creator incluye Lumiere y 100 créditos de imagen; Full incluye 1,000.',
    'Creator unlocks more Lumiere breakdowns.': 'Creator desbloquea más desgloses con Lumiere.',
    'Image generation is included with FilmScript Creator and Full. Creator includes 100 image credits each month; Full includes 1,000; each image uses 3 credits.': 'La generación de imágenes está incluida con FilmScript Creator y Full. Creator incluye 100 créditos de imagen cada mes; Full incluye 1,000; cada imagen usa 3 créditos.',
    'This Lumiere feature is included with FilmScript Creator and Full.': 'Esta función de Lumiere está incluida con FilmScript Creator y Full.',
    'AI budget planning is included with FilmScript Creator and Full. You can still build, edit, and export your budget manually.': 'La planificación de presupuesto con IA está incluida con FilmScript Creator y Full. Aún puedes crear, editar y exportar tu presupuesto manualmente.',
    'AI Budget import': 'Importación de presupuesto con IA',
    'AI Storyboard generation': 'Generación de storyboard con IA',
    'your one Free AI Storyboard': 'tu único storyboard gratuito con IA',
    'your one Free AI Breakdown': 'tu único desglose gratuito con IA',
    'your one Free AI Script Analysis': 'tu único análisis de guion gratuito con IA',
    'FilmScript Creator or Full is required to continue generating shot lists. Existing work was preserved.': 'Se requiere FilmScript Creator o Full para seguir generando listas de planos. El trabajo existente se conservó.',
    'FilmScript Creator or Full is required to continue the breakdown. Existing work was preserved.': 'Se requiere FilmScript Creator o Full para continuar el desglose. El trabajo existente se conservó.',
    'Image generation is included with FilmScript Creator and Full. Creator includes 100 image credits each month, while Full includes 1,000.': 'La generación de imágenes está incluida con FilmScript Creator y Full. Creator incluye 100 créditos de imagen cada mes, mientras Full incluye 1,000.',
    'Your image credits are used for this cycle. They renew automatically with your subscription.': 'Tus créditos de imagen se agotaron para este ciclo. Se renuevan automáticamente con tu suscripción.',
    'Credit resets have been retired. Creator includes 100 image credits and Full includes 1,000 per billing cycle; Lumiere allowances renew automatically.': 'Las recargas manuales de créditos ya no están disponibles. Creator incluye 100 créditos de imagen y Full incluye 1,000 por ciclo de facturación; los límites de Lumiere se renuevan automáticamente.',
    'Lumiere usage': 'Uso de Lumiere',
    'Session · 8h': 'Sesión · 8 h',
    'This week': 'Esta semana',
    'This month': 'Este mes',
    'Starts on first use': 'Comienza al usar Lumiere',
    'Subscriptions.': 'Suscripciones.',
    'Paid plans renew monthly through Recurrente and can be canceled from your account menu.': 'Los planes de pago se renuevan mensualmente mediante Recurrente y se pueden cancelar desde el menú de tu cuenta.',
    'Creator and Full renew monthly through Recurrente. You can cancel from your account menu. Access remains available according to the payment provider’s confirmed subscription status.': 'Creator y Full se renuevan mensualmente mediante Recurrente. Puedes cancelarlos desde el menú de tu cuenta. El acceso permanece disponible según el estado de suscripción confirmado por el proveedor de pago.',
    'Fair use.': 'Uso responsable.',
    'Use FilmScript only with material you have permission to use.': 'Usa FilmScript únicamente con material para el que tengas permiso.',
    'Do not use FilmScript to upload material you do not have permission to use, or to interfere with the service or other writers.': 'No uses FilmScript para subir material que no tengas permiso de utilizar ni para interferir con el servicio u otros escritores.',
    'Questions?': '¿Preguntas?',
    'Contact support if you need help with your account, billing, or your writing workspace.': 'Contacta a soporte si necesitas ayuda con tu cuenta, facturación o espacio de escritura.',
    'Manage your membership, billing and access to FilmScript Creator.': 'Administra tu membresía, facturación y acceso a FilmScript Creator.',
    'Manage your membership, billing and access to FilmScript Full.': 'Administra tu membresía, facturación y acceso a FilmScript Full.',
    'Your Creator workspace': 'Tu espacio Creator',
    'The complete workflow, including Lumiere text tools and 1,000 monthly image credits.': 'El flujo completo, incluidas las herramientas de texto de Lumiere y 1,000 créditos de imagen mensuales.',
    'The connected writing and production workflow, including Lumiere text tools and manual visual work.': 'El flujo conectado de escritura y producción, incluidas las herramientas de texto de Lumiere y el trabajo visual manual.',
    'Every AI image in Imagine, Boards, and Shot List uses 3 credits.': 'Cada imagen de IA en Imagine, Boards y Lista de planos usa 3 créditos.',
    'Editable camera coverage with AI image references available from your 1,000 monthly credits.': 'Cobertura de cámara editable con referencias de imagen por IA disponibles dentro de tus 1,000 créditos mensuales.',
    'Cancel FilmScript Creator': 'Cancelar FilmScript Creator',
    'Cancel FilmScript Creator?': '¿Cancelar FilmScript Creator?',
    'Cancel FilmScript Full': 'Cancelar FilmScript Full',
    'Cancel FilmScript Full?': '¿Cancelar FilmScript Full?',
    'Canceling stops future renewals. Your scripts and existing production documents remain available to edit and export.': 'La cancelación detiene futuras renovaciones. Tus guiones y documentos de producción existentes siguen disponibles para editar y exportar.',
    'Review the details before you continue. Cancellation stops future renewals, but it never deletes your existing work.': 'Revisa los detalles antes de continuar. La cancelación detiene futuras renovaciones, pero nunca elimina tu trabajo existente.',
    'I understand that canceling stops future renewals, while my scripts and existing production documents remain editable and exportable.': 'Entiendo que cancelar detiene futuras renovaciones, mientras mis guiones y documentos de producción existentes siguen siendo editables y exportables.',
    'I understand': 'Entiendo',
    'Last updated July 2026': 'Última actualización: julio de 2026',

    // Authentication and checkout.
    'Your writing workspace': 'Tu espacio de escritura',
    'Create your account': 'Crea tu cuenta',
    'Start writing in seconds. Your first script is on us.': 'Empieza a escribir en segundos. Tu primer guion corre por nuestra cuenta.',
    'Continue with Google': 'Continuar con Google',
    'Google keeps your scripts, subscription, and production tools connected to one secure account.': 'Google mantiene tus guiones, suscripción y herramientas de producción conectados a una sola cuenta segura.',
    'By continuing you agree to the Terms and Privacy Policy.': 'Al continuar, aceptas los Términos y la Política de privacidad.',
    'Close account creation': 'Cerrar creación de cuenta',
    'Close login': 'Cerrar inicio de sesión',
    'Use your Google account to continue to FilmScript.': 'Usa tu cuenta de Google para continuar a FilmScript.',
    'Log in with your Google account': 'Inicia sesión con tu cuenta de Google',
    'Confirm plan': 'Confirmar plan',
    'Continue to checkout': 'Continuar al pago',
    'You will return to FilmScript after payment. FilmScript verifies the checkout securely and unlocks your selected plan automatically.': 'Volverás a FilmScript después del pago. FilmScript verifica el pago de forma segura y desbloquea tu plan elegido automáticamente.',
    'You are all set': 'Todo está listo',
    'Continue to Scripts': 'Continuar a Guiones',
    'Sign in to manage your plan': 'Inicia sesión para administrar tu plan',
    'Use the same Google account you use in FilmScript. Your subscription is linked securely to that account.': 'Usa la misma cuenta de Google que utilizas en FilmScript. Tu suscripción está vinculada de forma segura a esa cuenta.',
    'Not now': 'Ahora no',

    // Scripts home.
    'Writing desk': 'Escritorio de escritura',
    'New script': 'Nuevo guion',
    'Import script': 'Importar guion',
    'Importing screenplay': 'Importando guion',
    'PDF or .fs, the FilmScript text format.': 'PDF o .fs, el formato de texto de FilmScript.',
    'Your scripts': 'Tus guiones',
    'Search scripts': 'Buscar guiones',
    'Script options': 'Opciones del guion',
    'Rename': 'Renombrar',
    'Rename screenplay': 'Renombrar guion',
    'Translate Script': 'Traducir guion',
    'Delete script': 'Eliminar guion',
    'Opening screenplay': 'Abriendo guion',
    'Untitled screenplay': 'Guion sin título',
    'Imported screenplay': 'Guion importado',
    'Syncing your scripts securely.': 'Sincronizando tus guiones de forma segura.',
    'Sign in to sync your scripts.': 'Inicia sesión para sincronizar tus guiones.',
    'Your session has ended. Please sign in again.': 'Tu sesión terminó. Inicia sesión de nuevo.',
    'We could not sync your scripts. Please try again.': 'No pudimos sincronizar tus guiones. Inténtalo de nuevo.',
    'Could not create a new screenplay.': 'No se pudo crear un guion nuevo.',
    'Could not rename that script. Please try again.': 'No se pudo renombrar ese guion. Inténtalo de nuevo.',
    'No scripts yet. Start a new page when you’re ready.': 'Todavía no hay guiones. Empieza una página nueva cuando quieras.',
    'Choose a plan →': 'Elegir un plan →',
    'Typewriter sound': 'Sonido de máquina de escribir',
    'Close Lumiere': 'Cerrar Lumiere',
    'Ask Lumiere anything…': 'Pregúntale lo que quieras a Lumiere…',
    'Send message': 'Enviar mensaje',
    'No scripts match': 'Ningún guion coincide',
    'That PDF keeps its text locked away. Export it as .fs or plain text and try again.': 'Ese PDF mantiene el texto bloqueado. Expórtalo como .fs o texto plano e inténtalo de nuevo.',
    'Could not read that file. Try a .fs or plain text export.': 'No se pudo leer ese archivo. Prueba con una exportación .fs o de texto plano.',
    'Could not open that imported script.': 'No se pudo abrir ese guion importado.',
    'Open an imported screenplay before starting preproduction.': 'Abre un guion importado antes de iniciar la preproducción.',
    'Could not delete that script. Please try again.': 'No se pudo eliminar ese guion. Inténtalo de nuevo.',
    'Inspiration at this hour comes from the shower, one last movie, or a TikTok spiral that got out of hand. Write it down before it escapes.': 'A esta hora la inspiración llega en la ducha, con una última película o en una espiral de TikTok que se salió de control. Escríbela antes de que escape.',
    'Up before the sun.': 'Despierto antes que el sol.',
    'Coffee first, then pages. Build your next scene at your own pace.': 'Primero café, luego páginas. Construye tu siguiente escena a tu ritmo.',
    'Fresh coffee, fresh pages. Your characters slept even less than you did.': 'Café fresco, páginas nuevas. Tus personajes durmieron aún menos que tú.',
    'A perfect hour for second acts. Lunch can wait, the midpoint cannot.': 'El café ya hizo su parte. Ahora toca rescatar ese segundo acto antes de que pida vacaciones.',
    'The light is turning golden. A fine moment to fix that third act.': 'La tarde está dorada y ese tercer acto sigue pidiendo auxilio. Vamos a darle una vuelta.',
    'Prime time. Your characters have been waiting for you all day.': 'Hora estelar. Tus personajes te han esperado todo el día.',
    'Writing past bedtime.': 'Escribiendo después de dormir.',
    'One more scene, you said, two hours ago. We believe you.': 'Una escena más, dijiste hace dos horas. Te creemos.',

    // Editor controls and Lumiere.
    'Editor': 'Editor',
    'Scene heading': 'Encabezado de escena',
    'Choose setting': 'Elegir ambientación',
    'Time of day': 'Momento del día',
    'Breakdown': 'Desglose',
    'Script Breakdown': 'Desglose de guion',
    'Stripboard': 'Plan de rodaje',
    'Shot List': 'Lista de planos',
    'Shot lists': 'Listas de planos',
    'Budget': 'Presupuesto',
    'Analysis': 'Análisis',
    'Analysis · Lumiere': 'Análisis · Lumiere',
    'Your screenplay is ready to read': 'Tu guion está listo para leerse',
    'Analysis starts only when you choose it. Your edits never spend credits automatically.': 'El análisis solo comienza cuando lo eliges. Tus ediciones nunca consumen créditos automáticamente.',
    'Analyze': 'Analizar',
    'Reanalyze': 'Volver a analizar',
    'Retry': 'Reintentar',
    'Your script has changed since this analysis was generated.': 'Tu guion ha cambiado desde que se generó este análisis.',
    'Script version': 'Versión del guion',
    'Date': 'Fecha',
    'Last relevant scene': 'Última escena relevante',
    'Generated': 'Generado',
    'Outdated': 'Desactualizado',
    'Not generated': 'Sin generar',
    'Reading screenplay': 'Leyendo guion',
    'Identifying scenes': 'Identificando escenas',
    'Mapping characters': 'Mapeando personajes',
    'Reviewing locations': 'Revisando locaciones',
    'Evaluating production requirements': 'Evaluando requisitos de producción',
    'Building analysis': 'Construyendo análisis',
    'Finalizing results': 'Finalizando resultados',
    'Reading the current screenplay': 'Leyendo el guion actual',
    'Progress': 'Progreso',
    'You can leave this page. Lumiere will keep working and notify you when it is ready.': 'Puedes salir de esta página. Lumiere seguirá trabajando y te avisará cuando esté listo.',
    'Choose how to read your screenplay': 'Elige cómo leer tu guion',
    'Nothing will be analyzed until you choose a mode.': 'No se analizará nada hasta que elijas un modo.',
    'Quick analysis': 'Análisis rápido',
    'A focused pass on story flow, clarity, and the main priorities.': 'Una lectura enfocada en el flujo, la claridad y las prioridades principales.',
    'Deep analysis': 'Análisis profundo',
    'A complete reading personalized to your creative direction.': 'Una lectura completa, adaptada a tu dirección creativa.',
    'Visual style': 'Estilo visual',
    'Choose one': 'Elige una opción',
    'Naturalistic': 'Naturalista',
    'Stylized': 'Estilizado',
    'Handheld': 'Cámara en mano',
    'Minimal': 'Minimalista',
    'Other': 'Otro',
    'References': 'Referencias',
    'Indie drama': 'Drama independiente',
    'Studio film': 'Película de estudio',
    'Documentary': 'Documental',
    'Genre cinema': 'Cine de género',
    'Genre': 'Género',
    'Drama': 'Drama',
    'Comedy': 'Comedia',
    'Thriller': 'Suspenso',
    'Horror': 'Terror',
    'Color': 'Color',
    'Warm': 'Cálido',
    'Cool': 'Frío',
    'Muted': 'Desaturado',
    'High contrast': 'Alto contraste',
    'Other (optional)': 'Otro (opcional)',
    'Start deep analysis': 'Iniciar análisis profundo',
    'Developing': 'En desarrollo',
    'Needs Attention': 'Necesita atención',
    'Production Ready': 'Listo para producción',
    'Current screenplay reading': 'Lectura actual del guion',
    'What’s working': 'Lo que funciona',
    'Needs attention': 'Necesita atención',
    'Production impact': 'Impacto de producción',
    'From the screenplay': 'Del guion',
    'Explore further': 'Explorar más',
    'More from this reading': 'Más de esta lectura',
    'Open only the lens you need. The essential writing decisions stay above.': 'Abre solo la perspectiva que necesitas. Las decisiones esenciales de escritura están arriba.',
    'Scene notes': 'Notas de escena',
    'Specific issues and moments worth revisiting': 'Problemas y momentos específicos para volver a revisar',
    'Production lens': 'Perspectiva de producción',
    'Complexity that may affect how the screenplay is made': 'Complejidad que puede afectar cómo se realiza el guion',
    'Analysis summary': 'Resumen del análisis',
    'strengths': 'fortalezas',
    'priorities': 'prioridades',
    'scenes read': 'escenas leídas',
    'Screenplay signals': 'Señales del guion',
    'Production signals': 'Señales de producción',
    'Selected production signal': 'Señal de producción seleccionada',
    'Lumiere focus': 'Enfoque de Lumiere',
    'Open priority scene': 'Abrir escena prioritaria',
    'Lumiere is reading the current draft': 'Lumiere está leyendo el borrador actual',
    'Preparing a fresh reading…': 'Preparando una lectura nueva…',
    'Preparing a fresh reading': 'Preparando una lectura nueva',
    'Lumiere is reading your screenplay': 'Lumiere está leyendo tu guion',
    'Story Flow and the writing signals will update when the pass is ready.': 'El Flujo de la historia y las señales de escritura se actualizarán cuando termine la lectura.',
    'The screenplay needs more evidence before Lumiere can identify a useful next step.': 'El guion necesita más evidencia antes de que Lumiere pueda identificar el siguiente paso útil.',
    'Screenplay observation': 'Observación del guion',
    'What to examine next': 'Qué revisar después',
    'Mark intentional': 'Marcar como intencional',
    'Read note': 'Leer nota',
    'Try again': 'Intentar de nuevo',
    'Refresh': 'Actualizar',
    'Updating analysis… Previous deep results are clearly marked.': 'Actualizando análisis… Los resultados del análisis profundo anterior están claramente marcados.',
    'Updating live screenplay metrics': 'Actualizando las métricas del guion en vivo',
    'Where does it slow?': '¿Dónde pierde ritmo?',
    'What can be cut?': '¿Qué se puede cortar?',
    'Who feels thin?': '¿Qué personaje se siente poco desarrollado?',
    'What costs more?': '¿Qué cuesta más?',
    'Where does this screenplay lose momentum, and why?': '¿Dónde pierde impulso este guion y por qué?',
    'Which scenes repeat information or can be cut without harming the story?': '¿Qué escenas repiten información o se pueden cortar sin dañar la historia?',
    'Which character needs a clearer want or stronger dramatic choice?': '¿Qué personaje necesita un deseo más claro o una decisión dramática más fuerte?',
    'Which scenes are likely to be the most complex or expensive to produce?': '¿Qué escenas probablemente serán las más complejas o costosas de producir?',
    'Evidence': 'Evidencia',
    'Screenplay evidence': 'Evidencia del guion',
    'View in Script': 'Ver en el guion',
    'Story': 'Historia',
    'Story clarity': 'Claridad de la historia',
    'Story flow': 'Flujo de la historia',
    'Conflict': 'Conflicto',
    'Peak': 'Pico',
    'Ending': 'Desenlace',
    'Middle': 'Mitad',
    'Quiet': 'Calma',
    'Lumiere’s read': 'Lectura de Lumiere',
    'Fix first': 'Corregir primero',
    'Scenes that need attention': 'Escenas que necesitan atención',
    'Open Scene': 'Abrir escena',
    'Keep an eye on': 'Prestar atención',
    'Key moments': 'Momentos clave',
    'Jump to Scene': 'Ir a la escena',
    'Production': 'Producción',
    'Production overview': 'Resumen de producción',
    'Locations': 'Locaciones',
    'Night scenes': 'Escenas de noche',
    'Complex scenes': 'Escenas complejas',
    'Plan carefully': 'Planificar con cuidado',
    'High complexity scenes': 'Escenas de alta complejidad',
    'Connected screenplay': 'Guion conectado',
    'Scene explorer': 'Explorador de escenas',
    'All scenes': 'Todas las escenas',
    'High complexity': 'Alta complejidad',
    'Screenplay priorities': 'Prioridades del guion',
    'Ask Lumiere about Story': 'Preguntar a Lumiere sobre la historia',
    'Ask Lumiere about Characters': 'Preguntar a Lumiere sobre los personajes',
    'Ask Lumiere about Production': 'Preguntar a Lumiere sobre la producción',
    'Story clarity timeline': 'Línea de claridad de la historia',
    'Filter scene explorer': 'Filtrar explorador de escenas',
    'Only the screenplay choices that change how this film is made.': 'Solo las decisiones del guion que cambian cómo se realiza esta película.',
    'Momentum, emotion, and dramatic pressure in one view.': 'Impulso, emoción y presión dramática en una sola vista.',
    'Momentum, emotion, and dramatic pressure—combined into one readable arc.': 'Impulso, emoción y presión dramática combinados en un arco fácil de leer.',
    'A live draft signal from scene rhythm. Lumiere refines it when the full reading is ready.': 'Una señal en vivo del ritmo de las escenas. Lumiere la refina cuando la lectura completa está lista.',
    'Live preview': 'Vista previa en vivo',
    'Updating': 'Actualizando',
    'Live draft signal': 'Señal del borrador en vivo',
    'A quick rhythm signal from scene length and dialogue/action balance. Lumiere refines it when the full reading is ready.': 'Una señal rápida del ritmo basada en la duración de la escena y el equilibrio entre diálogo y acción. Lumiere la refina cuando la lectura completa está lista.',
    'Where the screenplay begins, turns, peaks, and lands.': 'Dónde comienza, gira, alcanza su pico y termina el guion.',
    'No material scene issue was identified in this pass.': 'No se identificó ningún problema importante de escena en esta lectura.',
    'Lumiere has not identified a decisive key moment yet.': 'Lumiere aún no ha identificado un momento clave decisivo.',
    'No unusually complex scene was identified.': 'No se identificó ninguna escena de complejidad inusual.',
    'No clear strength has enough evidence yet.': 'Aún no hay suficiente evidencia para destacar una fortaleza clara.',
    'No critical writing issue was identified in this pass.': 'No se identificó ningún problema crítico de escritura en esta lectura.',
    'No material production impact was identified.': 'No se identificó ningún impacto importante de producción.',
    'Your existing insights and exports remain available. Creator or Full unlocks a new Lumiere reading.': 'Tus análisis y exportaciones existentes siguen disponibles. Creator o Full desbloquean una nueva lectura con Lumiere.',
    'Overview': 'Resumen',
    'Pages': 'Páginas',
    'Words': 'Palabras',
    'Estimated Runtime': 'Duración estimada',
    'Interior Scenes': 'Escenas interiores',
    'Exterior Scenes': 'Escenas exteriores',
    'Day Scenes': 'Escenas de día',
    'Night Scenes': 'Escenas de noche',
    'Story Structure': 'Estructura narrativa',
    'Dialogue / Action': 'Diálogo / Acción',
    'Pacing': 'Ritmo',
    'Top Moments': 'Momentos clave',
    'Opening Image': 'Imagen inicial',
    'Inciting Incident': 'Incidente incitador',
    'Midpoint': 'Punto medio',
    'Climax': 'Clímax',
    'Resolution': 'Resolución',
    'Emotional Arc': 'Arco emocional',
    'Scene Length': 'Duración de escenas',
    'Genre & Tone': 'Género y tono',
    'Scene Breakdown': 'Desglose de escenas',
    'Lumiere Insight': 'Observación de Lumiere',
    'Lumiere Suggests': 'Lumiere sugiere',
    'Ask Lumiere': 'Preguntar a Lumiere',
    'Ask Lumiere why': 'Preguntar a Lumiere por qué',
    'View Full Analysis': 'Ver análisis completo',
    'Full Analysis': 'Análisis completo',
    'Export Report': 'Exportar informe',
    'All analysis powered by Lumiere AI': 'Todo el análisis funciona con la IA de Lumiere',
    'Open Script Editor': 'Abrir editor de guion',
    'Live screenplay analysis': 'Análisis del guion en vivo',
    'Analysis updated': 'Análisis actualizado',
    'Detected screenplay structure': 'Estructura narrativa detectada',
    'Override detected structure': 'Cambiar la estructura detectada',
    '3 Act Structure': 'Estructura de 3 actos',
    'Five Act Structure': 'Estructura de 5 actos',
    'Hero’s Journey': 'Viaje del héroe',
    'Episodic': 'Episódica',
    'Nonlinear': 'No lineal',
    'Circular': 'Circular',
    'Dual Timeline': 'Doble línea temporal',
    'Custom Structure': 'Estructura personalizada',
    'Switch to dark mode': 'Cambiar a modo noche',
    'Switch to light mode': 'Cambiar a modo día',
    'Updating analysis…': 'Actualizando análisis…',
    'Lumiere is finding the story priorities and production impact': 'Lumiere está encontrando las prioridades narrativas y el impacto de producción',
    'Lumiere credits are empty. Upgrade to keep creating.': 'Los créditos de Lumiere se agotaron. Mejora tu plan para seguir creando.',
    'The screenplay changed while Lumiere was reading it': 'El guion cambió mientras Lumiere lo leía',
    'Lumiere could not finish this pass. Your previous analysis was preserved.': 'Lumiere no pudo terminar esta lectura. Se conservó tu análisis anterior.',
    'The previous analysis was interrupted. Start it again when ready.': 'La lectura anterior se interrumpió. Vuelve a iniciarla cuando estés listo.',
    'Preparing the current screenplay for Lumiere': 'Preparando el guion actual para Lumiere',
    'Lumiere is connecting to the current screenplay…': 'Lumiere se está conectando al guion actual…',
    'Analysis is not available for this screenplay.': 'El análisis no está disponible para este guion.',
    'Could not load Analysis.': 'No se pudo cargar el análisis.',
    'Could not refresh Analysis.': 'No se pudo actualizar el análisis.',
    'Could not update Analysis.': 'No se pudo actualizar el análisis.',
    'Could not save that Analysis change.': 'No se pudo guardar ese cambio del análisis.',
    'No scenes match this filter.': 'Ninguna escena coincide con este filtro.',
    'No scenes are associated with this selection.': 'No hay escenas asociadas con esta selección.',
    'Current screenplay reading': 'Lectura actual del guion',
    'Updated': 'Actualizado',
    'Export': 'Exportar',
    'Basic metrics update as you write.': 'Las métricas básicas se actualizan mientras escribes.',
    'Previous version': 'Versión anterior',
    'Previous': 'Anterior',
    'Confirm structure': 'Confirmar estructura',
    'Structure confirmed': 'Estructura confirmada',
    'Override': 'Cambiar',
    'Confirm': 'Confirmar',
    'Confirmed': 'Confirmado',
    'Dismiss': 'Descartar',
    'Scene detail': 'Detalle por escena',
    'Slow': 'Lento',
    'Medium': 'Medio',
    'Fast': 'Rápido',
    'Low': 'Bajo',
    'Neutral': 'Neutral',
    'High': 'Alto',
    'Start': 'Inicio',
    'End': 'Final',
    'Total Scenes': 'Total de escenas',
    'Under 1 minute': 'Menos de 1 minuto',
    '1–2 minutes': '1–2 minutos',
    '2–3 minutes': '2–3 minutos',
    '3–4 minutes': '3–4 minutos',
    '4–6 minutes': '4–6 minutos',
    'Over 6 minutes': 'Más de 6 minutos',
    'Longest': 'Más larga',
    'Shortest': 'Más corta',
    'Tone values are an interpretive analysis based on the current screenplay.': 'Los valores de tono son una interpretación basada en el guion actual.',
    'Tell Lumiere the intended genre': 'Indicar a Lumiere el género previsto',
    'Intended genre': 'Género previsto',
    'Choose a genre': 'Elige un género',
    'No scenes match this filter.': 'Ninguna escena coincide con este filtro.',
    'Save as note': 'Guardar como nota',
    'Saved as note': 'Guardado como nota',
    'Dismiss insight': 'Descartar observación',
    'Supporting scenes': 'Escenas de respaldo',
    'Close full analysis': 'Cerrar análisis completo',
    'Lumiere observes and suggests. Your screenplay is never rewritten without explicit permission.': 'Lumiere observa y sugiere. Tu guion nunca se reescribe sin permiso explícito.',
    'Write a few scenes and Lumiere will begin analyzing your screenplay.': 'Escribe algunas escenas y Lumiere comenzará a analizar tu guion.',
    'Lumiere is connecting to the current screenplay…': 'Lumiere se está conectando al guion actual…',
    'Lumiere is reading the current draft…': 'Lumiere está leyendo el borrador actual…',
    'Creator or Full unlocks a new Lumiere story structure analysis.': 'Creator o Full desbloquean un nuevo análisis de estructura narrativa con Lumiere.',
    'More screenplay context is needed before Lumiere can interpret story structure.': 'Lumiere necesita más contexto del guion para interpretar la estructura narrativa.',
    'Connected production': 'Producción conectada',
    'Budget saves automatically': 'El presupuesto se guarda automáticamente',
    'Budget views': 'Vistas del presupuesto',
    'Import Budget': 'Importar presupuesto',
    'Preview': 'Vista previa',
    'Review imported budget': 'Revisar presupuesto importado',
    'Lumiere found {count} cost items. Nothing is saved until you confirm.': 'Lumiere encontró {count} partidas. Nada se guarda hasta que confirmes.',
    'Lumiere found cost items. Nothing is saved until you confirm.': 'Lumiere encontró partidas. Nada se guarda hasta que confirmes.',
    'Accounts': 'Cuentas',
    'Cost items': 'Partidas',
    'Budget total after import': 'Total del presupuesto después de importar',
    'Review notes': 'Notas de revisión',
    'Choose another source': 'Elegir otra fuente',
    'Import': 'Importar',
    'Import {count} items': 'Importar {count} partidas',
    'Bring in a PDF, Excel, CSV, DOCX, text file or a shared Google Doc. Lumiere maps it to Budget Breakdown, Cash Flow, Finance and Expenses.': 'Incorpora un PDF, Excel, CSV, DOCX, archivo de texto o Google Doc compartido. Lumiere lo asigna al desglose, flujo de caja, plan financiero y gastos.',
    'PDF, Excel, CSV, DOCX, text file or a shared Google Doc.': 'PDF, Excel, CSV, DOCX, archivo de texto o Google Doc compartido.',
    'Shared Google Docs link': 'Enlace compartido de Google Docs',
    'Set sharing to “Anyone with the link” so Lumiere can read it.': 'Activa “Cualquiera con el enlace” para que Lumiere pueda leerlo.',
    'You will review every mapped line before it is saved.': 'Revisarás cada partida asignada antes de guardarla.',
    'Analyze with Lumiere': 'Analizar con Lumiere',
    'Cancel': 'Cancelar',
    'Lumiere is reading the source…': 'Lumiere está leyendo la fuente…',
    'Choose a file up to 10 MB': 'Elige un archivo de hasta 10 MB',
    'No file selected': 'Ningún archivo seleccionado',
    'or': 'o',
    'No cost items were confidently mapped.': 'No se asignaron partidas con suficiente confianza.',
    'Mapped to': 'Asignado a',
    'Account': 'Cuenta',
    'Cost item': 'Partida',
    'Close budget import': 'Cerrar importación del presupuesto',
    'Unit cost': 'Costo unitario',
    'Qty': 'Cant.',
    'Unit': 'Unidad',
    'Scenes': 'Escenas',
    'Scene': 'Escena',
    'of': 'de',
    'screenplay': 'guion',
    'screenplays': 'guiones',
    'ready to shape.': 'listos para trabajar.',
    'Action': 'Acción',
    'Character': 'Personaje',
    'Characters in this script': 'Personajes de este guion',
    'Close character list': 'Cerrar lista de personajes',
    'Type a new character directly in the screenplay. FilmScript will remember it here.': 'Escribe un personaje nuevo directamente en el guion. FilmScript lo recordará aquí.',
    'Parenthetical': 'Paréntesis',
    'Dialogue': 'Diálogo',
    'Transition': 'Transición',
    'Scene ⌘1': 'Escena ⌘1',
    'Action ⌘2': 'Acción ⌘2',
    'Character ⌘3': 'Personaje ⌘3',
    'Parenthetical ⌘4': 'Paréntesis ⌘4',
    'Dialogue ⌘5': 'Diálogo ⌘5',
    'Transition ⌘6': 'Transición ⌘6',
    'Undo ⌘Z': 'Deshacer ⌘Z',
    'Redo ⇧⌘Z': 'Rehacer ⇧⌘Z',
    'Undo': 'Deshacer',
    'Redo': 'Rehacer',
    'Cover': 'Portada',
    'Sound effects': 'Efectos de sonido',
    'Fit': 'Ajustar',
    'Add Row': 'Agregar fila',
    'Add Group': 'Agregar grupo',
    '+ Add Row': '+ Agregar fila',
    '+ Add Group': '+ Agregar grupo',
    'More actions': 'Más acciones',
    'More actions for': 'Más acciones para',
    'Task row actions': 'Acciones de la fila',
    'Edit task': 'Editar tarea',
    'Mark complete': 'Marcar como completada',
    'Mark active': 'Marcar como activa',
    'Delete': 'Eliminar',
    'A quiet moment': 'Un momento de pausa',
    'You paused on this scene.': 'Hiciste una pausa en esta escena.',
    'Need a way into the next beat?': '¿Necesitas una entrada al siguiente beat?',
    'Lumiere can read the scene you paused on and suggest three concrete ways forward.': 'Lumiere puede leer la escena donde hiciste una pausa y sugerir tres formas concretas de continuar.',
    'Ask Lumiere': 'Preguntar a Lumiere',
    'A prompt for your next beat': 'Un prompt para tu siguiente beat',
    'FilmScript noticed a pause. Here is a focused prompt you can use with any writing assistant.': 'FilmScript notó una pausa. Aquí tienes un prompt enfocado que puedes usar con cualquier asistente de escritura.',
    'Copy prompt': 'Copiar prompt',
    'Prompt copied': 'Prompt copiado',
    'Dismiss writing prompt': 'Descartar ayuda de escritura',
    'Could not copy the prompt. Select it and copy it manually.': 'No se pudo copiar el prompt. Selecciónalo y cópialo manualmente.',
    'Fill page': 'Llenar página',
    'Format': 'Formato',
    'Suggestions': 'Sugerencias',
    'Character names': 'Nombres de personajes',
    'Character Name Generator': 'Generador de nombres de personajes',
    'Context-aware naming': 'Nombres según el contexto',
    'Draft changed': 'El borrador cambió',
    'Reading character arcs and setting': 'Leyendo arcos de personajes y ambientación',
    'Lumiere is matching names to place, period, culture, relationships and each character’s actual arc.': 'Lumiere está relacionando los nombres con el lugar, la época, la cultura, las relaciones y el arco real de cada personaje.',
    'The naming board went quiet.': 'El tablero de nombres se quedó en silencio.',
    'No named character cues yet': 'Aún no hay personajes con nombre',
    'Add character cues to the screenplay, then let Lumiere read their context.': 'Agrega personajes al guion y deja que Lumiere lea su contexto.',
    'The screenplay changed after this analysis.': 'El guion cambió después de este análisis.',
    'Refresh the context without replacing any decision you made.': 'Actualiza el contexto sin reemplazar ninguna decisión que hayas tomado.',
    'Refresh analysis': 'Actualizar análisis',
    'Story context': 'Contexto de la historia',
    'Not firmly established': 'No está claramente establecido',
    'Strong fit': 'Encaja muy bien',
    'Neutral fit': 'Encaje neutral',
    'Worth reviewing': 'Vale la pena revisarlo',
    'Original kept': 'Original conservado',
    'Use name': 'Usar nombre',
    'Keep original': 'Conservar original',
    'More ideas': 'Más ideas',
    'Finding names…': 'Buscando nombres…',
    'Replace in screenplay': 'Reemplazar en el guion',
    'Review again': 'Revisar de nuevo',
    'Current name kept. Nothing in the screenplay changed.': 'Se conservó el nombre actual. Nada cambió en el guion.',
    'The current name is already well supported. Ask for more ideas only if you want another direction.': 'El nombre actual ya está bien respaldado. Pide más ideas solo si quieres explorar otra dirección.',
    'The screenplay does not firmly establish a cultural or period-specific naming context yet.': 'El guion aún no establece claramente un contexto cultural o de época para los nombres.',
    'Character Name Generator could not save its latest changes.': 'El Generador de nombres no pudo guardar sus cambios más recientes.',
    'Lumiere could not finish the naming analysis. Your screenplay was not changed.': 'Lumiere no pudo terminar el análisis de nombres. Tu guion no fue modificado.',
    'Lumiere could not generate more names. Try again.': 'Lumiere no pudo generar más nombres. Inténtalo de nuevo.',
    'Character names updated in the screenplay.': 'Los nombres de personajes se actualizaron en el guion.',
    'That name already belongs to another character in this screenplay.': 'Ese nombre ya pertenece a otro personaje de este guion.',
    'Those character cues changed. Refresh the naming analysis.': 'Esos personajes cambiaron. Actualiza el análisis de nombres.',
    'Ask about your script': 'Pregunta sobre tu guion',
    'Reading the script': 'Leyendo el guion',
    'Scene notes': 'Notas de escena',
    'Clichés': 'Clichés',
    'Characters': 'Personajes',
    'Arc': 'Arco',
    'Mute sound effects': 'Silenciar efectos de sonido',
    'Enable sound effects': 'Activar efectos de sonido',
    'Character analysis': 'Análisis de personajes',
    'Cliché detector': 'Detector de clichés',
    'Scene suggestions': 'Sugerencias de escena',
    'Narrative arc': 'Arco narrativo',
    'Format checker': 'Revisor de formato',
    'Run Character analysis': 'Ejecutar análisis de personajes',
    'Run Cliché detector': 'Ejecutar detector de clichés',
    'Run Scene suggestions': 'Ejecutar sugerencias de escena',
    'Run Narrative arc': 'Ejecutar arco narrativo',
    'Run Format checker': 'Ejecutar revisor de formato',
    'Format check': 'Revisión de formato',
    'Live screenplay review': 'Revisión del guion en vivo',
    'You': 'Tú',
    'Fade in': 'Fundido de entrada',
    'End': 'Fin',
    'Block': 'Bloque',
    'Spelling': 'Ortografía',
    'Grammar': 'Gramática',
    'Punctuation': 'Puntuación',
    'Import cleanup': 'Limpieza de importación',
    'Suggested adjustment': 'Ajuste sugerido',
    'Adjusted': 'Ajustado',
    'Rejected': 'Rechazado',
    'Changed': 'Modificado',
    '(empty block)': '(bloque vacío)',
    'Lumiere is checking the pages': 'Lumiere está revisando las páginas',
    'Reading every block for format, spelling and grammar. Nothing changes without your approval.': 'Revisando cada bloque en busca de errores de formato, ortografía y gramática. Nada cambia sin tu aprobación.',
    'The format pass stopped.': 'La revisión de formato se detuvo.',
    'Export without review': 'Exportar sin revisión',
    "Lumiere's read": 'Lectura de Lumiere',
    'Adjust all pending': 'Ajustar todas las pendientes',
    'Before export': 'Antes de exportar',
    'The screenplay is clean.': 'El guion está limpio.',
    'Lumiere found no confident formatting, spelling or grammar corrections.': 'Lumiere no encontró correcciones claras de formato, ortografía o gramática.',
    'Current': 'Actual',
    'Show': 'Mostrar',
    'Reject': 'Rechazar',
    'Adjust': 'Ajustar',
    'Check the current draft again': 'Revisar de nuevo el borrador actual',
    'Screenplay review complete.': 'Revisión del guion completada.',
    'Reviewed': 'Revisado',
    'Every proposed correction has been reviewed. You can continue to the PDF.': 'Todas las correcciones propuestas fueron revisadas. Puedes continuar al PDF.',
    'Export anyway': 'Exportar de todos modos',
    'Continue to PDF': 'Continuar al PDF',
    'Title Room': 'Sala de títulos',
    'Back to Lumiere chat': 'Volver al chat de Lumiere',
    'Back to title suggestions': 'Volver a las sugerencias de títulos',
    'Full screenplay analysis': 'Análisis completo del guion',
    'Syncing': 'Sincronizando',
    'Building the title board': 'Construyendo el tablero de títulos',
    'Reading every scene': 'Leyendo cada escena',
    'Lumiere is tracing conflict, tone, relationships, symbols and language across the entire script.': 'Lumiere está siguiendo el conflicto, el tono, las relaciones, los símbolos y el lenguaje a lo largo de todo el guion.',
    'What Lumiere found': 'Lo que encontró Lumiere',
    'Question': 'Pregunta',
    'Previous question': 'Pregunta anterior',
    'Direction set': 'Dirección definida',
    'Let’s open the title board.': 'Abramos el tablero de títulos.',
    'Words to include, optional': 'Palabras para incluir, opcional',
    'A word, image or phrase': 'Una palabra, imagen o frase',
    'Words to avoid, optional': 'Palabras para evitar, opcional',
    'Anything that feels wrong': 'Cualquier cosa que no encaje',
    'Reference titles, optional': 'Títulos de referencia, opcional',
    'Films with the right energy': 'Películas con la energía adecuada',
    'Generate 15 titles': 'Generar 15 títulos',
    'Refine answers': 'Afinar respuestas',
    'The title board': 'El tablero de títulos',
    'Refine': 'Afinar',
    'Regenerate': 'Regenerar',
    'Save title': 'Guardar título',
    'Lumiere is working…': 'Lumiere está trabajando…',
    'Generate variations': 'Generar variaciones',
    'Make it shorter': 'Hacerlo más corto',
    'Make it darker': 'Hacerlo más oscuro',
    'Make it more commercial': 'Hacerlo más comercial',
    'Ask Lumiere why': 'Preguntar a Lumiere por qué',
    'Compare with another title': 'Comparar con otro título',
    'The title board went dark.': 'El tablero de títulos se apagó.',
    'I read your script. Before I suggest titles, I want to understand what you want the audience to feel when they hear it.': 'Leí tu guion. Antes de sugerir títulos, quiero entender qué deseas que sienta el público al escucharlo.',
    'What should the title make the audience feel?': '¿Qué debería hacer sentir el título al público?',
    'What style feels right?': '¿Qué estilo se siente adecuado?',
    'What should the title represent most?': '¿Qué debería representar principalmente el título?',
    'How obvious should it be?': '¿Qué tan evidente debería ser?',
    'Preferred length?': '¿Longitud preferida?',
    'Curiosity': 'Curiosidad',
    'Emotion': 'Emoción',
    'Tension': 'Tensión',
    'Mystery': 'Misterio',
    'Nostalgia': 'Nostalgia',
    'Fear': 'Miedo',
    'Hope': 'Esperanza',
    'Direct': 'Directo',
    'Poetic': 'Poético',
    'Commercial': 'Comercial',
    'Minimal': 'Minimalista',
    'Metaphorical': 'Metafórico',
    'Bold': 'Audaz',
    'Conflict': 'Conflicto',
    'Theme': 'Tema',
    'Place': 'Lugar',
    'Atmosphere': 'Atmósfera',
    'Enigmatic': 'Enigmático',
    'Balanced': 'Equilibrado',
    'Explicit': 'Explícito',
    'One word': 'Una palabra',
    '2–3 words': '2–3 palabras',
    'Short phrase': 'Frase corta',
    'No preference': 'Sin preferencia',
    'Cinematic': 'Cinematográfico',
    'Festival': 'Festival',
    'From the Script': 'Del guion',
    'FilmScript Creator at $24.99 / month unlocks ongoing Lumiere work. Your scripts and manual production work remain available to edit and export.': 'FilmScript Creator por $24.99 / mes desbloquea el uso continuo de Lumiere. Tus guiones y trabajo manual de producción siguen disponibles para editar y exportar.',
    'Lumiere requires FilmScript Creator': 'Lumiere requiere FilmScript Creator',
    'Your screenplay and existing production documents remain available to edit and export. An active plan is required only to generate new work with Lumiere.': 'Tu guion y los documentos de producción existentes siguen disponibles para editar y exportar. Solo se requiere un plan activo para generar trabajo nuevo con Lumiere.',
    'Your screenplay and every existing breakdown, stripboard, shot list, and budget remain available to edit and export. An active plan is required only to generate new work with Lumiere.': 'Tu guion y todos los desgloses, planes de rodaje, listas de planos y presupuestos existentes siguen disponibles para editar y exportar. Solo se requiere un plan activo para generar trabajo nuevo con Lumiere.',
    'Canceling never deletes your scripts or existing production documents.': 'Cancelar nunca elimina tus guiones ni los documentos de producción existentes.',
    'Canceling never deletes your existing production documents.': 'Cancelar nunca elimina tus documentos de producción existentes.',
    'Free · Lumiere allowance used': 'Gratis · límite de Lumiere usado',
    'FilmScript Creator required': 'Se requiere FilmScript Creator',
    'Planning with Lumiere…': 'Planificando con Lumiere…',
    'Saving order…': 'Guardando orden…',
    'Order saved': 'Orden guardado',
    'Drag strips or use arrows': 'Arrastra las tiras o usa las flechas',
    'Saving changes': 'Guardando cambios',
    'Edits save automatically': 'Los cambios se guardan automáticamente',
    'Autosave on': 'Autoguardado activado',
    'Exporting': 'Exportando',
    'Unsaved changes': 'Cambios sin guardar',
    'Autosave off': 'Autoguardado desactivado',
    'Not saved': 'Sin guardar',
    'Saving chat': 'Guardando chat',
    'Checking credits': 'Verificando créditos',
    'Could not save this Lumiere conversation.': 'No se pudo guardar esta conversación de Lumiere.',
    'Could not open this screenplay.': 'No se pudo abrir este guion.',
    'Open a saved screenplay before entering preproduction.': 'Abre un guion guardado antes de entrar a preproducción.',
    'Preproduction is not available right now.': 'La preproducción no está disponible en este momento.',
    'Could not load preproduction data.': 'No se pudieron cargar los datos de preproducción.',
    'Lumiere could not start the analysis.': 'Lumiere no pudo iniciar el análisis.',
    'Could not save the breakdown changes.': 'No se pudieron guardar los cambios del desglose.',
    'Breakdown PDF exported.': 'PDF del desglose exportado.',
    'Could not save the shooting order.': 'No se pudo guardar el orden de rodaje.',
    'Stripboard PDF exported.': 'PDF del plan de rodaje exportado.',
    'Could not save the shot list.': 'No se pudo guardar la lista de planos.',
    'Shot List PDF exported.': 'PDF de la lista de planos exportado.',
    'Lumiere could not start this shot list.': 'Lumiere no pudo iniciar esta lista de planos.',
    'Could not save this screenplay.': 'No se pudo guardar este guion.',
    'Write or import a screenplay before exporting.': 'Escribe o importa un guion antes de exportar.',
    'Choose Save as PDF. FilmScript has formatted the document for you.': 'Elige Guardar como PDF. FilmScript ya formateó el documento.',
    'Nothing readable in that file': 'No hay contenido legible en ese archivo',
    'Could not read that PDF. Try a text-based PDF or .fs file.': 'No se pudo leer ese PDF. Prueba con un PDF basado en texto o un archivo .fs.',
    'Signed out. See you at the next draft.': 'Sesión cerrada. Nos vemos en el próximo borrador.',
    'Write or import a screenplay before running Format check.': 'Escribe o importa un guion antes de ejecutar la revisión de formato.',
    'That line changed after the format pass. Check the current draft again.': 'Esa línea cambió después de la revisión. Revisa de nuevo el borrador actual.',
    'Adjusted in the screenplay and queued for save.': 'Ajustado en el guion y en cola para guardarse.',
    'That line changed. Run Format check again.': 'Esa línea cambió. Ejecuta de nuevo la revisión de formato.',
    'No pending adjustments could be applied.': 'No se pudo aplicar ningún ajuste pendiente.',
    'Title Room could not save its latest changes.': 'La Sala de títulos no pudo guardar sus últimos cambios.',
    'Write or import more of the screenplay before opening Title Room.': 'Escribe o importa más del guion antes de abrir la Sala de títulos.',
    'The projection room lost the analysis. Try again.': 'La sala de proyección perdió el análisis. Intenta de nuevo.',
    'Lumiere could not finish the title board. Try generating again.': 'Lumiere no pudo terminar el tablero de títulos. Intenta generarlo de nuevo.',
    'Lumiere could not compare those titles.': 'Lumiere no pudo comparar esos títulos.',
    'Lumiere could not create that variation.': 'Lumiere no pudo crear esa variación.',

    // Editor menus and document settings.
    'Title Page Designer': 'Diseñador de portada',
    'Revision History': 'Historial de revisiones',
    'Autosave Settings': 'Ajustes de autoguardado',
    'Renumber': 'Renumerar',
    'Import Screenplay': 'Importar guion',
    'A centered screenplay cover. It appears before page one and stays separate from the script.': 'Una portada de guion centrada. Aparece antes de la primera página y permanece separada del guion.',
    'Title': 'Título',
    'Credit': 'Crédito',
    'Author': 'Autor',
    'Contact': 'Contacto',
    'Include the title page in the script': 'Incluir la portada en el guion',
    'Every save becomes a revision, in classic production colors.': 'Cada guardado se convierte en una revisión con los colores clásicos de producción.',
    'No revisions yet. Start typing and the first one will appear here.': 'Aún no hay revisiones. Empieza a escribir y la primera aparecerá aquí.',
    'Restore': 'Restaurar',
    'Your pages save on this device while you type.': 'Tus páginas se guardan en este dispositivo mientras escribes.',
    'Autosave while I write': 'Guardar automáticamente mientras escribo',
    'Save after a pause of': 'Guardar después de una pausa de',
    'Instantly': 'Al instante',
    '1 second': '1 segundo',
    '5 seconds': '5 segundos',

    // Connected preproduction.
    'Connected preproduction': 'Preproducción conectada',
    'FilmScript Creator inactive': 'FilmScript Creator inactivo',
    'Your existing production work stays yours.': 'Tu trabajo de producción existente sigue siendo tuyo.',
    'Keep editing and exporting existing breakdowns, stripboards, shot lists, and budgets. An active plan is required only to generate new work with Lumiere.': 'Sigue editando y exportando desgloses, planes de rodaje, listas de planos y presupuestos existentes. Solo se requiere un plan activo para generar trabajo nuevo con Lumiere.',
    'Keep editing and exporting existing breakdowns, stripboards, shot lists, budgets, and calendars. An active plan is required only to generate new work with Lumiere.': 'Sigue editando y exportando desgloses, planes de rodaje, listas de planos, presupuestos y calendarios existentes. Solo se requiere un plan activo para generar trabajo nuevo con Lumiere.',
    'Keep editing existing breakdowns, stripboards, shot lists, budgets, and calendars, with exports where available. An active plan is required only to generate new work with Lumiere.': 'Sigue editando tus desgloses, planes de rodaje, listas de planos, presupuestos y calendarios existentes, con exportaciones donde estén disponibles. Solo se requiere un plan activo para generar trabajo nuevo con Lumiere.',
    'Keep editing and exporting existing documents. Creator unlocks ongoing Lumiere text generation.': 'Sigue editando y exportando documentos existentes. Creator desbloquea la generación continua de texto con Lumiere.',
    'Loading screenplay data…': 'Cargando datos del guion…',
    'Loading production plan…': 'Cargando plan de producción…',
    'Synced': 'Sincronizado',
    'Outdated': 'Desactualizado',
    'Needs review': 'Requiere revisión',
    'Not set': 'Sin definir',
    'Edit sheet': 'Editar hoja',
    'Save sheet': 'Guardar hoja',
    'Turn your screenplay into a production plan': 'Convierte tu guion en un plan de producción',
    'Analyze every scene to identify cast, props, locations, wardrobe, and everything required to produce it.': 'Analiza cada escena para identificar reparto, utilería, locaciones, vestuario y todo lo necesario para producirla.',
    'Analyze screenplay with Lumiere': 'Analizar guion con Lumiere',
    'Organize your shoot': 'Organiza tu rodaje',
    'Create a breakdown first so FilmScript can build the shooting plan.': 'Primero crea un desglose para que FilmScript pueda construir el plan de rodaje.',
    'Create breakdown': 'Crear desglose',
    'Plan how your film will look': 'Planifica cómo se verá tu película',
    'Generate practical camera coverage for every scene.': 'Genera propuestas prácticas de cámara para cada escena.',
    'Generate shot lists with Lumiere': 'Generar listas de planos con Lumiere',
    'Scene coverage': 'Cobertura por escenas',
    'Shot list scenes': 'Escenas de la lista de planos',
    'Screenplay scene': 'Escena del guion',
    'Manual scene': 'Escena manual',
    'Manual scene name': 'Nombre de la escena manual',
    '+ Add scene': '+ Agregar escena',
    'Adding scene…': 'Agregando escena…',
    '+ Add shot': '+ Agregar plano',
    'Add first shot': 'Agregar primer plano',
    'Edit shots': 'Editar planos',
    'Generate with Lumiere': 'Generar con Lumiere',
    'FilmScript Creator required': 'Se requiere FilmScript Creator',
    'Planning…': 'Planificando…',
    'Start with a scene': 'Empieza con una escena',
    'Add a manual scene for pickups or begin writing scene headings in the screenplay.': 'Agrega una escena manual para pickups o empieza a escribir encabezados de escena en el guion.',
    'No shots planned for this scene': 'No hay planos para esta escena',
    'Build the camera plan manually or let Lumiere create a first pass.': 'Construye el plan de cámara manualmente o deja que Lumiere haga una primera propuesta.',
    'Use Add shot for a manual plan, or Generate with Lumiere for a first pass.': 'Usa Agregar plano para un plan manual o Generar con Lumiere para una primera propuesta.',
    'Delete manual scene': 'Eliminar escena manual',
    'Delete this manual scene and all of its shots?': '¿Eliminar esta escena manual y todos sus planos?',
    'Could not add the scene.': 'No se pudo agregar la escena.',
    'Could not rename the scene.': 'No se pudo renombrar la escena.',
    'Could not delete the scene.': 'No se pudo eliminar la escena.',
    'Active screenplay': 'Guion activo',
    'Breakdown, stripboard and shot lists stay connected to this script.': 'El desglose, el plan de rodaje y las listas de planos permanecen conectados a este guion.',
    'Shooting order': 'Orden de rodaje',
    'Drag any strip to reorder': 'Arrastra cualquier tira para reordenar',
    'Keyboard order': 'Ordenar con teclado',
    'INT DAY': 'INT DAY',
    'EXT DAY': 'EXT DAY',
    'INT NIGHT': 'INT NIGHT',
    'EXT NIGHT': 'EXT NIGHT',
    'DAWN': 'AMANECER',
    'Shooting order. Drag any strip to reorder scenes.': 'Orden de rodaje. Arrastra cualquier tira para reordenar las escenas.',
    'Drag each strip to set the shooting order. Changes save automatically.': 'Arrastra cada tira para definir el orden de rodaje. Los cambios se guardan automáticamente.',
    'Camera coverage': 'Cobertura de cámara',
    'Every proposal stays attached to this scene and can be refined by hand.': 'Cada propuesta permanece vinculada a esta escena y puede ajustarse manualmente.',
    'Shot': 'Plano',
    'Size': 'Tamaño',
    'Angle': 'Ángulo',
    'Movement': 'Movimiento',
    'Description': 'Descripción',
    'Order': 'Orden',
    '+ Add shot': '+ Agregar plano',
    'Edit shots': 'Editar planos',
    'Save shots': 'Guardar planos',
    'Generate with Lumiere': 'Generar con Lumiere',
    'Add first shot': 'Agregar primer plano',
    'No shots planned for this scene': 'No hay planos para esta escena',
    'Build the camera plan manually or let Lumiere create a first pass.': 'Construye el plan de cámara manualmente o deja que Lumiere cree una primera propuesta.',
    'Lumiere is reading the scene and planning coverage. You can keep working while it finishes.': 'Lumiere está leyendo la escena y planificando la cobertura. Puedes seguir trabajando mientras termina.',
    'Move shot up': 'Mover plano hacia arriba',
    'Move shot down': 'Mover plano hacia abajo',
    'Delete shot': 'Eliminar plano',
    'e.g. Wide': 'p. ej., General',
    'e.g. Eye level': 'p. ej., A la altura de los ojos',
    'e.g. Static': 'p. ej., Estático',
    'Describe what the camera captures': 'Describe lo que captura la cámara',
    'Scene #': 'Escena n.º',
    'Script Page': 'Página de guion',
    'Page Count': 'Cantidad de páginas',
    'Sheet #': 'Hoja n.º',
    'Int/Ext': 'Int/Ext',
    'Day/Night': 'Día/Noche',
    'Est. Time': 'Tiempo est.',
    'Scene Description': 'Descripción de escena',
    'Set': 'Set',
    'Location': 'Locación',
    'Sequence': 'Secuencia',
    'Script Day': 'Día de guion',
    'Script page': 'Página de guion',
    'Page count': 'Cantidad de páginas',
    'Interior or exterior': 'Interior o exterior',
    'Day or night': 'Día o noche',
    'Estimated time': 'Tiempo estimado',
    'Scene description': 'Descripción de escena',
    'Script day': 'Día de guion',
    'Cast': 'Reparto',
    'Extras': 'Extras',
    'Props': 'Utilería',
    'Stunts': 'Dobles y acrobacias',
    'Vehicles / Animals': 'Vehículos / Animales',
    'Special FX': 'Efectos especiales',
    'Wardrobe': 'Vestuario',
    'Makeup / Hair': 'Maquillaje / Peinado',
    'Set Dressing': 'Ambientación de set',
    'Greenery': 'Vegetación',
    'Special Equipment': 'Equipo especial',
    'Notes': 'Notas',
    'Music': 'Música',
    'Sound': 'Sonido',
    'Safety Notes': 'Notas de seguridad',
    'Production Notes': 'Notas de producción',

    // Editor · connected production controls and accessible names.
    'Lumiere pass used': 'Uso de Lumiere agotado',
    'Keep editing breakdowns, stripboards, shot lists, budgets, and calendars. Creator unlocks more Lumiere; Full also includes 1,000 image credits each month.': 'Sigue editando desgloses, planes de rodaje, listas de planos, presupuestos y calendarios. Creator desbloquea más usos de Lumiere; Full también incluye 1,000 créditos de imagen al mes.',
    'Loading Breakdown': 'Cargando desglose',
    'Preparing your Breakdown': 'Preparando tu desglose',
    'Opening the screenplay, organizing its scenes and connecting every production department.': 'Abriendo el guion, organizando sus escenas y conectando cada departamento de producción.',
    'Organizing scene departments…': 'Organizando departamentos de la escena…',
    'Choose your starting point': 'Elige cómo empezar',
    'Build the breakdown your way.': 'Crea el desglose a tu manera.',
    'Start with clean, connected sheets for every scene — or let Lumiere read the screenplay and prepare the first pass for you.': 'Empieza con hojas limpias y conectadas para cada escena, o deja que Lumiere lea el guion y prepare una primera propuesta.',
    'Hands-on': 'Manual',
    'Build it manually': 'Crear manualmente',
    'Open an editable breakdown sheet for each scene. Add exactly what the production needs, at your own pace.': 'Abre una hoja de desglose editable para cada escena. Agrega exactamente lo que necesita la producción, a tu ritmo.',
    'No Lumiere credits needed': 'No requiere créditos de Lumiere',
    'Analyze the screenplay': 'Analizar el guion',
    'Lumiere identifies cast, props, wardrobe, locations and production notes, then opens the result here as it completes.': 'Lumiere identifica reparto, utilería, vestuario, locaciones y notas de producción, y muestra aquí los resultados conforme termina.',
    'Whichever path you choose, every field stays editable and connected to the rest of FilmScript.': 'Elijas el camino que elijas, cada campo seguirá editable y conectado con el resto de FilmScript.',
    'Previous breakdown scene': 'Escena anterior del desglose',
    'Next breakdown scene': 'Escena siguiente del desglose',
    'Generate this manual breakdown with Lumiere': 'Generar este desglose manual con Lumiere',
    'More breakdown export options': 'Más opciones de exportación del desglose',
    'Export breakdown by department': 'Exportar desglose por departamento',
    'Export a department packet': 'Exportar paquete de departamento',
    'Only the selected department’s elements are included.': 'Solo se incluyen los elementos del departamento seleccionado.',
    'Print': 'Imprimir',
    'Lumiere breakdown generation progress': 'Progreso de generación del desglose con Lumiere',
    'Generating your full breakdown': 'Generando tu desglose completo',
    'Editable screenplay beside breakdown': 'Guion editable junto al desglose',
    'Script': 'Guion',
    'Edit while you break down the scene': 'Edita mientras desglosas la escena',
    'Opening screenplay…': 'Abriendo guion…',
    'Editable screenplay': 'Guion editable',
    'Breakdown scene navigation': 'Navegación de escenas del desglose',
    'Breakdown sheet. Click any field to edit.': 'Hoja de desglose. Haz clic en cualquier campo para editarlo.',
    'Production Breakdown': 'Desglose de producción',
    'None listed': 'No hay elementos',
    'Production schedule': 'Plan de producción',
    'Version history': 'Historial de versiones',
    'Production schedule version history': 'Historial de versiones del plan de producción',
    'Drafts are saved at most every 10 minutes, only when the schedule truly changed.': 'Los borradores se guardan como máximo cada 10 minutos y solo cuando el plan realmente cambió.',
    'milestone': 'hito',
    'Compare': 'Comparar',
    'Duplicate': 'Duplicar',
    'Rename': 'Renombrar',
    'Draft 1 is created when the schedule opens. Further drafts appear after 10 minutes of real changes.': 'El borrador 1 se crea al abrir el plan. Los siguientes aparecen después de 10 minutos de cambios reales.',
    'Day starts at': 'El día comienza a las',
    '+ Break': '+ Pausa',
    'Lunch · 60 min': 'Almuerzo · 60 min',
    'Move company · 30 min': 'Traslado de equipo · 30 min',
    'End of day': 'Fin del día',
    '+ Scene': '+ Escena',
    'Actions for selected scenes': 'Acciones para las escenas seleccionadas',
    'Shoot location': 'Locación de rodaje',
    'Assign shoot location to selected scenes': 'Asignar locación de rodaje a las escenas seleccionadas',
    'Selected strips': 'Tiras seleccionadas',
    'Assign a shoot location': 'Asignar una locación de rodaje',
    'Apply one real-world filming location to every selected scene.': 'Aplica una misma locación real de filmación a todas las escenas seleccionadas.',
    'Quick assign': 'Asignación rápida',
    'Most recently used': 'Usada recientemente',
    'Assign →': 'Asignar →',
    'e.g. Stage 4, Downtown Studio': 'p. ej., Foro 4, Estudio del centro',
    'Saved shoot locations': 'Locaciones de rodaje guardadas',
    'Unassign': 'Desasignar',
    'Assign': 'Asignar',
    'Manage cast for selected scenes': 'Gestionar reparto de las escenas seleccionadas',
    'Manage cast': 'Gestionar reparto',
    'Cast IDs stay connected to the numbering established in Breakdown.': 'Los IDs de reparto permanecen conectados con la numeración establecida en el desglose.',
    'Cast action': 'Acción de reparto',
    'Add': 'Agregar',
    'Remove': 'Quitar',
    'Create or refresh the Breakdown first so FilmScript can establish cast IDs.': 'Primero crea o actualiza el desglose para que FilmScript pueda establecer los IDs de reparto.',
    'Remove all': 'Quitar todo',
    'Clear scene selection': 'Borrar selección de escenas',
    'I/E & day': 'I/E y momento',
    'Cast ID': 'ID de reparto',
    'Pages': 'Páginas',
    'Est. time': 'Tiempo est.',
    'Start time': 'Hora de inicio',
    'Open this scene in the script': 'Abrir esta escena en el guion',
    'Cast IDs from Breakdown': 'IDs de reparto del desglose',
    'Real-world location': 'Locación real',
    'Where this scene will actually be filmed. This stays separate from the screenplay set.': 'El lugar real donde se filmará esta escena. Se mantiene separado del set indicado en el guion.',
    'New location': 'Nueva locación',
    'Other saved locations': 'Otras locaciones guardadas',
    'Clear': 'Borrar',
    'Save & assign': 'Guardar y asignar',
    'No production notes for this scene': 'No hay notas de producción para esta escena',
    'Shooting days calendar': 'Calendario de días de rodaje',
    'Break duration': 'Duración de la pausa',
    'Set the duration. The Stripboard schedule updates instantly.': 'Define la duración. El plan de rodaje se actualiza al instante.',
    'Set the scene duration. Every following start time updates instantly.': 'Define la duración de la escena. Todas las horas de inicio siguientes se actualizan al instante.',
    'Duration clock': 'Selector de duración',
    'Increase hours': 'Aumentar horas',
    'Hours': 'Horas',
    'Decrease hours': 'Disminuir horas',
    'Increase minutes by 15': 'Aumentar 15 minutos',
    'Minutes': 'Minutos',
    'Decrease minutes by 15': 'Disminuir 15 minutos',
    'Exact duration': 'Duración exacta',
    'Exact duration in minutes': 'Duración exacta en minutos',
    'minutes': 'minutos',
    'Clear estimate': 'Borrar estimación',
    '← Canvas': '← Canvas',
    'Stripboard time': 'Tiempo del plan de rodaje',
    'Reference': 'Referencia',
    'Lens': 'Lente',
    'Time': 'Tiempo',
    'View': 'Ver',
    'Generating…': 'Generando…',
    'Reference preview': 'Vista previa de referencia',
    'Regenerate': 'Regenerar',
    'Generate': 'Generar',
    'Scene ref': 'Referencia de escena',
    'Shot duration': 'Duración del plano',
    'Camera time': 'Tiempo de cámara',
    'Set hours and minutes. Every value follows 15-minute intervals.': 'Define horas y minutos. Todos los valores usan intervalos de 15 minutos.',
    'Shot duration clock': 'Selector de duración del plano',
    'Set duration in 15-minute intervals': 'Definir duración en intervalos de 15 minutos',
    'No description': 'Sin descripción',
    'Creator or Full required': 'Se requiere Creator o Full',
    'Time full': 'Tiempo completo',

    // Editor · operational feedback.
    'Could not copy the prompt. Select it and copy it manually.': 'No se pudo copiar el prompt. Selecciónalo y cópialo manualmente.',
    'Recovered the latest local screenplay changes.': 'Se recuperaron los cambios locales más recientes del guion.',
    'Analysis is not available right now.': 'El análisis no está disponible en este momento.',
    'Canvas is not available right now.': 'Canvas no está disponible en este momento.',
    'Budget is not available right now.': 'El presupuesto no está disponible en este momento.',
    'Calendar is not available right now.': 'El calendario no está disponible en este momento.',
    'Could not load Shot List data.': 'No se pudieron cargar los datos de la lista de planos.',
    'This is a manual shot-list scene and has no screenplay source.': 'Esta es una escena manual de la lista de planos y no tiene una fuente en el guion.',
    'This scene is already over its Stripboard time. Reduce coverage before adding time.': 'Esta escena ya excede su tiempo en el plan de rodaje. Reduce la cobertura antes de agregar tiempo.',
    'Choose a PNG, JPEG, or WebP image.': 'Elige una imagen PNG, JPEG o WebP.',
    'Choose a PNG, JPEG, or WebP reference image': 'Elegir una imagen de referencia PNG, JPEG o WebP',
    'Scene headings start with INT. or EXT.': 'Los encabezados de escena comienzan con INT. o EXT.',
    'Nothing readable in that PDF': 'No hay contenido legible en ese PDF',
    'Write or import more of the screenplay before generating character names.': 'Escribe o importa más del guion antes de generar nombres de personajes.',
    'That line changed after Lumiere reviewed it. Run the Clichés pass again.': 'Esa línea cambió después de que Lumiere la revisó. Ejecuta de nuevo la revisión de clichés.',
    'Cliché highlighted in the screenplay.': 'Cliché resaltado en el guion.',
    'Your manual breakdown is ready to edit.': 'Tu desglose manual está listo para editar.',
    'Could not create the manual breakdown. Please try again.': 'No se pudo crear el desglose manual. Inténtalo de nuevo.',
    'Lumiere is reading the screenplay. You can keep working while the breakdown is prepared.': 'Lumiere está leyendo el guion. Puedes seguir trabajando mientras se prepara el desglose.',
    'Lumiere is preparing the breakdown. Your filled manual fields stay in place.': 'Lumiere está preparando el desglose. Los campos manuales que completaste se conservan.',
    'Lumiere could not start the manual breakdown generation.': 'Lumiere no pudo iniciar la generación del desglose manual.',
    'Production data refreshed.': 'Datos de producción actualizados.',
    'Breakdown is up to date.': 'El desglose está actualizado.',
    'Lumiere is already updating this breakdown.': 'Lumiere ya está actualizando este desglose.',
    'Lumiere is updating the changed scenes.': 'Lumiere está actualizando las escenas modificadas.',
    'Could not refresh the breakdown.': 'No se pudo actualizar el desglose.',
    'The source line changed. Refresh the breakdown to reconnect it.': 'La línea de origen cambió. Actualiza el desglose para volver a conectarla.',
    'Breakdown saved. Links are active again.': 'Desglose guardado. Los vínculos están activos de nuevo.',
    'Breakdown PDF downloaded.': 'PDF del desglose descargado.',
    'Could not export the Breakdown PDF.': 'No se pudo exportar el PDF del desglose.',
    'Please allow pop-ups to export this packet.': 'Permite las ventanas emergentes para exportar este paquete.',
    'Choose Save as PDF in the print dialog.': 'Elige Guardar como PDF en el diálogo de impresión.',
    'Print packet ready.': 'Paquete listo para imprimir.',
    'Schedule milestone saved.': 'Hito del plan guardado.',
    'Version duplicated.': 'Versión duplicada.',
    'Could not add the scene.': 'No se pudo agregar la escena.',
    'Could not rename the scene.': 'No se pudo renombrar la escena.',
    'Could not delete the scene.': 'No se pudo eliminar la escena.',
    'Scene time is full. Reduce a shot time or increase it in the Stripboard.': 'La duración de la escena está completa. Reduce la duración de un plano o auméntala en el plan de rodaje.',
    'Your full Lumiere breakdown is ready.': 'Tu desglose completo de Lumiere está listo.',
    'Lumiere could not start the full breakdown. Please try again.': 'Lumiere no pudo iniciar el desglose completo. Inténtalo de nuevo.',
    'Lumiere stopped before the breakdown was complete.': 'Lumiere se detuvo antes de completar el desglose.',
    'This shot changed for another collaborator. Review their edit before replacing it.': 'Otro colaborador modificó este plano. Revisa su cambio antes de reemplazarlo.',
    'Reference images must be under 6 MB.': 'Las imágenes de referencia deben pesar menos de 6 MB.',
    'Reference uploads are not available right now.': 'La carga de referencias no está disponible en este momento.',
    'Could not save the reference image.': 'No se pudo guardar la imagen de referencia.',
    'Your visual library is not available right now.': 'Tu biblioteca visual no está disponible en este momento.',
    'Could not load your visual library.': 'No se pudo cargar tu biblioteca visual.',
    'That visual is no longer available.': 'Ese recurso visual ya no está disponible.',
    'Connected visual references are not available right now.': 'Las referencias visuales conectadas no están disponibles en este momento.',
    'Reference added from your visual library.': 'Referencia agregada desde tu biblioteca visual.',
    'Could not add that reference image.': 'No se pudo agregar esa imagen de referencia.',
    'Reference image generated.': 'Imagen de referencia generada.',
    'Could not generate the reference image.': 'No se pudo generar la imagen de referencia.',
    'Reference image downloaded.': 'Imagen de referencia descargada.',
    'Could not download this image. Please try again.': 'No se pudo descargar esta imagen. Inténtalo de nuevo.',

    // Marketing / Features.
    'FilmScript | Write it. See it. Make it.': 'FilmScript | Escríbelo. Visualízalo. Hazlo.',
    'From first page to final delivery': 'De la primera página a la entrega final',
    'Write it.': 'Escríbelo.',
    'See it.': 'Visualízalo.',
    'Make it.': 'Hazlo.',
    'FilmScript connects every stage of production to the same screenplay, from writing and visual planning through breakdowns, budgets and the final delivery calendar.': 'FilmScript conecta cada etapa de producción con el mismo guion, desde la escritura y la planificación visual hasta los desgloses, presupuestos y el calendario final de entrega.',
    'Compare plans': 'Comparar planes',
    'Built for filmmakers, studios and production teams.': 'Creado para cineastas, estudios y equipos de producción.',
    'Boards, references and visual direction': 'Tableros, referencias y dirección visual',
    'Milestones, dependencies and delivery': 'Hitos, dependencias y entrega',
    'Plan, actuals and cash flow': 'Plan, gastos reales y flujo de caja',
    'One connected workspace': 'Un espacio de trabajo conectado',
    'Every part of the film starts with the same script.': 'Cada parte de la película nace del mismo guion.',
    'Write the scene once. FilmScript keeps the creative, production and financial decisions beside it all the way to delivery.': 'Escribe la escena una vez. FilmScript mantiene a su lado las decisiones creativas, de producción y financieras hasta la entrega.',
    'Write': 'Escribe',
    'Write in a production-ready screenplay editor with smart formatting, autosave, imports and PDF export.': 'Escribe en un editor de guion listo para producción, con formato inteligente, guardado automático, importación y exportación a PDF.',
    'Collaborate': 'Colabora',
    'Explore titles, character names and scene directions while keeping every creative decision yours.': 'Explora títulos, nombres de personajes y direcciones de escena sin dejar de controlar cada decisión creativa.',
    'Visual development': 'Desarrollo visual',
    'Collect references, build boards and develop the visual direction of each scene beside the screenplay.': 'Reúne referencias, crea tableros y desarrolla la dirección visual de cada escena junto al guion.',
    'Understand': 'Comprende',
    'See story flow, priority scenes, production impact and the screenplay evidence behind every insight.': 'Consulta el flujo de la historia, las escenas prioritarias, el impacto de producción y la evidencia del guion detrás de cada observación.',
    'Prepare': 'Prepara',
    'Build editable scene sheets for cast, props, wardrobe, sound and every production element.': 'Crea fichas de escena editables para reparto, utilería, vestuario, sonido y cada elemento de producción.',
    'Reorder scenes, assign cast and locations, set timings and day breaks, then shape the shooting plan.': 'Reordena escenas, asigna reparto y locaciones, define tiempos y cortes de jornada, y da forma al plan de rodaje.',
    'Plan coverage with lens, movement, reference images and time connected to the Stripboard.': 'Planifica la cobertura con lente, movimiento, imágenes de referencia y tiempos conectados al plan de rodaje.',
    'Control': 'Controla',
    'Track planned and actual costs, funding, cash flow, expenses, receipts and tax in one production view.': 'Controla costos planificados y reales, financiamiento, flujo de caja, gastos, recibos e impuestos en una sola vista de producción.',
    'Deliver': 'Entrega',
    'Move from development to delivery with dependencies, milestones, critical path and live progress.': 'Avanza del desarrollo a la entrega con dependencias, hitos, ruta crítica y progreso en vivo.',
    'One change moves through the whole production.': 'Un cambio recorre toda la producción.',
    'Update a scene and the next decisions stay traceable, from the visual idea to the final date on the calendar.': 'Actualiza una escena y las decisiones siguientes siguen siendo rastreables, desde la idea visual hasta la fecha final del calendario.',
    'The source': 'La fuente',
    'The visual world': 'El mundo visual',
    'Scene requirements': 'Necesidades de la escena',
    'The shooting order': 'El orden de rodaje',
    'Plan and actuals': 'Plan y gastos reales',
    'The final milestone': 'El hito final',
    'One script. One source of truth.': 'Un guion. Una sola fuente de verdad.',
    'Open FilmScript and keep every creative and production decision connected from the first scene to delivery.': 'Abre FilmScript y mantén conectada cada decisión creativa y de producción desde la primera escena hasta la entrega.',
    'FilmScript · From the page to the production.': 'FilmScript · De la página a la producción.',
    'This replaces your current plan. Your FilmScript work stays exactly where it is; only your access changes.': 'Esto reemplaza tu plan actual. Tu trabajo en FilmScript permanece exactamente donde está; solo cambia tu acceso.',
    'A screenplay connected to FilmScript production tools': 'Un guion conectado con las herramientas de producción de FilmScript',
    'A screenplay page with a Lumiere note': 'Una página de guion con una nota de Lumiere',
    'Connected FilmScript modules': 'Módulos conectados de FilmScript',
    'Explore FilmScript features': 'Explorar las funciones de FilmScript',
    'FilmScript screenplay editor illustration': 'Ilustración del editor de guion de FilmScript',
    'A conversation with Lumiere': 'Una conversación con Lumiere',
    'FilmScript Imagine visual board illustration': 'Ilustración de un tablero visual de Imagine en FilmScript',
    'FilmScript analysis chart illustration': 'Ilustración de una gráfica de análisis de FilmScript',
    'Scene breakdown illustration': 'Ilustración de un desglose de escena',
    'FilmScript stripboard illustration': 'Ilustración del plan de rodaje de FilmScript',
    'FilmScript shot list illustration': 'Ilustración de la lista de planos de FilmScript',
    'FilmScript budget illustration': 'Ilustración del presupuesto de FilmScript',
    'FilmScript production calendar illustration': 'Ilustración del calendario de producción de FilmScript',
    'FilmScript connected workflow': 'Flujo conectado de FilmScript',
    'Go to Script Editor': 'Ir al Editor de guion',
    'Go to Imagine': 'Ir a Imagine',
    'Go to Breakdown': 'Ir al Desglose',
    'Go to Stripboard': 'Ir al Plan de rodaje',
    'Go to Budget': 'Ir al Presupuesto',
    'Go to Calendar': 'Ir al Calendario',
    'Sign up free': 'Crear cuenta gratis',
    'Write the script. FilmScript handles the rest.': 'Escribe el guion. FilmScript se encarga del resto.',
    'A professional screenplay editor with an AI companion named Lumiere. Write your pages, then turn them into breakdowns, stripboards and shot lists. All text, all yours.': 'Un editor profesional de guion con un compañero de IA llamado Lumiere. Escribe tus páginas y conviértelas en desgloses, planes de rodaje y listas de planos. Todo el texto, completamente tuyo.',
    'Start writing': 'Empezar a escribir',
    'See pricing': 'Ver precios',
    'Start creating with FilmScript Full · $39.99/month': 'Empieza a crear con FilmScript Full · $39.99/mes',
    '"This line leans on a cliché. Want a sharper image?"': '"Esta línea se apoya en un cliché. ¿Quieres una imagen más precisa?"',
    'reading Scene 12': 'leyendo la escena 12',
    'Run a full analysis on act two. Where does the tension sag?': 'Haz un análisis completo del segundo acto. ¿Dónde pierde fuerza la tensión?',
    'This line leans on a familiar image. What sharper detail could make the moment yours?': 'Esta línea usa una imagen conocida. ¿Qué detalle más preciso podría hacer tuyo el momento?',
    'Done. The report maps pacing, structure and repeated beats, with evidence from your pages.': 'Listo. El informe muestra ritmo, estructura y repeticiones con evidencia de tus páginas.',
    'Step 01 · Write': 'Paso 01 · Escribe',
    'A real Hollywood format editor.': 'Un verdadero editor con formato de Hollywood.',
    'Scene headings, action, dialogue and transitions, all on industry standard margins. The page feels like paper and sounds like a typewriter.': 'Encabezados de escena, acción, diálogo y transiciones, todo con márgenes estándar de la industria. La página se siente como papel y suena como una máquina de escribir.',
    'Format at one key. Tab cycles the block types, ⌘1 to ⌘6 jumps straight to one.': 'Formato con una tecla. Tab recorre los tipos de bloque y ⌘1 a ⌘6 salta directamente a cada uno.',
    'Typewriter sound you can mute any time.': 'Sonido de máquina de escribir que puedes silenciar cuando quieras.',
    'Hand drawn pages, light and dark, WGA checked as you type.': 'Páginas dibujadas a mano, claras u oscuras, revisadas con formato WGA mientras escribes.',
    'INT. WRITING ROOM. DAY': 'INT. SALA DE ESCRITURA. DÍA',
    'Start with a blank page. Shape the scene, then let FilmScript handle the format.': 'Empieza con una página en blanco. Dale forma a la escena y deja que FilmScript se encargue del formato.',
    '(barely audible)': '(apenas audible)',
    'Write the moment exactly as you see it.': 'Escribe el momento exactamente como lo ves.',
    'Your next line starts here.': 'Tu siguiente línea empieza aquí.',
    'Step 02 · Refine': 'Paso 02 · Refina',
    'Lumiere reads. You decide.': 'Lumiere lee. Tú decides.',
    'An AI companion that never writes a line for you. It reads like a great script editor and hands the pages back sharper.': 'Un compañero de IA que nunca escribe una línea por ti. Lee como un gran editor de guion y te devuelve páginas más precisas.',
    'Cliché detector flags tired phrases the moment they land.': 'El detector de clichés señala frases gastadas en cuanto aparecen.',
    'Script analysis maps structure, pacing and character arcs into a readable report.': 'El análisis de guion convierte estructura, ritmo y arcos de personaje en un informe claro.',
    'Spotless spelling and grammar, without breaking your flow.': 'Ortografía y gramática impecables sin interrumpir tu flujo.',
    'Step 03 · Break down': 'Paso 03 · Desglosa',
    'One click turns a scene into a breakdown sheet.': 'Un clic convierte una escena en una hoja de desglose.',
    'Lumiere reads every scene and tags the cast, props, wardrobe and sound it finds. You review, adjust, and export clean breakdown sheets ready for production.': 'Lumiere lee cada escena y etiqueta el reparto, utilería, vestuario y sonido que encuentra. Tú revisas, ajustas y exportas hojas de desglose limpias, listas para producción.',
    'Elements tagged by category, scene by scene.': 'Elementos etiquetados por categoría, escena por escena.',
    'A first pass drafted for you. Nothing is final until you approve it.': 'Una primera propuesta preparada para ti. Nada es definitivo hasta que lo apruebes.',
    'Breakdown summaries and element lists as plain text documents.': 'Resúmenes de desglose y listas de elementos como documentos de texto.',
    'Step 04 · Schedule': 'Paso 04 · Programa',
    'Every scene becomes a strip. Drag them into days.': 'Cada escena se convierte en una tira. Arrástralas entre días.',
    'The classic stripboard, kept simple. Strips carry scene number, set, time of day and page count. Move one and the day breaks recalculate.': 'El plan de rodaje clásico, simplificado. Las tiras incluyen número de escena, set, momento del día y páginas. Mueve una y los cortes de día se recalculan.',
    'Colors follow the old convention: day, night, interior, exterior.': 'Los colores siguen la convención clásica: día, noche, interior y exterior.',
    'Day breaks total your pages so you never overplan a day.': 'Los cortes de día suman tus páginas para que nunca sobrecargues una jornada.',
    'Export the board as a one page shooting schedule.': 'Exporta el tablero como un plan de rodaje de una página.',
    'DAY': 'DÍA',
    'NIGHT': 'NOCHE',
    'END OF DAY 1': 'FIN DEL DÍA 1',
    '4 1/8 pages': '4 1/8 páginas',
    'Step 05 · Shoot': 'Paso 05 · Rueda',
    'Plan every shot before you roll.': 'Planifica cada plano antes de rodar.',
    'Build a shot list per scene with the specs that matter: size, angle, movement and a line of intent. Print it, share it, check it off on the day.': 'Crea una lista de planos por escena con los datos que importan: tamaño, ángulo, movimiento e intención. Imprímela, compártela y márcala durante el rodaje.',
    'Preset shot sizes and angles keep the list consistent.': 'Los tamaños y ángulos predefinidos mantienen la lista consistente.',
    'Lumiere suggests coverage from the scene text. You keep what serves the story.': 'Lumiere sugiere cobertura a partir del texto de la escena. Tú conservas lo que sirve a la historia.',
    'Exports as a clean text document your crew can read anywhere.': 'Se exporta como un documento de texto limpio que tu equipo puede leer en cualquier lugar.',
    'Move': 'Movimiento',
    'Wide': 'General',
    'Close up': 'Primer plano',
    'Medium': 'Medio',
    'Insert': 'Inserto',
    'Eye level': 'A la altura de los ojos',
    'High': 'Picado',
    'Over shoulder': 'Sobre el hombro',
    'Top down': 'Cenital',
    'Static': 'Estático',
    'Dolly in': 'Dolly de acercamiento',
    'Pan': 'Paneo',
    "Establish the space and the character's intention": 'Presenta el espacio y la intención del personaje',
    'Hold on the detail that changes the scene': 'Mantén el detalle que cambia la escena',
    'Follow the exchange without losing the room': 'Sigue el intercambio sin perder el espacio',
    'Tea gone cold, untouched': 'El té se ha enfriado, intacto',
    'Every document, plain text out.': 'Todos los documentos, en texto limpio.',
    'No renders, no heavy assets. Clean documents you can print, share or paste anywhere.': 'Sin renders ni archivos pesados. Documentos limpios que puedes imprimir, compartir o pegar donde quieras.',
    'Screenplay PDF': 'Guion en PDF',
    'Script analysis': 'Análisis de guion',
    'Breakdown sheets': 'Hojas de desglose',
    'Ready when you are.': 'Listo cuando tú lo estés.',
    'Questions, answered.': 'Preguntas, respondidas.',
    'Does Lumiere write my script?': '¿Lumiere escribe mi guion?',
    'No. Lumiere never adds a single line. It reads what you wrote and helps you make it sharper.': 'No. Lumiere nunca agrega una sola línea. Lee lo que escribiste y te ayuda a hacerlo más preciso.',
    'Can I switch plans later?': '¿Puedo cambiar de plan después?',
    'Yes. Move between Free, Creator, and Full at any time. Your existing scripts and production work stay available.': 'Sí. Cambia entre Free, Creator y Full cuando quieras. Tus guiones y trabajo de producción existentes seguirán disponibles.',
    'What do my pages export to?': '¿En qué formato se exportan mis páginas?',
    'Industry standard PDF, WGA checked, ready to send the moment you finish.': 'PDF estándar de la industria, revisado según WGA y listo para enviar al terminar.',
    'Which plan makes the production documents?': '¿Qué plan crea los documentos de producción?',
    'Breakdowns, stripboards, shot lists and script analysis are Lumiere features, included in Creator and Full.': 'Los desgloses, planes de rodaje, listas de planos y análisis de guion son funciones de Lumiere incluidas en Creator y Full.',
    'Is there a free trial?': '¿Hay una prueba gratuita?',
    'Your first script is on us. Write it fully before you pick a plan.': 'Tu primer guion corre por nuestra cuenta. Escríbelo completo antes de elegir un plan.',
    'FilmScript. Write better, not louder.': 'FilmScript. Escribe mejor, no más fuerte.',

    // Pricing.
    'Pricing · FilmScript': 'Precios · FilmScript',
    'Choose the workspace that fits your process.': 'Elige el espacio de trabajo que se adapta a tu proceso.',
    'Manage your plan from the account menu.': 'Administra tu plan desde el menú de tu cuenta.',
    'Start free, create with 100 monthly image credits in Creator, or unlock Full with 1,000.': 'Empieza gratis, crea con 100 créditos de imagen mensuales en Creator o desbloquea Full con 1,000.',
    '100 image credits': '100 créditos de imagen',
    'A complete creative workspace with AI writing and visual exploration.': 'Un espacio creativo completo con Lumiere para escritura y exploración visual.',
    'Complete studio': 'Estudio completo',
    'Start free, create with Lumiere in Creator, or unlock Full with 1,000 monthly image credits.': 'Empieza gratis, crea con Lumiere en Creator o desbloquea Full con 1,000 créditos mensuales para imágenes.',
    'Most loved': 'Más elegido',
    '/ month': '/ mes',
    '$0 / month': '$0 / mes',
    '$24.99 / month': '$24.99 / mes',
    '$39.99 / month': '$39.99 / mes',
    'FilmScript Creator': 'FilmScript Creator',
    'FilmScript Full': 'FilmScript Full',
    'FilmScript Creator · $24.99 / month': 'FilmScript Creator · $24.99 / mes',
    'FilmScript Full · $39.99 / month': 'FilmScript Full · $39.99 / mes',
    'AI writing': 'Escritura con IA',
    '1,000 image credits': '1,000 créditos de imagen',
    'See the workspace before you commit.': 'Conoce el espacio de trabajo antes de decidir.',
    'Every FilmScript tool and AI text workflow, without AI image generation.': 'Todas las herramientas de FilmScript y el flujo de texto con IA, sin generación de imágenes con IA.',
    'The full production studio, with image generation across FilmScript.': 'El estudio de producción completo, con generación de imágenes en todo FilmScript.',
    'Choose Creator': 'Elegir Creator',
    'Choose Full': 'Elegir Full',
    'Professional screenplay editor with standard formatting and PDF export': 'Editor profesional de guion con formato estándar y exportación a PDF',
    'Import a screenplay and organize scenes, cast, and production notes': 'Importa un guion y organiza escenas, reparto y notas de producción',
    'Upload references and build mood boards manually': 'Sube referencias y crea tableros de inspiración manualmente',
    'Your scripts, boards, and production work remain exportable': 'Tus guiones, tableros y trabajo de producción siguen disponibles para exportar',
    'Everything in the Free workspace': 'Todo lo incluido en el espacio del plan Free',
    '100 image credits in every monthly billing cycle': '100 créditos de imagen en cada ciclo de facturación mensual',
    'Every AI image uses 3 credits': 'Cada imagen generada con Lumiere usa 3 créditos',
    'Generate frames in Imagine, Boards, and Shot List': 'Genera imágenes en Imagine, Boards y Lista de planos',
    'AI script analysis, scene breakdowns, and production suggestions': 'Análisis de guion, desgloses de escena y sugerencias de producción con Lumiere',
    'AI-assisted scheduling, shot coverage, and budget generation': 'Programación, cobertura de planos y generación de presupuestos asistidas por Lumiere',
    'Lumiere creative taste profile and consistent project feedback': 'Perfil de gusto creativo de Lumiere y retroalimentación coherente para el proyecto',
    'Connected Budget, Cash Flow, expense reporting, and A4 exports': 'Presupuesto, flujo de caja, informes de gastos y exportaciones A4 conectados',
    'Use generated visuals across Imagine, Boards, Vault, and Shot List': 'Usa recursos visuales generados en Imagine, Boards, Vault y Lista de planos',
    'Keep editing every AI result manually': 'Sigue editando manualmente cada resultado de Lumiere',
    'Generate visual frames in Imagine, Boards, and Shot List': 'Genera imágenes visuales en Imagine, Boards y Lista de planos',
    'Choose Low, Medium, or High image quality for each generation': 'Elige calidad de imagen baja, media o alta para cada generación',
    'Highest Lumiere text limits for writing and production work': 'Los límites de texto más altos de Lumiere para escritura y producción',
    'Deep script analysis, breakdowns, scheduling, and budget generation': 'Análisis profundo de guion, desgloses, programación y generación de presupuestos',
    'Keep character and visual references connected across every scene': 'Mantén conectadas las referencias de personajes y visuales en todas las escenas',
    'Use visuals across Imagine, Boards, Vault, and Shot List': 'Usa recursos visuales en Imagine, Boards, Vault y Lista de planos',
    'Download, share, and keep editing every generated result': 'Descarga, comparte y sigue editando cada resultado generado',
    'FilmScript could not open secure checkout. Please try again.': 'FilmScript no pudo abrir el pago seguro. Inténtalo de nuevo.',
    'FilmScript could not complete this action. Nothing was charged.': 'FilmScript no pudo completar esta acción. No se realizó ningún cobro.',
    'Professional screenplay editor and PDF export': 'Editor profesional de guion y exportación a PDF',
    'Manual Breakdown, Stripboard, Shot List, Budget, Canvas, and Calendar': 'Desglose, plan de rodaje, lista de planos, presupuesto, Canvas y calendario manuales',
    'Upload reference images and build mood boards manually': 'Sube imágenes de referencia y crea mood boards manualmente',
    'A small set of Lumiere prompts to explore the assistant': 'Un pequeño número de prompts de Lumiere para explorar el asistente',
    'One AI script analysis, one AI breakdown, and one AI storyboard or shot list per account': 'Un análisis de guion con IA, un desglose con IA y un storyboard o lista de planos con IA por cuenta',
    'Free AI grants stay used even if a script is deleted': 'Las funciones gratuitas de IA siguen consumidas aunque elimines un guion',
    'No AI image generation': 'Sin generación de imágenes con IA',
    'Everything in the manual production workspace': 'Todo en el espacio de producción manual',
    'Lumiere inside the editor with expanded text limits': 'Lumiere dentro del editor con límites de texto ampliados',
    'AI script analysis and AI-assisted breakdowns': 'Análisis de guion con IA y desgloses asistidos por IA',
    'AI-assisted scheduling, shot list coverage, and Budget generation': 'Programación asistida por IA, cobertura para listas de planos y generación de presupuestos',
    'Lumiere creative taste profile': 'Perfil de gusto creativo de Lumiere',
    'Manual Canvas mood boards and reference uploads': 'Mood boards manuales en Canvas y carga de referencias',
    'Upload reference images in Shot List': 'Carga imágenes de referencia en la lista de planos',
    'Connected Budget, Cash Flow, expenses, and A4 exports': 'Presupuesto, flujo de caja, gastos y exportaciones A4 conectados',
    'No AI image generation in Imagine, Boards, or Shot List': 'Sin generación de imágenes con IA en Imagine, Boards ni Lista de planos',
    'Everything in Creator': 'Todo lo de Creator',
    '1,000 image credits every monthly billing cycle': '1,000 créditos de imagen en cada ciclo de facturación mensual',
    'Every AI image costs 3 credits': 'Cada imagen de IA cuesta 3 créditos',
    'Generate frames in Imagine': 'Genera imágenes en Imagine',
    'Generate visual references in Boards': 'Genera referencias visuales en Boards',
    'Generate shot references in Shot List': 'Genera referencias de planos en Lista de planos',
    'Higher Lumiere text limits': 'Límites de texto de Lumiere más altos',
    'Use images across Imagine, Boards, Vault, and Shot List': 'Usa imágenes en Imagine, Boards, Vault y Lista de planos',
    'Manual editing remains available on every AI result': 'La edición manual sigue disponible en cada resultado de IA',
    'Yes. Move between Free, Creator, and Full at any time. Your existing scripts and production work stay available.': 'Sí. Cambia entre Free, Creator y Full cuando quieras. Tus guiones y trabajo de producción existentes seguirán disponibles.',
    'Free includes a limited AI introduction. Creator adds the AI text workflow. Full adds 1,000 monthly image credits for Imagine, Boards, and Shot List.': 'Free incluye una introducción limitada a la IA. Creator añade el flujo de texto con IA. Full añade 1,000 créditos mensuales para imágenes en Imagine, Boards y Lista de planos.',
    'Create more with Full · $39.99/month': 'Crea más con Full · $39.99/mes',
    'Start free. Creator $24.99/month. Full $39.99/month.': 'Empieza gratis. Creator $24.99/mes. Full $39.99/mes.',
    'Upgrade to Full': 'Mejorar a Full',
    'Lumiere requires FilmScript Creator': 'Lumiere requiere FilmScript Creator',
    'FilmScript Creator at $24.99 / month unlocks ongoing Lumiere work. Your scripts and manual production work remain available to edit and export.': 'FilmScript Creator por $24.99 / mes desbloquea el uso continuo de Lumiere. Tus guiones y trabajo manual de producción siguen disponibles para editar y exportar.',
    'View Creator': 'Ver Creator',
    'View Creator · $24.99 / month': 'Ver Creator · $24.99 / mes',
    'Keep editing and exporting existing documents. Creator unlocks ongoing Lumiere text generation.': 'Sigue editando y exportando documentos existentes. Creator desbloquea la generación continua de texto con Lumiere.',
    'Credits and limits.': 'Créditos y límites.',
    'Paid plans renew monthly.': 'Los planes de pago se renuevan mensualmente.',
    'Paid subscriptions.': 'Suscripciones de pago.',
    'Free includes a small set of Lumiere prompts, plus one AI script analysis, one AI breakdown, and one AI storyboard or shot list per account. Those grants are not restored by deleting a script. Creator includes AI text tools and 100 image credits every monthly billing cycle. Full includes 1,000 image credits every monthly billing cycle; every AI image in Imagine, Boards, or Shot List uses 3 credits. Unused image credits do not roll over and have no cash value.': 'Free incluye un pequeño número de prompts de Lumiere, además de un análisis de guion con IA, un desglose con IA y un storyboard o lista de planos con IA por cuenta. Estas funciones no se restauran al eliminar un guion. Creator incluye herramientas de texto con IA y 100 créditos de imagen en cada ciclo de facturación mensual. Full incluye 1,000 créditos de imagen en cada ciclo de facturación mensual; cada imagen de IA en Imagine, Boards o Lista de planos usa 3 créditos. Los créditos no utilizados no se acumulan ni tienen valor en efectivo.',
    'Free includes a small set of Lumiere prompts, plus one AI script analysis, one AI breakdown, and one AI storyboard or shot list per account. Those free grants are account-based and are not restored by deleting a script. Creator includes FilmScript’s AI text tools and 100 image credits each monthly billing cycle. Full includes 1,000 image credits each monthly billing cycle. Every AI image generated in Imagine, Boards, or Shot List uses 3 credits. Unused image credits do not roll over and have no cash value.': 'Free incluye un pequeño número de prompts de Lumiere, además de un análisis de guion con IA, un desglose con IA y un storyboard o lista de planos con IA por cuenta. Estas funciones gratuitas pertenecen a la cuenta y no se restauran al eliminar un guion. Creator incluye las herramientas de texto con IA de FilmScript y 100 créditos de imagen en cada ciclo de facturación mensual. Full incluye 1,000 créditos de imagen en cada ciclo de facturación mensual. Cada imagen de IA generada en Imagine, Boards o Lista de planos usa 3 créditos. Los créditos no utilizados no se acumulan ni tienen valor en efectivo.',
    'Creator and Full renew monthly through Recurrente and can be canceled from your account menu.': 'Creator y Full se renuevan mensualmente mediante Recurrente y se pueden cancelar desde el menú de tu cuenta.',
    'Creator and Full renew through Recurrente. You can cancel or change your plan from your account menu. Access remains available according to the payment provider’s confirmed subscription status.': 'Creator y Full se renuevan mediante Recurrente. Puedes cancelar o cambiar tu plan desde el menú de tu cuenta. El acceso permanece disponible según el estado de suscripción confirmado por el proveedor de pago.',
    'Do not use FilmScript to upload material you do not have permission to use, or to interfere with the service or other writers.': 'No uses FilmScript para subir material que no tienes permiso de usar ni para interferir con el servicio o con otros escritores.',
    'Contact support if you need help with your account, billing, or your writing workspace.': 'Contacta a soporte si necesitas ayuda con tu cuenta, facturación o espacio de escritura.',
    'Every FilmScript tool, connected from first draft to production.': 'Todas las herramientas de FilmScript, conectadas desde el primer borrador hasta producción.',
    'Professional screenplay editor and PDF exports': 'Editor profesional de guion y exportaciones PDF',
    'Lumiere, your AI script assistant': 'Lumiere, tu asistente de guion con IA',
    'Breakdowns, stripboards and shot lists': 'Desgloses, planes de rodaje y listas de planos',
    'Cliché, format, character and arc analysis': 'Análisis de clichés, formato, personajes y arcos',
    'Every FilmScript feature in one plan': 'Todas las funciones de FilmScript en un solo plan',
    'What comes with each plan.': 'Qué incluye cada plan.',
    'Hollywood format editor': 'Editor con formato de Hollywood',
    'Typewriter pages, light and dark': 'Páginas de máquina de escribir, claras y oscuras',
    'WGA format checker': 'Revisor de formato WGA',
    'Screenplay PDF export': 'Exportación de guion en PDF',
    'Lumiere chat and script analysis': 'Chat de Lumiere y análisis de guion',
    'Cliché detector and spotless spelling': 'Detector de clichés y ortografía impecable',
    'Script breakdowns': 'Desgloses de guion',
    'Stripboard schedule': 'Plan de rodaje',

    // Product highlights shown in Plan and billing.
    'Real-time collaboration': 'Colaboración en tiempo real',
    'Comments and notifications': 'Comentarios y notificaciones',
    'Breakdown and split view': 'Desglose y vista dividida',
    'Editable production elements beside the live screenplay, linked to exact script evidence.': 'Elementos de producción editables junto al guion, vinculados a la evidencia exacta del texto.',
    'Collaboration and activity': 'Colaboración y actividad',
    'Live presence, cursors, comments, mentions, notifications and meaningful project history.': 'Presencia en vivo, cursores, comentarios, menciones, notificaciones e historial relevante del proyecto.',
    'Shared Project': 'Proyecto compartido',
    'A secure, read-only web view that always reflects the latest sections you choose.': 'Una vista web segura y de solo lectura que siempre refleja las secciones más recientes que elijas.',
    'Canvas, files and exports': 'Canvas, archivos y exportaciones',
    'Canvas, Imagine, selected files and professional PDF exports across production modules.': 'Canvas, Imagine, archivos seleccionados y exportaciones PDF profesionales en los módulos de producción.',

    // Plan and billing.
    'Plan and billing · FilmScript': 'Plan y facturación · FilmScript',
    'Checking your subscription': 'Verificando tu suscripción',
    'FilmScript is securely checking your subscription with Recurrente.': 'FilmScript está verificando de forma segura tu suscripción con Recurrente.',
    'Google account': 'Cuenta de Google',
    'Use the same Google account connected to your FilmScript subscription.': 'Usa la misma cuenta de Google vinculada a tu suscripción de FilmScript.',
    'Membership': 'Membresía',
    'Plan & billing': 'Plan y facturación',
    'Manage your membership, billing and access to your FilmScript plan.': 'Administra tu membresía, facturación y acceso a tu plan de FilmScript.',
    'Plan highlights': 'Aspectos destacados del plan',
    '1,000 image credits monthly': '1,000 créditos de imagen mensuales',
    '100 image credits monthly': '100 créditos de imagen mensuales',
    'Screenplay and translation': 'Guion y traducción',
    'Professional formatting, safe simultaneous editing and independent translated projects.': 'Formato profesional, edición simultánea segura y proyectos traducidos independientes.',
    'Script analysis, breakdown generation and creative conversations saved per screenplay.': 'Análisis de guion, generación de desgloses y conversaciones creativas guardadas por cada guion.',
    'Production planning': 'Planificación de producción',
    'Stripboard, Shot List, Calendar and scene-linked planning in one workflow.': 'Plan de rodaje, Lista de planos, Calendario y planificación vinculada a escenas en un solo flujo.',
    'Budget and cash flow': 'Presupuesto y flujo de caja',
    'Connected budgets, weekly cash flow, expenses and production-ready exports.': 'Presupuestos conectados, flujo de caja semanal, gastos y exportaciones listas para producción.',
    'Your FilmScript Creator plan': 'Tu plan FilmScript Creator',
    'Your FilmScript Full plan': 'Tu plan FilmScript Full',
    'Everything in FilmScript is unlocked for this Google account, from the first page to the production plan.': 'Todo FilmScript está desbloqueado para esta cuenta de Google, desde la primera página hasta el plan de producción.',
    'Current plan': 'Plan actual',
    'Connected Google account': 'Cuenta de Google conectada',
    'Everything included': 'Todo incluido',
    'Your manual production toolkit': 'Tu kit manual de producción',
    'Write, break down, schedule and budget your production with full manual control.': 'Escribe, desglosa, programa y presupuesta tu producción con control manual total.',
    'One connected workflow for writing, planning and preparing the shoot.': 'Un flujo conectado para escribir, planificar y preparar el rodaje.',
    'Screenplay editor': 'Editor de guion',
    'Professional formatting, scene navigation and focused writing.': 'Formato profesional, navegación por escenas y escritura enfocada.',
    'Script feedback, analysis and conversations saved per screenplay.': 'Comentarios, análisis y conversaciones guardadas por cada guion.',
    'Editable cast, props, wardrobe, locations and production elements.': 'Reparto, utilería, vestuario, locaciones y elementos de producción editables.',
    'Stripboards': 'Planes de rodaje',
    'Drag scenes into a practical shooting order and export the plan.': 'Arrastra escenas a un orden práctico de rodaje y exporta el plan.',
    'Editable camera coverage generated scene by scene with Lumiere.': 'Cobertura de cámara editable, generada escena por escena con Lumiere.',
    'PDF exports': 'Exportaciones PDF',
    'Export scripts and production documents with FilmScript watermark.': 'Exporta guiones y documentos de producción con la marca de agua de FilmScript.',
    'Write. Plan. Shoot.': 'Escribe. Planifica. Rueda.',
    'Billing': 'Facturación',
    'Managed securely with Recurrente': 'Administrado de forma segura con Recurrente',
    'Payment verified securely': 'Pago verificado de forma segura',
    'Secure billing': 'Facturación segura',
    'Open Recurrente ↗': 'Abrir Recurrente ↗',
    'Manage your billing securely with the payment provider.': 'Administra tu facturación de forma segura con el proveedor de pago.',
    'Cancel service': 'Cancelar servicio',
    'Canceling stops future renewals and Lumiere generation. Your scripts and existing production documents remain available to edit and export.': 'La cancelación detiene futuras renovaciones y la generación con Lumiere. Tus guiones y documentos de producción existentes siguen disponibles para editar y exportar.',
    'Review the details before you continue. Cancellation stops future renewals and Lumiere generation, but it never deletes your existing work.': 'Revisa los detalles antes de continuar. La cancelación detiene futuras renovaciones y la generación con Lumiere, pero nunca elimina tu trabajo existente.',
    'I understand that canceling removes Lumiere generation, while my scripts and existing production documents remain editable and exportable.': 'Entiendo que cancelar desactiva la generación con Lumiere, mientras mis guiones y documentos de producción existentes siguen siendo editables y exportables.',
    'Cancel through Recurrente': 'Cancelar mediante Recurrente',
    'Keep my plan': 'Conservar mi plan',
    'FilmScript never exposes your Recurrente secret key or payment details in the browser.': 'FilmScript nunca expone tu llave secreta de Recurrente ni los detalles de pago en el navegador.',
    'This Google account does not have an active FilmScript subscription. Existing scripts and production documents remain editable and exportable.': 'Esta cuenta de Google no tiene una suscripción activa de FilmScript. Los guiones y documentos de producción existentes siguen siendo editables y exportables.',
    'Cancellation complete': 'Cancelación completada',
    'FilmScript Creator canceled': 'FilmScript Creator cancelado',
    'FilmScript Full canceled': 'FilmScript Full cancelado',
    'Your FilmScript plan is canceled. Your existing work remains available to edit and export; new AI generation is now locked.': 'Tu plan de FilmScript está cancelado. Tu trabajo existente sigue disponible para editar y exportar; la generación nueva con IA está bloqueada.',
    'Return to FilmScript': 'Volver a FilmScript',
    'Nothing was changed': 'No se modificó nada',
    'We could not complete that': 'No pudimos completar la acción',
    'Recurrente could not be reached. Your plan remains active.': 'No fue posible comunicarse con Recurrente. Tu plan sigue activo.',
    'FilmScript will securely stop future renewals. Your scripts and existing production documents will remain editable and exportable.': 'FilmScript detendrá de forma segura las renovaciones futuras. Tus guiones y documentos de producción existentes seguirán disponibles para editar y exportar.',
    'I understand that canceling stops renewals, while my scripts and existing production documents remain editable and exportable.': 'Entiendo que cancelar detiene las renovaciones, mientras mis guiones y documentos de producción existentes siguen disponibles para editar y exportar.',
    'Your plan is active. Billing details are temporarily refreshing, so no changes can be made right now.': 'Tu plan está activo. Los detalles de facturación se están actualizando, así que no se pueden realizar cambios en este momento.',
    'FilmScript billing is still loading. Please try again.': 'La facturación de FilmScript aún está cargando. Inténtalo de nuevo.',
    'Finishing your subscription': 'Finalizando tu suscripción',
    'Your payment was received. FilmScript is waiting for Recurrente to confirm the recurring subscription.': 'Recibimos tu pago. FilmScript está esperando que Recurrente confirme la suscripción recurrente.',
    'Recurrente could not be reached. Your plan has not been changed.': 'No fue posible comunicarse con Recurrente. Tu plan no se modificó.',
    'Cancellation was not confirmed. Your plan remains active.': 'No se confirmó la cancelación. Tu plan sigue activo.',
    'The cancellation could not be verified. Your plan has not been changed.': 'No se pudo verificar la cancelación. Tu plan no se modificó.',
    'Canceling FilmScript Creator…': 'Cancelando FilmScript Creator…',
    'Canceling FilmScript Full…': 'Cancelando FilmScript Full…',
    'FilmScript Creator is canceled. Your existing work remains available to edit and export.': 'FilmScript Creator está cancelado. Tu trabajo existente sigue disponible para editar y exportar.',
    'FilmScript Full is canceled. Your existing work remains available to edit and export.': 'FilmScript Full está cancelado. Tu trabajo existente sigue disponible para editar y exportar.',
    'Plan canceled': 'Plan cancelado',
    'Your plan is canceled. Your existing work remains available to edit and export.': 'Tu plan está cancelado. Tu trabajo existente sigue disponible para editar y exportar.',

    // Budget workspace: short labels and primary explanations.
    'Quick Budget': 'Presupuesto rápido',
    'Quick View': 'Vista rápida',
    'Budget Quick View': 'Vista rápida del presupuesto',
    'First look': 'Primer vistazo',
    'See the production plan, actual spending and funding position at a glance.': 'Consulta de un vistazo el plan de producción, el gasto real y la posición de financiamiento.',
    'Planned Budget': 'Presupuesto planificado',
    'Actual Spend': 'Gasto real',
    'Available to allocate': 'Disponible para asignar',
    'Allocation': 'Asignación',
    'Where the budget goes': 'A dónde va el presupuesto',
    'Total by production phase': 'Total por fase de producción',
    'Above the Line': 'Sobre la línea',
    'Postproduction': 'Postproducción',
    'Other': 'Otros',
    'Progress': 'Progreso',
    'Planned and spent': 'Planificado y gastado',
    'Actual spend by phase': 'Gasto real por fase',
    'Production note': 'Nota de producción',
    'Summary': 'Resumen',
    'Budget Summary': 'Resumen del presupuesto',
    'Budget Breakdown': 'Desglose del presupuesto',
    'Finance Plan': 'Plan financiero',
    'Expense Report': 'Informe de gastos',
    'Budget Settings': 'Ajustes del presupuesto',
    'Rollup': 'Consolidado',
    'Cost detail': 'Detalle de costos',
    'Sources and timing': 'Fuentes y calendario',
    'Actuals': 'Gastos reales',
    'Editable drivers': 'Variables editables',
    'Every account rolls into one auditable production total.': 'Cada cuenta se consolida en un total de producción auditable.',
    'Account Summary': 'Resumen de cuentas',
    'Subtotal, tax, total and current variance.': 'Subtotal, impuestos, total y variación actual.',
    'Account': 'Cuenta',
    'Concept': 'Concepto',
    'Subtotal': 'Subtotal',
    'Tax': 'Impuesto',
    'Total': 'Total',
    'Spent': 'Gastado',
    'Remaining': 'Restante',
    'Grand Total': 'Total general',
    'Change any driver. Totals, taxes, charts and reports update together.': 'Cambia cualquier variable. Totales, impuestos, gráficas e informes se actualizan juntos.',
    'Search': 'Buscar',
    'Phase': 'Fase',
    'All phases': 'Todas las fases',
    'Live formula': 'Fórmula en vivo',
    'Quantity × times × unit cost, then tax': 'Cantidad × veces × costo unitario, luego impuesto',
    'No matching cost items': 'No hay partidas coincidentes',
    'Clear the filters to see the complete budget.': 'Limpia los filtros para ver el presupuesto completo.',
    'Code': 'Código',
    'Cost Item': 'Partida',
    'Qty': 'Cant.',
    'Unit': 'Unidad',
    'Times': 'Veces',
    'Unit Cost': 'Costo unitario',
    'Type': 'Tipo',
    'Funding': 'Financiamiento',
    'Plan': 'Plan',
    'Add cost item': 'Agregar partida',
    'Fixed': 'Fijo',
    'Variable': 'Variable',
    'Cash': 'Efectivo',
    'In kind': 'En especie',
    'Exempt': 'Exento',
    'Schedule': 'Programar',
    'Track cash, in kind support, payment status and the production cash flow.': 'Da seguimiento al efectivo, aportes en especie, estado de pagos y flujo de caja de producción.',
    'Cash Budget': 'Presupuesto en efectivo',
    'In Kind Budget': 'Presupuesto en especie',
    'Funding Planned': 'Financiamiento previsto',
    'Funding Gap': 'Brecha de financiamiento',
    'Contributors': 'Contribuyentes',
    'Add contributor': 'Agregar contribuyente',
    'Contributor': 'Contribuyente',
    'Planned': 'Previsto',
    'Pending': 'Pendiente',
    'Partially paid': 'Pagado parcialmente',
    'Received': 'Recibido',
    'Payment Date': 'Fecha de pago',
    'Proof': 'Comprobante',
    'Cash flow': 'Flujo de caja',
    'Planned execution': 'Ejecución prevista',
    'All scheduled cost items': 'Todas las partidas programadas',
    'How to plan timing': 'Cómo planificar tiempos',
    'Schedule each cost at its source': 'Programa cada costo desde su partida',
    'Open Budget Breakdown': 'Abrir desglose del presupuesto',
    'Link every payment to its budget line and keep a compressed receipt with it.': 'Vincula cada pago con su partida presupuestaria y conserva un recibo comprimido.',
    'Add expense': 'Agregar gasto',
    'Approved production plan': 'Plan de producción aprobado',
    'Over budget': 'Sobre presupuesto',
    'Available': 'Disponible',
    'Receipts': 'Recibos',
    'Compressed image files': 'Archivos de imagen comprimidos',
    'Payment Ledger': 'Registro de pagos',
    'Budgeted amount, actual spend and live variance.': 'Monto presupuestado, gasto real y variación en vivo.',
    'Photos are compressed before upload': 'Las fotos se comprimen antes de subirlas',
    'Payment': 'Pago',
    'Date': 'Fecha',
    'Budget Line': 'Partida presupuestaria',
    'Vendor': 'Proveedor',
    'Budgeted': 'Presupuestado',
    'Variance': 'Variación',
    'Receipt': 'Recibo',
    'Total Spent': 'Total gastado',
    'View': 'Ver',
    'Replace': 'Reemplazar',
    'Attach': 'Adjuntar',
    'Set project details, currency, contingency and every tax rate in one place.': 'Define detalles del proyecto, moneda, contingencia y cada tasa de impuesto en un solo lugar.',
    'Production': 'Producción',
    'Project Details': 'Detalles del proyecto',
    'Producer': 'Productor',
    'Director': 'Director',
    'Locations': 'Locaciones',
    'Shooting Dates': 'Fechas de rodaje',
    'Calculation': 'Cálculo',
    'Financial Drivers': 'Variables financieras',
    'Currency Code': 'Código de moneda',
    'Currency Symbol': 'Símbolo de moneda',
    'Contingency Rate': 'Tasa de contingencia',
    'Calculated contingency': 'Contingencia calculada',
    'Tax Rates': 'Tasas de impuesto',
    'Add tax rate': 'Agregar tasa',
    'Rate': 'Tasa',
    'Required': 'Obligatorio',
    'Formula Guide': 'Guía de fórmulas',
    'Tax added': 'Impuesto agregado',
    'Tax included': 'Impuesto incluido',
    'Contingency': 'Contingencia',
    'Place planned payments across the production timeline.': 'Distribuye los pagos previstos en el calendario de producción.',
    'Scheduled': 'Programado',
    'Unscheduled': 'Sin programar',
    'Changes save automatically': 'Los cambios se guardan automáticamente',
    'Budget is not available for this screenplay.': 'El presupuesto no está disponible para este guion.',
    'Could not load this budget.': 'No se pudo cargar este presupuesto.',
    'Could not save this budget.': 'No se pudo guardar este presupuesto.',
    'Managed in Calendar': 'Administrado en Calendario',
    'Loading Budget': 'Cargando presupuesto',
    'Connecting this financial plan to your screenplay.': 'Conectando este plan financiero con tu guion.',
    'Budget could not be opened': 'No se pudo abrir el presupuesto',
    'Budget views': 'Vistas del presupuesto',
    'No allocation yet': 'Aún no hay asignaciones',
    'Add the first cost in Breakdown.': 'Agrega el primer costo en el desglose.',
    'Nothing to compare yet': 'Aún no hay nada que comparar',
    'Progress appears as costs are planned.': 'El progreso aparecerá al planificar los costos.',
    'Unexpected Costs': 'Costos inesperados',
    'Unexpected costs': 'Costos inesperados',
    'Actual spend without an approved line': 'Gasto real sin una partida aprobada',
    'Show active accounts': 'Mostrar cuentas activas',
    'Show all accounts': 'Mostrar todas las cuentas',
    'No phase totals yet': 'Aún no hay totales por fase',
    'Your production mix will appear after the first cost is entered.': 'La mezcla de producción aparecerá después de ingresar el primer costo.',
    'All accounts are visible.': 'Todas las cuentas están visibles.',
    'Configured accounts appear first.': 'Las cuentas configuradas aparecen primero.',
    'No active accounts yet': 'Aún no hay cuentas activas',
    'Add a cost in Breakdown and this summary will update automatically.': 'Agrega un costo en el desglose y este resumen se actualizará automáticamente.',
    'Open Breakdown': 'Abrir desglose',
    'Open an account, change any driver and every report updates together.': 'Abre una cuenta, cambia cualquier variable y todos los informes se actualizarán juntos.',
    'Account, code or cost item': 'Cuenta, código o partida',
    'These payments are included in actual spend but are not part of the approved budget.': 'Estos pagos están incluidos en el gasto real, pero no forman parte del presupuesto aprobado.',
    'Review Expenses': 'Revisar gastos',
    'Cash Flow': 'Flujo de caja',
    'Weekly timing': 'Calendario semanal',
    'See when production cash is expected to leave the project.': 'Consulta cuándo se espera que el efectivo de producción salga del proyecto.',
    'Build the cash budget first': 'Primero construye el presupuesto de efectivo',
    'Add the first cash cost in Breakdown, then use Schedule to place it on the weekly production timeline.': 'Agrega el primer costo en efectivo en el desglose y usa Programar para colocarlo en el cronograma semanal de producción.',
    'Relative': 'Relativo',
    'Connected workflow': 'Flujo conectado',
    'Script Breakdown → Stripboard → Budget Schedule': 'Desglose de guion → Plan de rodaje → Programación del presupuesto',
    'Edit schedules': 'Editar programaciones',
    'Over scheduled': 'Programado de más',
    'Needs scheduling': 'Necesita programación',
    'Add payment dates to place actual cash by week.': 'Agrega fechas de pago para ubicar el efectivo real por semana.',
    'outside the timeline': 'fuera del cronograma',
    'Review the date or extend the Production Calendar.': 'Revisa la fecha o amplía el Calendario de producción.',
    'Every cash cost is placed': 'Todos los costos en efectivo están ubicados',
    'The weekly plan matches the cash budget.': 'El plan semanal coincide con el presupuesto de efectivo.',
    'No cash outflow scheduled in this week.': 'No hay salida de efectivo programada esta semana.',
    'No dated expenses in this week.': 'No hay gastos fechados esta semana.',
    'Connect Production Calendar dates to compare actual payments by week.': 'Conecta las fechas del Calendario de producción para comparar los pagos reales por semana.',
    'Scheduled from Budget Breakdown': 'Programado desde el desglose del presupuesto',
    'Actual payments': 'Pagos reales',
    'Find a cost or date': 'Buscar un costo o fecha',
    'Cost, vendor or date (YYYY-MM-DD)': 'Costo, proveedor o fecha (AAAA-MM-DD)',
    'Search weekly cash flow': 'Buscar en el flujo de caja semanal',
    'Number of weeks visible': 'Número de semanas visibles',
    'Search scans the full production timeline.': 'La búsqueda revisa todo el cronograma de producción.',
    'Move left for a focused window; move right for every week.': 'Muévete a la izquierda para una vista enfocada; a la derecha para ver todas las semanas.',
    'Unplaced actual payments': 'Pagos reales sin ubicar',
    'No weekly cash flow matches this search.': 'Ningún flujo de caja semanal coincide con esta búsqueda.',
    'Try a budget code, vendor, concept or a date inside the production timeline.': 'Prueba con un código presupuestario, proveedor, concepto o fecha dentro del cronograma de producción.',
    'No matching weeks.': 'No hay semanas coincidentes.',
    'Clear the search to restore the complete weekly ledger.': 'Limpia la búsqueda para restaurar el registro semanal completo.',
    'Cash Scheduled': 'Efectivo programado',
    'Peak Cash Week': 'Semana de mayor gasto en efectivo',
    'No scheduled week': 'Ninguna semana programada',
    'Actual Cash Spend': 'Gasto real en efectivo',
    'Cash flow checks': 'Comprobaciones del flujo de caja',
    'Weekly Cash Ledger': 'Registro semanal de efectivo',
    'Open a week to see every scheduled cost and dated payment behind it.': 'Abre una semana para ver cada costo programado y pago fechado que contiene.',
    'Calendar dates connected': 'Fechas del calendario conectadas',
    'Relative weeks': 'Semanas relativas',
    'Track cash, in kind support, contributor status and received funding.': 'Da seguimiento al efectivo, aportes en especie, estado de contribuyentes y financiamiento recibido.',
    'No contributors yet. Add the first funding source.': 'Aún no hay contribuyentes. Agrega la primera fuente de financiamiento.',
    'Payment number': 'Número de pago',
    'Payment date': 'Fecha de pago',
    'Vendor or beneficiary': 'Proveedor o beneficiario',
    'Describe the unexpected cost': 'Describe el costo inesperado',
    'What was paid': 'Qué se pagó',
    'Amount paid': 'Monto pagado',
    'Not budgeted': 'No presupuestado',
    'Expense status guide': 'Guía de estados de gastos',
    'Within budget': 'Dentro del presupuesto',
    'Unexpected': 'Inesperado',
    'Compare every payment with its approved line. Unexpected costs stay visible instead of changing the approved budget.': 'Compara cada pago con su partida aprobada. Los costos inesperados permanecen visibles sin cambiar el presupuesto aprobado.',
    'Photos compress before upload': 'Las fotos se comprimen antes de subirlas',
    'Overall over budget': 'Total sobre presupuesto',
    'Overall remaining': 'Total restante',
    'Payment ledger': 'Registro de pagos',
    'No expenses yet': 'Aún no hay gastos',
    'Use Add expense when production spending begins. Receipt photos are compressed before upload.': 'Usa Agregar gasto cuando empiece el gasto de producción. Las fotos de recibos se comprimen antes de subirlas.',
    'Choose a budget line': 'Elegir una partida presupuestaria',
    'Only cost items with an approved amount in Budget Breakdown appear here.': 'Aquí solo aparecen las partidas con un monto aprobado en el desglose del presupuesto.',
    'Close budget line picker': 'Cerrar selector de partida presupuestaria',
    'Search approved costs': 'Buscar costos aprobados',
    'Record as unexpected cost': 'Registrar como costo inesperado',
    'No approved line. Enter the vendor, concept and amount manually.': 'No hay una partida aprobada. Ingresa manualmente el proveedor, concepto y monto.',
    'Selected': 'Seleccionado',
    'Choose': 'Elegir',
    'No approved lines match.': 'Ninguna partida aprobada coincide.',
    'Try another search or record this as an unexpected cost.': 'Prueba otra búsqueda o regístralo como costo inesperado.',
    'Changing the link never changes the approved budget.': 'Cambiar el vínculo nunca modifica el presupuesto aprobado.',
    'Preview of': 'Vista previa de',
    'Auto schedule': 'Programar automáticamente',
    'Clear': 'Limpiar',
    'Relative production week': 'Semana de producción relativa',
    'Code, account or cost item': 'Código, cuenta o partida',
    'Not budgeted': 'No presupuestado',
    'Emma Thomas': 'Emma Thomas',
    'Greta Gerwig': 'Greta Gerwig',
    'Feature film': 'Largometraje',
    'Los Angeles, CA': 'Los Ángeles, California',
    'June 2026': 'Junio de 2026',
    'This is an in-kind cost. It stays on the production timeline but is excluded from cash totals.': 'Este es un costo en especie. Permanece en el cronograma de producción, pero se excluye de los totales de efectivo.',
    'Place this budget line in the weeks when the production expects to use the money.': 'Coloca esta partida presupuestaria en las semanas en que la producción espera usar el dinero.',
    'See exactly when cash is planned to leave the production. Every amount comes from Schedule in Budget Breakdown.': 'Consulta exactamente cuándo está previsto que el efectivo salga de la producción. Cada monto proviene de Programar en el desglose del presupuesto.',
    'Weekly profile': 'Perfil semanal',
    'Planned versus actual cash': 'Efectivo previsto frente al real',
    'Attention': 'Atención',
    'Funding sources': 'Fuentes de financiamiento',
    'Planned and received funding with proof of payment.': 'Financiamiento previsto y recibido con comprobante de pago.',
    'Line Budget': 'Presupuesto de la partida',
    'Paid': 'Pagado',
    'Line Balance': 'Saldo de la partida',
    'Close schedule': 'Cerrar programación',
    'Delete contributor': 'Eliminar contribuyente',
    'Delete expense': 'Eliminar gasto',
    'Delete tax': 'Eliminar impuesto',
    'Delete budget line picker': 'Eliminar selector de partida',
    'Review': 'Revisar',
    'Edit schedule': 'Editar programación',
    'Unexpected cost': 'Costo inesperado',
    'Date needed': 'Falta la fecha',
    'Actual': 'Real',
    'Prep': 'Preparación',
    'Post': 'Postproducción',
    'Wrap': 'Cierre',
    'Production Calendar': 'Calendario de producción',
    'Start in Budget Breakdown. Add quantities and rates, then Quick View will update automatically.': 'Empieza en el desglose del presupuesto. Agrega cantidades y tarifas y la vista rápida se actualizará automáticamente.',
    'Funding Surplus': 'Superávit de financiamiento',
    'Fully Funded': 'Financiamiento completo',
    'Still to finance': 'Aún por financiar',
    'Plan is fully financed': 'El plan está completamente financiado',
    'Build the Script Breakdown and Stripboard to add scene and shoot-day context.': 'Completa el desglose de guion y el plan de rodaje para agregar contexto de escenas y días de rodaje.',
    'Weeks are relative until Production Calendar dates are available.': 'Las semanas son relativas hasta que estén disponibles las fechas del Calendario de producción.',
    'Over Scheduled': 'Programado de más',
    'Cash Unscheduled': 'Efectivo sin programar',
    'Rebalance highlighted cost items': 'Reequilibrar las partidas destacadas',
    'Still needs a production week': 'Aún necesita una semana de producción',
    'Every cash cost has a week': 'Cada costo en efectivo tiene una semana',
    'Available above the plan': 'Disponible sobre el plan',
    'Costs paid in cash': 'Costos pagados en efectivo',
    'Contributed resources': 'Recursos aportados',
    'Choose line or keep unexpected': 'Elige una partida o déjalo como inesperado',
    'Fully used': 'Usado por completo',
    'No matching week': 'No hay una semana coincidente',
    'Review Budget Breakdown': 'Revisar desglose del presupuesto',
    'Approved Budget': 'Presupuesto aprobado',
    'Budget Breakdown total': 'Total del desglose del presupuesto',
    'Total Paid': 'Total pagado',
    'Over Budget': 'Sobre presupuesto',
    'Project Development': 'Desarrollo del proyecto',
    'Script and Rights': 'Guion y derechos',
    'Producing': 'Producción ejecutiva',
    'Directing': 'Dirección',
    'Cast': 'Elenco',
    'Extras and Stunts': 'Extras y especialistas',
    'Production Staff': 'Equipo de producción',
    'Art Department': 'Departamento de arte',
    'Camera Crew': 'Equipo de cámara',
    'Camera Equipment': 'Equipo de cámara',
    'Sound and Equipment': 'Sonido y equipo',
    'Electric and Grip Crew': 'Equipo eléctrico y grip',
    'Electric and Grip Equipment': 'Equipo eléctrico y grip',
    'Wardrobe Department': 'Departamento de vestuario',
    'Hair and Makeup': 'Peinado y maquillaje',
    'Special Effects': 'Efectos especiales',
    'Animals and Picture Vehicles': 'Animales y vehículos de escena',
    'Lodging and Travel': 'Hospedaje y viajes',
    'Set Operations': 'Operaciones de set',
    'Transportation': 'Transporte',
    'Behind the Scenes': 'Detrás de cámaras',
    'Picture Editing': 'Montaje de imagen',
    'Picture Postproduction': 'Postproducción de imagen',
    'Sound Postproduction': 'Postproducción de sonido',
    'Distribution': 'Distribución',
    'Insurance': 'Seguros',
    'Breakdown preparation': 'Preparación del desglose',
    'Budget preparation': 'Preparación del presupuesto',
    'Location scout fees': 'Honorarios de scouting de locación',
    'Scout vehicle': 'Vehículo de scouting',
    'Scout fuel': 'Combustible de scouting',
    'Scout meals': 'Alimentación de scouting',
    'Pitch deck design': 'Diseño del pitch deck',
    'Other development expenses': 'Otros gastos de desarrollo',
    'Screenplay and story rights': 'Derechos de guion e historia',
    'Rights registration': 'Registro de derechos',
    'Translations': 'Traducciones',
    'Copies and binding': 'Copias y encuadernado',
    'Executive producer': 'Productor ejecutivo',
    'Line producer': 'Productor de línea',
    'Additional executive producer': 'Productor ejecutivo adicional',
    'Action choreography director': 'Director de coreografía de acción',
    'Additional directing costs': 'Costos adicionales de dirección',
    'Lead performer 1': 'Intérprete principal 1',
    'Lead performer 2': 'Intérprete principal 2',
    'Lead performer 3': 'Intérprete principal 3',
    'Supporting performer 1': 'Intérprete secundario 1',
    'Supporting performer 2': 'Intérprete secundario 2',
    'Supporting performer 3': 'Intérprete secundario 3',
    'Day player 1': 'Actor de día 1',
    'Day player 2': 'Actor de día 2',
    'Additional cast': 'Elenco adicional',
    'Casting lead': 'Responsable de casting',
    'Background performers': 'Extras',
    'Stunt performers': 'Especialistas',
    'Production assistant 1': 'Asistente de producción 1',
    'Production assistant 2': 'Asistente de producción 2',
    'Production assistant 3': 'Asistente de producción 3',
    'Production assistant 4': 'Asistente de producción 4',
    'Production coordinator': 'Coordinador de producción',
    'First assistant director': 'Primer asistente de dirección',
    'Second assistant director': 'Segundo asistente de dirección',
    'Script supervisor': 'Supervisor de continuidad',
    'Office rent, phone and internet': 'Alquiler, teléfono e internet de oficina',
    'General production expenses': 'Gastos generales de producción',
    'Mobile phones': 'Teléfonos móviles',
    'Copies': 'Copias',
    'Office consumables': 'Consumibles de oficina',
    'Courier services': 'Servicios de mensajería',
    'Cleaning': 'Limpieza',
    'Rideshare': 'Transporte por aplicación',
    'Art director': 'Director de arte',
    'Practical effects artist': 'Artista de efectos prácticos',
    'Art assistant 1': 'Asistente de arte 1',
    'Art assistant 2': 'Asistente de arte 2',
    'Art purchases and rentals': 'Compras y alquileres de arte',
    'Set dresser': 'Ambientador de set',
    'Props': 'Utilería',
    'Set dressing': 'Ambientación de set',
    'Other art expenses': 'Otros gastos de arte',
    'Director of photography': 'Director de fotografía',
    'First assistant camera': 'Primer asistente de cámara',
    'Second assistant camera': 'Segundo asistente de cámara',
    'Data manager': 'Gestor de datos',
    'Video assist with equipment': 'Video assist con equipo',
    'Camera custodian': 'Encargado de cámara',
    'Additional camera crew': 'Equipo de cámara adicional',
    'Camera package with lenses': 'Paquete de cámara con lentes',
    'Lens package': 'Paquete de lentes',
    'Tripod and accessories': 'Trípode y accesorios',
    'Filters and matte box': 'Filtros y matte box',
    'Video assist materials': 'Materiales de video assist',
    'Production storage': 'Almacenamiento de producción',
    'Camera equipment insurance': 'Seguro de equipo de cámara',
    'Production sound mixer': 'Mezclador de sonido de producción',
    'Boom operator': 'Operador de boom',
    'Sound equipment package': 'Paquete de equipo de sonido',
    'Additional sound crew': 'Equipo de sonido adicional',
    'Radio rentals': 'Alquiler de radios',
    'Sound expendables': 'Consumibles de sonido',
    'Lighting technician': 'Técnico de iluminación',
    'Grip 1': 'Grip 1',
    'Grip 2': 'Grip 2',
    'Grip 3': 'Grip 3',
    'Lighting lead': 'Jefe de iluminación',
    'Truck lead': 'Jefe de camión',
    'Lighting expendables': 'Consumibles de iluminación',
    'Grip expendables': 'Consumibles de grip',
    'Lighting package rental': 'Alquiler de paquete de iluminación',
    'Additional equipment rental': 'Alquiler de equipo adicional',
    'Damage and loss allowance': 'Reserva por daños y pérdidas',
    'Generator': 'Generador',
    'Diesel': 'Diésel',
    'Equipment expendables': 'Consumibles de equipo',
    'Stands and sandbags': 'Soportes y sacos de arena',
    'Costume designer': 'Diseñador de vestuario',
    'Wardrobe assistants': 'Asistentes de vestuario',
    'Wardrobe purchases and rentals': 'Compras y alquileres de vestuario',
    'Laundry': 'Lavandería',
    'Makeup artist': 'Maquillista',
    'Hair assistant': 'Asistente de peinado',
    'Makeup purchases': 'Compras de maquillaje',
    'Hair and makeup consumables': 'Consumibles de peinado y maquillaje',
    'Water trucks': 'Camiones cisterna',
    'Special effects expendables': 'Consumibles de efectos especiales',
    'Animal handler or trainer': 'Encargado o entrenador de animales',
    'Animals': 'Animales',
    'Animal feed': 'Alimento para animales',
    'Picture vehicles': 'Vehículos de escena',
    'Picture vehicle fuel': 'Combustible de vehículos de escena',
    'Location manager': 'Gerente de locaciones',
    'Location assistant': 'Asistente de locaciones',
    'Technical scout costs': 'Costos de scouting técnico',
    'Primary location': 'Locación principal',
    'Support location 1': 'Locación de apoyo 1',
    'Support location 2': 'Locación de apoyo 2',
    'Support location 3': 'Locación de apoyo 3',
    'Additional locations': 'Locaciones adicionales',
    'Location permits': 'Permisos de locación',
    'Location security': 'Seguridad de locación',
    'Crew hotels': 'Hoteles del equipo',
    'Airfare': 'Boletos de avión',
    'Travel transportation': 'Transporte de viaje',
    'Per diem': 'Viáticos',
    'Other travel costs': 'Otros costos de viaje',
    'Catering': 'Catering',
    'Snacks': 'Refrigerios',
    'Box meals for extras': 'Comidas en caja para extras',
    'Craft service': 'Servicio de catering',
    'Set medic': 'Paramédico de set',
    'First aid kit': 'Botiquín',
    'Health testing': 'Pruebas de salud',
    'Production van': 'Van de producción',
    'Equipment van': 'Van de equipo',
    'Wardrobe van': 'Van de vestuario',
    'Lighting and grip truck': 'Camión de iluminación y grip',
    'Transportation fuel': 'Combustible de transporte',
    'Taxis and rideshare': 'Taxis y transporte por aplicación',
    'Drivers': 'Conductores',
    'Parking': 'Estacionamiento',
    'Behind the scenes crew': 'Equipo detrás de cámaras',
    'Behind the scenes equipment': 'Equipo detrás de cámaras',
    'Behind the scenes materials': 'Materiales detrás de cámaras',
    'Picture editor': 'Editor de imagen',
    'Assistant editor': 'Asistente de edición',
    'Editing equipment': 'Equipo de edición',
    'Trailer edit': 'Edición de tráiler',
    'Other editing costs': 'Otros costos de edición',
    'Postproduction supervisor': 'Supervisor de postproducción',
    'Credits design': 'Diseño de créditos',
    'Subtitles': 'Subtítulos',
    'Conform and export': 'Conformado y exportación',
    'Mastering': 'Masterización',
    'Deliverables': 'Entregables',
    'Postproduction materials': 'Materiales de postproducción',
    'Sound designer': 'Diseñador de sonido',
    'Sound editing': 'Edición de sonido',
    'Dialogue replacement': 'Reemplazo de diálogos',
    'Sound mix': 'Mezcla de sonido',
    'Sound editing facility': 'Estudio de edición de sonido',
    'Original score': 'Música original',
    'Music licenses': 'Licencias musicales',
    'Music recording and delivery': 'Grabación y entrega de música',
    'Festival submissions': 'Inscripciones a festivales',
    'Support platforms and services': 'Plataformas y servicios de apoyo',
    'Festival attendance': 'Asistencia a festivales',
    'Poster design': 'Diseño de póster',
    'Press kit design': 'Diseño de kit de prensa',
    'Shipping': 'Envío',
    'Other distribution costs': 'Otros costos de distribución',
    'Cash production contingency': 'Contingencia de producción en efectivo',
    'Production insurance': 'Seguro de producción',
    'Additional insurance days': 'Días adicionales de seguro',
    'Insurance deductibles': 'Deducibles del seguro',
    'flat': 'fijo',
    'calculated': 'calculado',

    // Calendar and critical path workspace.
    'Calendar': 'Calendario',
    'Calendar views': 'Vistas del calendario',
    'Calendar saves automatically': 'El calendario se guarda automáticamente',
    'Calendar is not available right now.': 'El calendario no está disponible en este momento.',
    'Calendar is not available for this screenplay.': 'El calendario no está disponible para este guion.',
    'Could not load this calendar.': 'No se pudo cargar este calendario.',
    'Could not save this calendar.': 'No se pudo guardar este calendario.',
    'Loading Calendar': 'Cargando Calendario',
    'Building the route from script to delivery.': 'Construyendo la ruta del guion a la entrega.',
    'Calendar could not be opened': 'No se pudo abrir Calendario',
    'Production calendar': 'Calendario de producción',
    'Shoot': 'Rodaje',
    'The route from script lock to final delivery, recalculated every time the plan changes.': 'La ruta desde el cierre de guion hasta la entrega final, recalculada cada vez que cambia el plan.',
    'Project starts': 'Inicio del proyecto',
    'Monday–Saturday workweek': 'Semana laboral de lunes a sábado',
    'Final delivery': 'Entrega final',
    'Delivery day': 'Día de entrega',
    'Principal photography': 'Rodaje principal',
    'Main shoot': 'Rodaje principal',
    'Connected to Budget shooting dates': 'Conectado con las fechas de rodaje del Presupuesto',
    'Production status': 'Estado de producción',
    'Budget linked': 'Presupuesto conectado',
    'On track': 'En curso',
    'Overdue': 'Atrasado',
    'Today': 'Hoy',
    'Live': 'En vivo',
    'Critical path': 'Ruta crítica',
    'Overall progress': 'Progreso general',
    'Production path': 'Ruta de producción',
    'One timeline, five connected phases': 'Un cronograma, cinco fases conectadas',
    'Zero-slack work': 'Trabajo sin holgura',
    'Open timeline': 'Abrir cronograma',
    'Add dependencies to reveal the critical path.': 'Agrega dependencias para revelar la ruta crítica.',
    'Next up': 'Próximamente',
    'Upcoming work': 'Próximo trabajo',
    'Plan is on track': 'El plan avanza según lo previsto',
    'Everything in this plan is complete.': 'Todo el plan está completado.',
    'Sundays stay protected.': 'Los domingos quedan protegidos.',
    'FilmScript schedules production work from Monday through Saturday and automatically carries unfinished durations into the next working day.': 'FilmScript programa el trabajo de producción de lunes a sábado y traslada automáticamente las duraciones pendientes al siguiente día laboral.',
    'Route to delivery': 'Ruta hacia la entrega',
    'Production timeline': 'Cronograma de producción',
    'Every bar is calculated from duration, dependencies and the Monday–Saturday workweek.': 'Cada barra se calcula según su duración, dependencias y la semana laboral de lunes a sábado.',
    'Move a task or resize it from either edge. Dependencies stay connected.': 'Mueve una tarea o redimensiónala desde cualquiera de sus extremos. Las dependencias permanecen conectadas.',
    'Timeline': 'Cronograma',
    'Add task': 'Agregar tarea',
    'Task, owner or phase': 'Tarea, responsable o fase',
    'Search tasks': 'Buscar tareas',
    'Timeline zoom': 'Zoom del cronograma',
    'Zoom out': 'Alejar',
    'Zoom in': 'Acercar',
    'Reset zoom': 'Restablecer zoom',
    'Fit': 'Ajustar',
    'All phases': 'Todas las fases',
    'Critical only': 'Solo ruta crítica',
    'Critical': 'Crítica',
    'At risk': 'En riesgo',
    'Has slack': 'Con holgura',
    'Task': 'Tarea',
    'Group': 'Grupo',
    'No group': 'Sin grupo',
    'Name the new Development group': 'Nombra el nuevo grupo de Desarrollo',
    'Name the new Preproduction group': 'Nombra el nuevo grupo de Preproducción',
    'Name the new Production group': 'Nombra el nuevo grupo de Producción',
    'Name the new Postproduction group': 'Nombra el nuevo grupo de Postproducción',
    'Name the new Delivery group': 'Nombra el nuevo grupo de Entrega',
    'No tasks match this view.': 'Ninguna tarea coincide con esta vista.',
    'Clear the filters or add a new task.': 'Limpia los filtros o agrega una tarea nueva.',
    'This plan extends beyond the three-year timeline preview.': 'Este plan se extiende más allá de la vista previa de tres años.',
    'New production task': 'Nueva tarea de producción',
    'Edit production task': 'Editar tarea de producción',
    'Untitled task': 'Tarea sin título',
    'Dates update after the task is saved.': 'Las fechas se actualizan después de guardar la tarea.',
    'Close task editor': 'Cerrar editor de tareas',
    'Task name': 'Nombre de la tarea',
    'What needs to happen?': '¿Qué debe suceder?',
    'Owner': 'Responsable',
    'Department or person': 'Departamento o persona',
    'Status': 'Estado',
    'Not started': 'Sin iniciar',
    'In progress': 'En curso',
    'Blocked': 'Bloqueada',
    'Start no earlier than': 'No iniciar antes de',
    'Optional. Dependencies still apply.': 'Opcional. Las dependencias siguen aplicando.',
    'Task type': 'Tipo de tarea',
    'Delivery milestone': 'Hito de entrega',
    'Milestone': 'Hito',
    'Duration': 'Duración',
    'days': 'días',
    'Notes': 'Notas',
    'Decision, deliverable or production context': 'Decisión, entregable o contexto de producción',
    'Dependencies': 'Dependencias',
    'What must finish first?': '¿Qué debe terminar primero?',
    'FilmScript prevents circular links.': 'FilmScript evita dependencias circulares.',
    'No dependencies yet.': 'Aún no hay dependencias.',
    'Choose a task': 'Elige una tarea',
    'Add dependency': 'Agregar dependencia',
    'Delete task': 'Eliminar tarea',
    'Cancel': 'Cancelar',
    'Save changes': 'Guardar cambios',
    'Not scheduled': 'Sin programar',
    'No critical task is slipping': 'Ninguna tarea crítica está retrasándose',
    'Development': 'Desarrollo',
    'Preproduction': 'Preproducción',
    'Delivery': 'Entrega',

    // Calendar template tasks and production owners.
    'Script review and lock': 'Revisión y cierre de guion',
    'Script breakdown': 'Desglose de guion',
    'Creative proposals': 'Propuestas creativas',
    'Technical script': 'Guion técnico',
    'Preliminary shooting plan': 'Plan preliminar de rodaje',
    'Location scouting': 'Búsqueda de locaciones',
    'Department estimates': 'Estimaciones por departamento',
    'Production budget': 'Presupuesto de producción',
    'Financing': 'Financiamiento',
    'Production package and greenlight': 'Paquete de producción y luz verde',
    'Crew confirmation': 'Confirmación del equipo',
    'Location confirmation and contracts': 'Confirmación y contratos de locaciones',
    'Casting': 'Casting',
    'Cast contracts': 'Contratos del elenco',
    'Department design': 'Diseño por departamentos',
    'Art and set dressing': 'Arte y ambientación',
    'Wardrobe design and rentals': 'Diseño y alquiler de vestuario',
    'Makeup and hair tests': 'Pruebas de maquillaje y peinado',
    'Cast rehearsals': 'Ensayos con el elenco',
    'Technical scout': 'Scouting técnico',
    'Camera tests': 'Pruebas de cámara',
    'Equipment check': 'Revisión de equipo',
    'Final production meeting': 'Reunión final de producción',
    'Media offload, proxies and sound sync': 'Descarga de medios, proxies y sincronización de sonido',
    'Production expense close': 'Cierre de gastos de producción',
    'Picture edit': 'Montaje de imagen',
    'First cut review': 'Revisión del primer corte',
    'Fine cut': 'Corte fino',
    'Picture lock': 'Cierre de imagen',
    'Conform and turnover': 'Conformado y entrega a departamentos',
    'Color correction': 'Corrección de color',
    'Visual effects': 'Efectos visuales',
    'Sound edit and design': 'Edición y diseño de sonido',
    'Final mix': 'Mezcla final',
    'Online finish': 'Finalización online',
    'Translation and subtitles': 'Traducción y subtítulos',
    'Masters and quality control': 'Másteres y control de calidad',
    'Legal and release materials': 'Materiales legales y autorizaciones',
    'Writer / Director': 'Guionista / Director',
    'Director / DP': 'Director / Dir. de fotografía',
    'Assistant Director': 'Asistente de dirección',
    'Department Heads': 'Jefaturas de departamento',
    'Wardrobe': 'Vestuario',
    'Makeup / Hair': 'Maquillaje / Peinado',
    'Camera': 'Cámara',
    'Camera / Grip': 'Cámara / Grip',
    'Editorial': 'Montaje',
    'Director / Producer': 'Director / Productor',
    'Post Supervisor': 'Supervisor de postproducción',
    'Sound': 'Sonido',
    'Music': 'Música',

    // People, collaboration, invitations and guest access. These strings are
    // intentionally shared by the project dialog and the secure entry pages,
    // so a collaborator keeps the same language from an invite through to
    // their project permissions.
    'People & Access': 'Personas y acceso',
    'People and access': 'Personas y acceso',
    'People': 'Personas',
    'Project collaboration settings': 'Configuración de colaboración del proyecto',
    'Manage project roles, module permissions, and sensitive financial access.': 'Administra los roles del proyecto, los permisos por módulo y el acceso a información financiera sensible.',
    'People and access could not be loaded.': 'No se pudo cargar Personas y acceso.',
    'PROJECT SETTINGS': 'AJUSTES DEL PROYECTO',
    'Invite people': 'Invitar personas',
    'Invite a collaborator': 'Invitar a un colaborador',
    'No collaborators yet': 'Aún no hay colaboradores',
    'Invite someone when you are ready to share the project.': 'Invita a alguien cuando estés listo para compartir el proyecto.',
    'Pending Invitations': 'Invitaciones pendientes',
    'No pending invitations': 'No hay invitaciones pendientes',
    'New invitations will appear here until they are accepted.': 'Las nuevas invitaciones aparecerán aquí hasta que sean aceptadas.',
    'Collaborator': 'Colaborador',
    'FilmScript member': 'Miembro de FilmScript',
    'Secure guest link': 'Enlace seguro para invitado',
    'No module access': 'Sin acceso a módulos',
    'No Access': 'Sin acceso',
    'Script': 'Guion',
    'Comment': 'Comentar',
    'Manage': 'Administrar',
    'Project Settings': 'Ajustes del proyecto',
    'Members': 'Miembros',
    'Exports': 'Exportaciones',
    'Location Plan': 'Plan de locaciones',
    'Files': 'Archivos',
    'Cinematic role': 'Rol cinematográfico',
    'Project role': 'Rol del proyecto',
    'Module permissions': 'Permisos por módulo',
    'Financial information is sensitive. Choose exactly who can access it.': 'La información financiera es sensible. Elige exactamente quién puede acceder a ella.',
    'Financial access': 'Acceso financiero',
    'Financial department IDs': 'Identificadores de departamentos financieros',
    'No financial access': 'Sin acceso financiero',
    'Full access and access management': 'Acceso total y administración de accesos',
    'Edit all financial information': 'Editar toda la información financiera',
    'View all financial information': 'Ver toda la información financiera',
    'Edit all and export': 'Editar todo y exportar',
    'View assigned departments': 'Ver departamentos asignados',
    'Edit assigned departments': 'Editar departamentos asignados',
    'camera, art, production': 'cámara, arte, producción',
    'FilmScript username, email, or secure guest link': 'Usuario de FilmScript, correo electrónico o enlace seguro para invitado',
    'name@example.com or username': 'nombre@ejemplo.com o usuario',
    'Leave this blank only when creating a Temporary Guest link.': 'Déjalo en blanco únicamente al crear un enlace de invitado temporal.',
    'Department Editor': 'Editor de departamento',
    'Co owner': 'Coresponsable',
    'Commenter': 'Comentarista',
    'Viewer': 'Lector',
    'Temporary Guest': 'Invitado temporal',
    'Writer': 'Guionista',
    'Director of Photography': 'Director de fotografía',
    'Camera Department': 'Departamento de cámara',
    'Gaffer': 'Gaffer',
    'Grip': 'Grip',
    'Production Designer': 'Diseñador de producción',
    'Hair And Makeup': 'Maquillaje y peinado',
    'Client': 'Cliente',
    'Talent': 'Talento',
    'Idle': 'Inactivo',
    'Disconnected': 'Desconectado',
    'Suspended': 'Suspendido',
    'Removed': 'Eliminado',
    'Revoked': 'Revocada',
    'Actions for': 'Acciones para',
    'Invitation actions': 'Acciones de la invitación',
    'Edit role and permissions': 'Editar rol y permisos',
    'Promote to Admin': 'Promover a administrador',
    'Promote to Co owner': 'Promover a coresponsable',
    'Transfer ownership': 'Transferir propiedad',
    'Suspend access': 'Suspender acceso',
    'Remove from project': 'Quitar del proyecto',
    'Copy invitation link': 'Copiar enlace de invitación',
    'Resend invitation': 'Reenviar invitación',
    'Edit access': 'Editar acceso',
    'Revoke invitation': 'Revocar invitación',
    'Copied': 'Copiado',
    'Sent': 'Enviada',
    'Create invitation': 'Crear invitación',
    'Save access': 'Guardar acceso',
    'No expiration': 'Sin vencimiento',
    'Remove this person from the project now?': '¿Quitar a esta persona del proyecto ahora?',
    'Transfer billing ownership to this person?': '¿Transferir a esta persona la propiedad de la facturación?',
    'Revoke this invitation now?': '¿Revocar esta invitación ahora?',
    'Enter a FilmScript username or email.': 'Ingresa un usuario o correo electrónico de FilmScript.',
    'You cannot grant financial access.': 'No puedes otorgar acceso financiero.',
    'You cannot change financial access.': 'No puedes cambiar el acceso financiero.',
    'Invitation was not found.': 'No se encontró la invitación.',
    'Only a pending invitation can be edited.': 'Solo se puede editar una invitación pendiente.',
    'Pending invitation was not found.': 'No se encontró la invitación pendiente.',
    'This invitation is no longer available.': 'Esta invitación ya no está disponible.',
    'Sign in before accepting this invitation.': 'Inicia sesión antes de aceptar esta invitación.',
    'This invitation belongs to another account.': 'Esta invitación pertenece a otra cuenta.',
    'Project invitation': 'Invitación al proyecto',
    'Project invitation actions': 'Acciones de invitación al proyecto',
    'Show project invitation actions': 'Mostrar acciones de invitación al proyecto',
    'Accept project invitation': 'Aceptar invitación al proyecto',
    'Decline project invitation': 'Rechazar invitación al proyecto',
    'Accepting invitation…': 'Aceptando invitación…',
    'Declining invitation…': 'Rechazando invitación…',
    'Invitation accepted. Opening your scripts…': 'Invitación aceptada. Abriendo tus guiones…',
    'Invitation declined.': 'Invitación rechazada.',
    'The invitation could not be updated.': 'No se pudo actualizar la invitación.',
    'You are invited to collaborate': 'Te invitaron a colaborar',
    'Continue with your FilmScript account to accept the project invitation and preserve its assigned access.': 'Continúa con tu cuenta de FilmScript para aceptar la invitación al proyecto y conservar el acceso asignado.',
    'An account is required to edit project content.': 'Se requiere una cuenta para editar el contenido del proyecto.',
    'Invitation link unavailable': 'El enlace de invitación no está disponible',
    'Guest access': 'Acceso de invitado',
    'Guest project access': 'Acceso de invitado al proyecto',
    'Opening your secure invitation': 'Abriendo tu invitación segura',
    'Permitted project areas': 'Áreas permitidas del proyecto',
    'Loading permitted content': 'Cargando contenido permitido',
    'No script content is available yet.': 'Aún no hay contenido de guion disponible.',
    'Access unavailable': 'Acceso no disponible',
    'This invitation link is incomplete.': 'Este enlace de invitación está incompleto.',
    'No project areas were shared.': 'No se compartió ninguna área del proyecto.',
    'Ask the project owner for a new invitation.': 'Pídele al responsable del proyecto una nueva invitación.',
    'This guest invitation is no longer available.': 'Esta invitación de invitado ya no está disponible.',

    // Public Shared Project and authentication routes.
    'Project View · FilmScript': 'Vista del proyecto · FilmScript',
    'Project View': 'Vista del proyecto',
    'Opening Project View': 'Abriendo la vista del proyecto',
    'Loading the latest shared project content.': 'Cargando el contenido compartido más reciente del proyecto.',
    'Canvas': 'Canvas',
    'Loading Canvas': 'Cargando Canvas',
    'Connecting your visual references and boards.': 'Conectando tus referencias visuales y tableros.',
    'Location Plans': 'Planos de locación',
    'Imagine': 'Imagine',
    'Loading your Imagine gallery': 'Cargando tu galería de Imagine',
    'Frames will appear as soon as they are ready.': 'Las imágenes aparecerán en cuanto estén listas.',
    'Selected Files': 'Archivos seleccionados',
    'This Project View is unavailable.': 'Esta vista del proyecto no está disponible.',
    'Just now': 'Ahora mismo',
    'Request access': 'Solicitar acceso',
    'Tell the project owner how to reach you. They can invite you to FilmScript if access is approved.': 'Indica al responsable del proyecto cómo contactarte. Podrá invitarte a FilmScript si aprueba el acceso.',
    'Email address': 'Correo electrónico',
    'Optional note': 'Nota opcional',
    'Back to Project View': 'Volver a la vista del proyecto',
    'Sign In': 'Iniciar sesión',
    'Your request was sent to the project owner.': 'Tu solicitud se envió al responsable del proyecto.',
    'We could not send your access request. Please try again.': 'No pudimos enviar tu solicitud de acceso. Inténtalo de nuevo.',
    'Password protected': 'Protegido con contraseña',
    'Sign in to continue': 'Inicia sesión para continuar',
    'Project View unavailable': 'Vista del proyecto no disponible',
    'Enter the password provided by the project owner.': 'Ingresa la contraseña proporcionada por el responsable del proyecto.',
    'This Shared Project link is no longer available.': 'Este enlace de proyecto compartido ya no está disponible.',
    'Project password': 'Contraseña del proyecto',
    'Open Project View': 'Abrir vista del proyecto',
    'Open in FilmScript': 'Abrir en FilmScript',
    'That password is not correct.': 'La contraseña no es correcta.',
    'Sign in with an invited email address.': 'Inicia sesión con un correo electrónico invitado.',
    'This Shared Project link has been revoked.': 'Este enlace de proyecto compartido fue revocado.',
    'The screenplay has no shared pages yet.': 'El guion aún no tiene páginas compartidas.',
    'No analysis has been shared yet.': 'Aún no se ha compartido ningún análisis.',
    'Story overview': 'Resumen de la historia',
    'Analysis is ready to view when the project adds it.': 'El análisis estará disponible cuando el proyecto lo agregue.',
    'No shared scenes are available yet.': 'Aún no hay escenas compartidas disponibles.',
    'Item': 'Elemento',
    'No items yet': 'Aún no hay elementos',
    'Scheduled scene': 'Escena programada',
    'No stripboard scenes are shared yet.': 'Aún no hay escenas del plan de rodaje compartidas.',
    'not started': 'sin iniciar',
    'No calendar tasks are shared yet.': 'Aún no hay tareas de calendario compartidas.',
    'No budget is shared yet.': 'Aún no hay un presupuesto compartido.',
    'Budget item': 'Partida presupuestaria',
    'Department': 'Departamento',
    'Details': 'Detalles',
    'The project owner has shared this budget.': 'El responsable del proyecto compartió este presupuesto.',
    'Untitled board': 'Tablero sin título',
    'Shared visual board': 'Tablero visual compartido',
    'object': 'objeto',
    'objects': 'objetos',
    'Canvas asset': 'Recurso de Canvas',
    'No Canvas boards are shared yet.': 'Aún no hay tableros de Canvas compartidos.',
    'measured spaces': 'espacios medidos',
    'Project plan': 'Plano del proyecto',
    'No Location Plans are shared yet.': 'Aún no hay planos de locación compartidos.',
    'Imagine frame': 'imagen de Imagine',
    'selected file': 'archivo seleccionado',
    'No Imagine frames are shared yet.': 'Aún no hay imágenes de Imagine compartidas.',
    'No selected files are shared yet.': 'Aún no hay archivos seleccionados compartidos.',
    'No shared content is available in this section.': 'No hay contenido compartido disponible en esta sección.',
    'No shared sections': 'No hay secciones compartidas',
    'The project owner has not exposed any content.': 'El responsable del proyecto no ha compartido contenido.',
    'Project View · Read only': 'Vista del proyecto · Solo lectura',
    'Refresh latest content': 'Actualizar el contenido más reciente',
    'Request': 'Solicitar',
    'Open': 'Abrir',
    'Shared sections': 'Secciones compartidas',
    'Latest project source': 'Fuente más reciente del proyecto',
    'A live, read-only view of the sections selected by the project owner.': 'Una vista actualizada y de solo lectura de las secciones seleccionadas por el responsable del proyecto.',
    'Read only': 'Solo lectura',
    'Source refreshed': 'Fuente actualizada',
    'Preparing…': 'Preparando…',
    'This Shared Project link is incomplete.': 'Este enlace de proyecto compartido está incompleto.',
    'We could not prepare this export. Please try again.': 'No pudimos preparar esta exportación. Inténtalo de nuevo.',
    'Finishing sign in · FilmScript': 'Finalizando el inicio de sesión · FilmScript',
    'Opening your scripts…': 'Abriendo tus guiones…',
    'Securing your FilmScript session.': 'Protegiendo tu sesión de FilmScript.',
    'Try Google sign in again': 'Intentar iniciar sesión con Google de nuevo',
    'We could not finish your sign in. Please try again.': 'No pudimos completar tu inicio de sesión. Inténtalo de nuevo.',
    'FilmScript · Sign in': 'FilmScript · Iniciar sesión',
    'Connecting to Google…': 'Conectando con Google…'
  });

  const supportedLanguage = (value) => SUPPORTED.has(String(value || '').toLowerCase())
    ? String(value).toLowerCase()
    : null;

  const normalize = (value) => SUPPORTED.has(String(value || '').toLowerCase())
    ? String(value).toLowerCase()
    : 'en';

  // A hosted payment provider returns to Pricing with the selected language in
  // the query string. Persist it before the first render so the app does not
  // briefly switch back to English after a Spanish checkout.
  try {
    const checkoutLanguage = String(new URLSearchParams(window.location.search).get('lang') || '').toLowerCase();
    if (SUPPORTED.has(checkoutLanguage)) localStorage.setItem(STORAGE_KEY, checkoutLanguage);
  } catch (error) {}

  const accountStorageKey = (id) => `${ACCOUNT_STORAGE_PREFIX}${String(id || '').trim()}`;

  const get = () => {
    try {
      if (accountState.id) {
        const accountLanguage = supportedLanguage(accountState.language)
          || supportedLanguage(localStorage.getItem(accountStorageKey(accountState.id)));
        if (accountLanguage) return accountLanguage;
      }
      return normalize(localStorage.getItem(STORAGE_KEY));
    }
    catch (error) { return 'en'; }
  };

  const hasStoredLanguage = () => {
    try {
      if (accountState.hydrated && accountState.id) {
        return Boolean(supportedLanguage(accountState.language)
          || supportedLanguage(localStorage.getItem(accountStorageKey(accountState.id))));
      }
      const stored = String(localStorage.getItem(STORAGE_KEY) || '').toLowerCase();
      return SUPPORTED.has(stored);
    } catch (error) {
      return false;
    }
  };

  const shouldOfferInitialChoice = () => {
    if (!accountState.hydrated || !accountState.id) return false;
    if (hasStoredLanguage()) return false;
    try {
      const page = decodeURIComponent(window.location.pathname.split('/').pop() || '');
      // Let visitors browse the public marketing pages without an interruption;
      // the first authenticated workspace entry is where language becomes useful.
      return /^(App|Editor v5|Subscription)\.dc(?:\.html)?$/i.test(page);
    } catch (error) {
      return false;
    }
  };

  const translateDynamic = (value) => {
    let match;
    if ((match = value.match(/^Access for (.+)$/))) return `Acceso para ${match[1]}`;
    if ((match = value.match(/^Actions for (.+)$/))) return `Acciones para ${match[1]}`;
    if ((match = value.match(/^Expires (.+)$/))) return `Vence ${match[1]}`;
    if ((match = value.match(/^Read only access expires (.+)\.$/))) return `El acceso de solo lectura vence ${match[1]}.`;
    if ((match = value.match(/^(\d+) areas · (.+)$/))) {
      const labels = match[2].split(', ').map((entry) => {
        const permission = entry.match(/^(.*) (No Access|View|Comment|Edit|Manage)$/);
        if (!permission) return t(entry, 'es');
        return `${t(permission[1], 'es')} ${t(permission[2], 'es')}`;
      });
      return `${match[1]} ${Number(match[1]) === 1 ? 'área' : 'áreas'} · ${labels.join(', ')}`;
    }
    if ((match = value.match(/^([a-z_ ]+): (no_access|view|comment|edit|manage)$/))) {
      const title = (entry) => entry.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
      return `${t(title(match[1]), 'es')}: ${t(title(match[2]), 'es')}`;
    }
    if ((match = value.match(/^Updated (just now|\d+s ago|\d+m ago)$/))) {
      const when = match[1] === 'just now' ? 'justo ahora' : match[1]
        .replace(/^(\d+)s ago$/, 'hace $1 s')
        .replace(/^(\d+)m ago$/, 'hace $1 min');
      return `Actualizado ${when}`;
    }
    if ((match = value.match(/^Updated (.+)$/))) return `Actualizado ${match[1]}`;
    if ((match = value.match(/^Prep Week (\d+)$/))) return `Semana de preparación ${match[1]}`;
    if ((match = value.match(/^Shoot Week (\d+)$/))) return `Semana de rodaje ${match[1]}`;
    if ((match = value.match(/^Wrap Week (\d+)$/))) return `Semana de cierre ${match[1]}`;
    if ((match = value.match(/^Post Week (\d+)$/))) return `Semana de postproducción ${match[1]}`;
    if ((match = value.match(/^All (\d+) weeks$/))) return `Todas las ${match[1]} semanas`;
    if ((match = value.match(/^(\d+) of (\d+) weeks$/))) return `${match[1]} de ${match[2]} semanas`;
    if ((match = value.match(/^(\d+) matching weeks?$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'semana coincidente' : 'semanas coincidentes'}`;
    if ((match = value.match(/^(\d+) matching weeks? · (\d+) unplaced$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'semana coincidente' : 'semanas coincidentes'} · ${match[2]} sin ubicar`;
    if ((match = value.match(/^(\d+) dated · (\d+) need dates$/))) return `${match[1]} fechados · ${match[2]} necesitan fecha`;
    if ((match = value.match(/^(\d+) dated payments?$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'pago fechado' : 'pagos fechados'}`;
    if ((match = value.match(/^(\d+) breakdown scenes? · (\d+) shoot days? · (\d+) shoot weeks?$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'escena de desglose' : 'escenas de desglose'} · ${match[2]} ${Number(match[2]) === 1 ? 'día de rodaje' : 'días de rodaje'} · ${match[3]} ${Number(match[3]) === 1 ? 'semana de rodaje' : 'semanas de rodaje'}`;
    if ((match = value.match(/^Production Calendar starts (.+)\.$/))) return `El Calendario de producción comienza el ${match[1]}.`;
    if ((match = value.match(/^Payment (.+)$/))) return `Pago ${match[1]}`;
    if ((match = value.match(/^Preview of (.+)$/))) return `Vista previa de ${match[1]}`;
    if ((match = value.match(/^Shoot day (\d+)(?: · (\d+) scenes?)?$/))) return `Día de rodaje ${match[1]}${match[2] ? ` · ${match[2]} ${Number(match[2]) === 1 ? 'escena' : 'escenas'}` : ''}`;
    if ((match = value.match(/^Shoot days (\d+)–(\d+)(?: · (\d+) scenes?)?$/))) return `Días de rodaje ${match[1]}–${match[2]}${match[3] ? ` · ${match[3]} ${Number(match[3]) === 1 ? 'escena' : 'escenas'}` : ''}`;
    if ((match = value.match(/^(.+) (\d+(?:\.\d+)?%) (added|included)$/))) return `${match[1]} ${match[2]} ${match[3] === 'added' ? 'agregado' : 'incluido'}`;
    if ((match = value.match(/^(\d+) weeks?$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'semana' : 'semanas'}`;
    if ((match = value.match(/^(\d+) issues?$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'problema' : 'problemas'}`;
    if ((match = value.match(/^(\d+) lines?$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'partida' : 'partidas'}`;
    if ((match = value.match(/^(\d+) payments? need a date$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'pago necesita fecha' : 'pagos necesitan fecha'}`;
    if ((match = value.match(/^(\d+) payments? outside the timeline$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'pago está fuera del cronograma' : 'pagos están fuera del cronograma'}`;
    if ((match = value.match(/^(\d+) approved lines? exceeded$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'partida aprobada excedida' : 'partidas aprobadas excedidas'}`;
    if ((match = value.match(/^(\d+) not in the approved plan$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'no está en el plan aprobado' : 'no están en el plan aprobado'}`;
    if ((match = value.match(/^(\d+(?:\.\d+)?%) placed$/))) return `${match[1]} ubicado`;
    if ((match = value.match(/^((?:[A-Z]{3}|[$Q€£])\s?.+) in unexpected costs$/))) return `${match[1]} en costos inesperados`;
    if ((match = value.match(/^(.+) · Overall over budget$/))) return `${match[1]} · Total sobre presupuesto`;
    if ((match = value.match(/^(.+) · Overall remaining$/))) return `${match[1]} · Total restante`;
    if ((match = value.match(/^More screenplay context is needed before Lumiere can interpret (.+)\.$/))) return `Lumiere necesita más contexto del guion para interpretar ${match[1]}.`;
    if ((match = value.match(/^Creator or Full unlocks a new Lumiere (.+) analysis\.$/))) return `Creator o Full desbloquean un nuevo análisis de ${match[1]} con Lumiere.`;
    if ((match = value.match(/^(.+) is included with FilmScript Creator and FilmScript Full\. Your scripts and manual production documents remain available to edit and export\.$/))) return `${t(match[1], 'es')} está incluido con FilmScript Creator y Full. Tus guiones y documentos manuales de producción siguen disponibles para editar y exportar.`;
    if ((match = value.match(/^Ask Lumiere about (.+)$/))) return `Preguntar a Lumiere sobre ${match[1]}`;
    if ((match = value.match(/^Manual breakdown ready for (\d+) scenes?\.$/))) return `Desglose manual listo para ${match[1]} ${Number(match[1]) === 1 ? 'escena' : 'escenas'}.`;
    if ((match = value.match(/^(.+) highlighted in the script\.$/))) return `${match[1]} resaltado en el guion.`;
    if ((match = value.match(/^(.+) · appearance (\d+) of (\d+)\.$/))) return `${match[1]} · aparición ${match[2]} de ${match[3]}.`;
    if ((match = value.match(/^Could not find (.+) in this scene\. Refresh the breakdown to reconnect it\.$/))) return `No se pudo encontrar ${match[1]} en esta escena. Actualiza el desglose para volver a conectarlo.`;
    if ((match = value.match(/^(.+) Excel export downloaded\.$/))) return `Exportación de ${match[1]} para Excel descargada.`;
    if ((match = value.match(/^Shoot location assigned to (\d+) scenes?\.$/))) return `Locación de rodaje asignada a ${match[1]} ${Number(match[1]) === 1 ? 'escena' : 'escenas'}.`;
    if ((match = value.match(/^Shoot location removed from (\d+) scenes?\.$/))) return `Locación de rodaje quitada de ${match[1]} ${Number(match[1]) === 1 ? 'escena' : 'escenas'}.`;
    if ((match = value.match(/^Cast (added to|removed from) (\d+) scenes?\.$/))) return `Reparto ${match[1] === 'added to' ? 'agregado a' : 'quitado de'} ${match[2]} ${Number(match[2]) === 1 ? 'escena' : 'escenas'}.`;
    if ((match = value.match(/^All cast removed from (\d+) scenes?\.$/))) return `Todo el reparto se quitó de ${match[1]} ${Number(match[1]) === 1 ? 'escena' : 'escenas'}.`;
    if ((match = value.match(/^(\d+) strips moved together · start times recalculated\.$/))) return `${match[1]} tiras movidas juntas · horas de inicio recalculadas.`;
    if ((match = value.match(/^Only (.+) remain for this scene\.$/))) return `Solo quedan ${match[1]} para esta escena.`;
    if ((match = value.match(/^Open scene (\d+) in script$/))) return `Abrir la escena ${match[1]} en el guion`;
    if ((match = value.match(/^Select scene (\d+)$/))) return `Seleccionar escena ${match[1]}`;
    if ((match = value.match(/^Open the scene for location (.+)$/))) return `Abrir en el guion la escena de la locación ${match[1]}`;
    if ((match = value.match(/^Cast (\d+)$/))) return `Reparto ${match[1]}`;
    if ((match = value.match(/^Open in Scene (\d+)$/))) return `Abrir en la escena ${match[1]}`;
    if ((match = value.match(/^Assign shoot location for scene (\d+)$/))) return `Asignar locación de rodaje a la escena ${match[1]}`;
    if ((match = value.match(/^Shoot location for scene (\d+)$/))) return `Locación de rodaje de la escena ${match[1]}`;
    if ((match = value.match(/^Assign most recent shoot location (.+) to scene (\d+)$/))) return `Asignar la locación de rodaje reciente ${match[1]} a la escena ${match[2]}`;
    if ((match = value.match(/^Assign most recent shoot location (.+) to selected scenes$/))) return `Asignar la locación de rodaje reciente ${match[1]} a las escenas seleccionadas`;
    if ((match = value.match(/^Assign (.+)$/))) return `Asignar ${match[1]}`;
    if ((match = value.match(/^Move (.+) (earlier|later)$/))) return `Mover ${match[1]} ${match[2] === 'earlier' ? 'antes' : 'después'}`;
    if ((match = value.match(/^Edit (.+) duration$/))) return `Editar duración de ${match[1]}`;
    if ((match = value.match(/^Edit (Shooting day \d+)$/))) return `Editar ${t(match[1], 'es').toLowerCase()}`;
    if ((match = value.match(/^Estimated time for scene (\d+)$/))) return `Tiempo estimado de la escena ${match[1]}`;
    if ((match = value.match(/^Reference for scene (\d+)$/))) return `Referencia de la escena ${match[1]}`;
    if ((match = value.match(/^Reference image for shot (.+)$/))) return `Imagen de referencia del plano ${match[1]}`;
    if ((match = value.match(/^Set duration for shot (.+)$/))) return `Definir duración del plano ${match[1]}`;
    if ((match = value.match(/^Open reference image for shot (.+)$/))) return `Abrir imagen de referencia del plano ${match[1]}`;
    if ((match = value.match(/^Add reference image for shot (.+)$/))) return `Agregar imagen de referencia al plano ${match[1]}`;
    if ((match = value.match(/^Replace reference image for scene (\d+)$/))) return `Reemplazar imagen de referencia de la escena ${match[1]}`;
    if ((match = value.match(/^Add reference image for scene (\d+)$/))) return `Agregar imagen de referencia a la escena ${match[1]}`;
    if ((match = value.match(/^Scene (\d+) · Page (\d+)$/))) return `Escena ${match[1]} · Página ${match[2]}`;
    if ((match = value.match(/^Scene (\d+) · Pages? ([\d,\s–-]+)$/))) return `Escena ${match[1]} · Páginas ${match[2]}`;
    if ((match = value.match(/^Scene (\d+): (.+)$/))) return `Escena ${match[1]}: ${match[2]}`;
    if ((match = value.match(/^Scene (\d+) · (.+)$/))) return `Escena ${match[1]} · ${match[2]}`;
    if ((match = value.match(/^Scene (\d+)$/))) return `Escena ${match[1]}`;
    if ((match = value.match(/^(\d+) scenes · current draft$/))) return `${match[1]} escenas · borrador actual`;
    if ((match = value.match(/^(\d+) strengths$/))) return `${match[1]} fortalezas`;
    if ((match = value.match(/^(\d+) priorities$/))) return `${match[1]} prioridades`;
    if ((match = value.match(/^(\d+) scenes read$/))) return `${match[1]} escenas leídas`;
    if ((match = value.match(/^(\d+) signals?$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'señal' : 'señales'}`;
    if ((match = value.match(/^(\d+) (Locations|Characters|Night scenes|Complex scenes|High complexity scenes)$/))) return `${match[1]} ${t(match[2], 'es').toLowerCase()}`;
    if ((match = value.match(/^(\d+) fixes · (\d+) moments$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'corrección' : 'correcciones'} · ${match[2]} ${Number(match[2]) === 1 ? 'momento' : 'momentos'}`;
    if ((match = value.match(/^(\d+) impacts · (\d+) complex scenes$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'impacto' : 'impactos'} · ${match[2]} ${Number(match[2]) === 1 ? 'escena compleja' : 'escenas complejas'}`;
    if ((match = value.match(/^(\d+) scene(s?)$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'escena' : 'escenas'}`;
    if ((match = value.match(/^Beat (\d+)$/))) return `Momento ${match[1]}`;
    if ((match = value.match(/^Priority (\d+)$/))) return `Prioridad ${match[1]}`;
    if ((match = value.match(/^Scenes ([\d,\s–-]+) · Pages? ([\d,\s–-]+)$/))) return `Escenas ${match[1]} · Páginas ${match[2]}`;
    if ((match = value.match(/^Needs attention · (\d+)$/))) return `Necesita atención · ${match[1]}`;
    if ((match = value.match(/^High complexity · (\d+)$/))) return `Alta complejidad · ${match[1]}`;
    if ((match = value.match(/^Story flow across (\d+) scenes$/))) return `Flujo de la historia a lo largo de ${match[1]} escenas`;
    if ((match = value.match(/^Analysis updated · Last updated (.+)$/))) {
      const when = match[1] === 'just now' ? 'justo ahora' : match[1]
        .replace(/^(\d+)m ago$/, 'hace $1 min')
        .replace(/^(\d+)h ago$/, 'hace $1 h')
        .replace(/^(\d+)d ago$/, 'hace $1 d');
      return `Análisis actualizado · Actualizado ${when}`;
    }
    if ((match = value.match(/^Page (\d+)(?:–(\d+))? · (\d+)%$/))) return `Página ${match[1]}${match[2] ? `–${match[2]}` : ''} · ${match[3]}%`;
    if ((match = value.match(/^(\d+) dialogue words$/))) return `${match[1]} palabras de diálogo`;
    if ((match = value.match(/^(\d+) action words$/))) return `${match[1]} palabras de acción`;
    if ((match = value.match(/^(\d+)s average$/))) return `${match[1]} s de promedio`;
    if ((match = value.match(/^Pacing across (\d+) screenplay scenes$/))) return `Ritmo a lo largo de ${match[1]} escenas del guion`;
    if ((match = value.match(/^Emotional Arc across (\d+) screenplay scenes$/))) return `Arco emocional a lo largo de ${match[1]} escenas del guion`;
    if ((match = value.match(/^Scene (\d+) of (\d+)$/))) return `Escena ${match[1]} de ${match[2]}`;
    if ((match = value.match(/^You paused on Scene (\d+)\.$/))) return `Hiciste una pausa en la escena ${match[1]}.`;
    if ((match = value.match(/^Page (\d+) of (\d+)$/))) return `Página ${match[1]} de ${match[2]}`;
    if ((match = value.match(/^Question (\d+) of (\d+)$/))) return `Pregunta ${match[1]} de ${match[2]}`;
    if ((match = value.match(/^(\d+) characters? reviewed$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'personaje revisado' : 'personajes revisados'}`;
    if ((match = value.match(/^(\d+) screenplay mentions? will change\. Scene headings and partial word matches stay untouched\.$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'mención del guion cambiará' : 'menciones del guion cambiarán'}. Los encabezados de escena y las coincidencias parciales no se modificarán.`;
    if ((match = value.match(/^Replace (.+) with (.+)\?$/))) return `¿Reemplazar ${match[1]} por ${match[2]}?`;
    if ((match = value.match(/^Changed to (.+)$/))) return `Cambiado a ${match[1]}`;
    if ((match = value.match(/^(\d+) pending$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'pendiente' : 'pendientes'}`;
    if ((match = value.match(/^(\d+) directions · (\d+) saved$/))) return `${match[1]} propuestas · ${match[2]} guardadas`;
    if ((match = value.match(/^(\d+) possible corrections? remain\. Use Show to see each line and Adjust to correct it in the screenplay\.$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'posible corrección permanece' : 'posibles correcciones permanecen'}. Usa Mostrar para ver cada línea y Ajustar para corregirla en el guion.`;
    if ((match = value.match(/^Page (\d+) · (Scene|Action|Character|Parenthetical|Dialogue|Transition|Fade in|End|Block)$/))) return `Página ${match[1]} · ${t(match[2], 'es')}`;
    if ((match = value.match(/^(Scene|Action|Character|Parenthetical|Dialogue|Transition|Fade in|End|Block) → (Scene|Action|Character|Parenthetical|Dialogue|Transition|Fade in|End|Block), corrected text$/))) return `${t(match[1], 'es')} → ${t(match[2], 'es')}, texto corregido`;
    if ((match = value.match(/^(Scene|Action|Character|Parenthetical|Dialogue|Transition|Fade in|End|Block) → (Scene|Action|Character|Parenthetical|Dialogue|Transition|Fade in|End|Block)$/))) return `${t(match[1], 'es')} → ${t(match[2], 'es')}`;
    if ((match = value.match(/^(\d+) format adjustments? applied and queued for save\.$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'ajuste de formato aplicado' : 'ajustes de formato aplicados'} y en cola para guardarse.`;
    if ((match = value.match(/^(.+) · (\d+) pages$/))) return `${match[1]} · ${match[2]} ${Number(match[2]) === 1 ? 'página' : 'páginas'}`;
    if ((match = value.match(/^Delete “(.+)”\? This cannot be undone\.$/))) return `¿Eliminar “${match[1]}”? Esta acción no se puede deshacer.`;
    if ((match = value.match(/^Restored (.+)$/))) return `${match[1]} restaurado`;
    if ((match = value.match(/^(\d+) scenes renumbered, rail updated$/))) return `${match[1]} escenas renumeradas; panel actualizado`;
    if ((match = value.match(/^Imported (.+), (\d+) scenes$/))) return `${match[1]} importado, ${match[2]} escenas`;
    if ((match = value.match(/^Title Room found (\d+) directions\.$/))) return `La Sala de títulos encontró ${match[1]} propuestas.`;
    if ((match = value.match(/^(\d+) screenplays? ready to shape\.$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'guion listo' : 'guiones listos'} para trabajar.`;
    if ((match = value.match(/^(\d+) pages? · imported$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'página' : 'páginas'} · importado`;
    if ((match = value.match(/^(\d+) pages? · edited (.+)$/))) {
      const when = { 'yesterday': 'ayer', '2h ago': 'hace 2 h', '3d ago': 'hace 3 días', '1w ago': 'hace 1 semana', '2w ago': 'hace 2 semanas' }[match[2]] || match[2];
      return `${match[1]} ${Number(match[1]) === 1 ? 'página' : 'páginas'} · editado ${when}`;
    }
    if ((match = value.match(/^No scripts match “(.+)”\.$/))) return `Ningún guion coincide con “${match[1]}”.`;
    if ((match = value.match(/^Open (.+) in the screenplay editor$/))) return `Abrir ${match[1]} en el editor de guion`;
    if ((match = value.match(/^Opening (.+) in the editor$/))) return `Abriendo ${match[1]} en el editor`;
    if ((match = value.match(/^Reading (.+)…$/))) return `Leyendo ${match[1]}…`;
    if ((match = value.match(/^(\d+) production elements$/))) return `${match[1]} elementos de producción`;
    if ((match = value.match(/^(\d+) proposed shots$/))) return `${match[1]} planos propuestos`;
    if ((match = value.match(/^(\d+) scenes?$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'escena' : 'escenas'}`;
    if ((match = value.match(/^(\d+) scenes · (\d+) need review$/))) return `${match[1]} escenas · ${match[2]} por revisar`;
    if ((match = value.match(/^(\d+) scenes · (\d+) need camera plans$/))) return `${match[1]} escenas · ${match[2]} necesitan plan de cámara`;
    if ((match = value.match(/^(\d+) scenes · (\d+) unscheduled$/))) return `${match[1]} escenas · ${match[2]} sin programar`;
    if ((match = value.match(/^(\d+) shots?$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'plano' : 'planos'}`;
    if ((match = value.match(/^(\d+) workdays? late$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'día laboral de retraso' : 'días laborales de retraso'}`;
    if ((match = value.match(/^(\d+) workdays? remaining$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'día laboral restante' : 'días laborales restantes'}`;
    if ((match = value.match(/^(\d+) tasks? needs? attention$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'tarea necesita atención' : 'tareas necesitan atención'}`;
    if ((match = value.match(/^(\d+) need attention$/))) return `${match[1]} requieren atención`;
    if ((match = value.match(/^(\d+) of (\d+) tasks complete$/))) return `${match[1]} de ${match[2]} tareas completadas`;
    if ((match = value.match(/^(\d+) production days$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'día de producción' : 'días de producción'}`;
    if ((match = value.match(/^(\d+) tasks?$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'tarea' : 'tareas'}`;
    if ((match = value.match(/^(.+) · (\d+) tasks?$/))) return `${match[1]} · ${match[2]} ${Number(match[2]) === 1 ? 'tarea' : 'tareas'}`;
    if ((match = value.match(/^(\d+)d slack$/))) return `${match[1]} d de holgura`;
    if ((match = value.match(/^(\d+) days? of slack$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'día de holgura' : 'días de holgura'}`;
    if ((match = value.match(/^(.+) · Critical path$/))) return `${match[1]} · Ruta crítica`;
    if ((match = value.match(/^(.+) · (\d+) days? of slack$/))) return `${match[1]} · ${match[2]} ${Number(match[2]) === 1 ? 'día de holgura' : 'días de holgura'}`;
    if ((match = value.match(/^Mark (.+) complete$/))) return `Marcar ${match[1]} como completada`;
    if ((match = value.match(/^More actions for (.+)$/))) return `Más acciones para ${match[1]}`;
    if ((match = value.match(/^Remove dependency (.+)$/))) return `Quitar dependencia ${match[1]}`;
    if ((match = value.match(/^Task (\d+)$/))) return `Tarea ${match[1]}`;
    if ((match = value.match(/^Reads all (\d+) pages$/))) return `Lee las ${match[1]} páginas`;
    if ((match = value.match(/^(\d+) image credits? left$/))) return `${match[1]} créditos de imagen disponibles`;
    if ((match = value.match(/^(\d+) credits? left$/))) return `${match[1]} créditos disponibles`;
    if ((match = value.match(/^(\d+) cost items?$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'partida' : 'partidas'}`;
    if ((match = value.match(/^(\d+) payments?$/))) return `${match[1]} ${Number(match[1]) === 1 ? 'pago' : 'pagos'}`;
    if ((match = value.match(/^Schedule (.+)$/))) return `Programar ${match[1]}`;
    if ((match = value.match(/^Delete (.+)$/))) return `Eliminar ${match[1]}`;
    if ((match = value.match(/^Scene (\d+), (.+), (DAY|NIGHT|DAWN)\. Drag to reorder\. Press Option plus Arrow Up or Arrow Down for keyboard reordering\.$/))) return `Escena ${match[1]}, ${match[2]}, ${t(match[3], 'es')}. Arrastra para reordenar. Presiona Opción más Flecha arriba o Flecha abajo para ordenar con el teclado.`;
    if ((match = value.match(/^(.+) is active\. Your payment was verified securely\.$/))) return `${match[1]} está activo. Tu pago se verificó de forma segura.`;
    if ((match = value.match(/^Based on (.+) in eligible cash costs$/))) return `Basado en ${match[1]} de costos en efectivo elegibles`;
    if ((match = value.match(/^((?:[A-Z]{3}|[$Q€£])\s?.+) spent$/))) return `${match[1]} gastado`;
    if ((match = value.match(/^((?:[A-Z]{3}|[$Q€£])\s?.+) received$/))) return `${match[1]} recibido`;
    if ((match = value.match(/^((?:[A-Z]{3}|[$Q€£])\s?.+) in tax$/))) return `${match[1]} en impuestos`;
    if ((match = value.match(/^(\d+(?:\.\d+)?%) used$/))) return `${match[1]} utilizado`;
    if ((match = value.match(/^((?:[A-Z]{3}|[$Q€£])\s?.+) of ((?:[A-Z]{3}|[$Q€£])\s?.+)$/))) return `${match[1]} de ${match[2]}`;
    if ((match = value.match(/^(.+) holds the largest share at (\d+(?:\.\d+)?%)\. ((?:[A-Z]{3}|[$Q€£])\s?.+) remains available\.$/))) return `${t(match[1], 'es')} concentra la mayor parte con ${match[2]}. Quedan ${match[3]} disponibles.`;
    return null;
  };

  function t(value, language = get()) {
    if (normalize(language) !== 'es' || value == null) return String(value ?? '');
    const raw = String(value);
    const match = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const leading = match?.[1] || '';
    const trailing = match?.[3] || '';
    const core = (match?.[2] || raw).replace(/\s+/g, ' ');
    const translated = ES[core] || translateDynamic(core);
    return translated ? `${leading}${translated}${trailing}` : raw;
  }

  const isSkipped = (node) => {
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!element) return true;
    if (element.closest('[data-i18n-skip], [data-lumiere-generated], [data-project-content], [data-fs-page], [data-v5-cover], [contenteditable="true"]')) return true;
    const tag = element.tagName;
    return tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEMPLATE' || tag === 'TEXTAREA' || tag === 'X-DC';
  };

  const translateTextNode = (node, language) => {
    if (!node?.nodeValue || !node.nodeValue.trim() || isSkipped(node)) return;
    const current = node.nodeValue;
    const previousResult = lastText.get(node);
    if (!originalText.has(node) || current !== previousResult) originalText.set(node, current);
    const source = originalText.get(node);
    const result = language === 'es' ? t(source, 'es') : source;
    if (current !== result) node.nodeValue = result;
    lastText.set(node, result);
  };

  const translateElementAttributes = (element, language) => {
    if (!element?.getAttribute || isSkipped(element)) return;
    let originals = originalAttributes.get(element);
    let results = lastAttributes.get(element);
    if (!originals) { originals = {}; originalAttributes.set(element, originals); }
    if (!results) { results = {}; lastAttributes.set(element, results); }
    for (const attribute of ATTRIBUTES) {
      if (!element.hasAttribute(attribute)) continue;
      const current = element.getAttribute(attribute) || '';
      if (!(attribute in originals) || current !== results[attribute]) originals[attribute] = current;
      const result = language === 'es' ? t(originals[attribute], 'es') : originals[attribute];
      if (current !== result) element.setAttribute(attribute, result);
      results[attribute] = result;
    }
  };

  const walk = (root, language) => {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root, language);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) {
      translateElementAttributes(root, language);
      if (root.shadowRoot) {
        observeRoot(root.shadowRoot);
        walk(root.shadowRoot, language);
      }
      if (isSkipped(root)) return;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) translateTextNode(node, language);
      else {
        translateElementAttributes(node, language);
        if (node.shadowRoot) {
          observeRoot(node.shadowRoot);
          walk(node.shadowRoot, language);
        }
      }
    }
  };

  const refreshInjectedControls = () => {
    const language = get();
    document.querySelectorAll('[data-filmscript-language-settings]').forEach((item) => {
      const label = language === 'es' ? 'Idioma' : 'Language';
      const value = language === 'es' ? 'Español' : 'English';
      const ariaLabel = language === 'es' ? 'Abrir ajustes de idioma' : 'Open language settings';
      const labelNode = item.querySelector('[data-language-profile-label]');
      const valueNode = item.querySelector('[data-language-profile-value]');
      if (labelNode && labelNode.textContent !== label) labelNode.textContent = label;
      if (valueNode && valueNode.textContent !== value) valueNode.textContent = value;
      if (item.getAttribute('aria-label') !== ariaLabel) item.setAttribute('aria-label', ariaLabel);
    });
    const modal = document.getElementById(SETTINGS_ID);
    if (modal) renderSettings(modal);
  };

  const injectLanguageButtons = () => {
    // Language belongs to the profile menu. Remove legacy top-bar controls so
    // the editor chrome stays quiet and the setting has one predictable home.
    document.querySelectorAll('[data-filmscript-language-button]').forEach((button) => button.remove());
    refreshInjectedControls();
  };

  const injectProfileSettings = () => {
    document.querySelectorAll('[data-filmscript-profile-panel]').forEach((panel) => {
      if (panel.querySelector('[data-filmscript-language-settings]')) return;
      const item = document.createElement('div');
      item.dataset.filmscriptLanguageSettings = '1';
      item.setAttribute('role', 'button');
      item.tabIndex = 0;
      const menuItem = panel.querySelector('.fs-menuitem');
      if (menuItem) item.className = 'fs-menuitem';
      else {
        item.className = 'v5row';
        item.style.cssText = 'padding:8px 11px;font-size:12.5px;color:var(--ink,#2C2C2A);cursor:pointer;border-radius:8px;transition:box-shadow .13s ease;';
      }
      item.classList.add('fs-language-profile-item');
      item.setAttribute('aria-label', 'Open language settings');
      item.innerHTML = '<span data-language-profile-label data-i18n-skip>Language</span><small data-language-profile-value data-i18n-skip>English</small>';
      const signOut = panel.querySelector('[data-act="a-signout"]') || Array.from(panel.children).find((child) => /sign out|cerrar sesión/i.test(child.textContent || ''));
      panel.insertBefore(item, signOut || panel.lastElementChild);
    });
    refreshInjectedControls();
  };

  // Profile is a global control. It must never sit behind workspace controls
  // (for example the New script action) just because a page creates its own
  // stacking context. Keep the full profile layer above each workspace while
  // leaving ordinary modals above it when they are intentionally opened.
  const enforceProfileLayerPriority = () => {
    document.querySelectorAll('[data-testid="account-avatar"]').forEach((avatar) => {
      const host = avatar.parentElement;
      if (host) {
        host.dataset.filmscriptProfileHost = '1';
        host.style.position = host.style.position || 'relative';
        host.style.zIndex = '2147482000';
      }
      const topbar = avatar.closest?.('.v5-topbar, .fs-marketing-topbar, .fs-app-topbar');
      if (topbar) {
        topbar.dataset.filmscriptProfileLayer = '1';
        topbar.style.position = topbar.style.position || 'relative';
        topbar.style.zIndex = '2147482000';
      }
    });
    document.querySelectorAll('[data-filmscript-profile-panel]').forEach((panel) => {
      panel.style.zIndex = '2147482500';
    });
  };

  const modalFocusables = (modal) => [...modal.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => element.getClientRects().length);

  const inertLanguageModalSibling = (element, modal) => {
    if (!(element instanceof HTMLElement) || element === modal || element.inert) return;
    element.inert = true;
    modalInerted.push(element);
  };

  const lockLanguageModal = (modal) => {
    if (lockedLanguageModal) return false;
    lockedLanguageModal = modal;
    modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalInerted = [];
    [...document.body.children].forEach((element) => inertLanguageModalSibling(element, modal));
    // Language changes can remount global chrome (notably the mobile
    // navigation). Keep every new body sibling behind the active dialog inert
    // instead of relying on a one-time snapshot of the page.
    modalInertObserver = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((element) => inertLanguageModalSibling(element, modal)));
    });
    modalInertObserver.observe(document.body, { childList: true });
    modal.addEventListener('keydown', trapLanguageModalFocus);
    return true;
  };

  const unlockLanguageModal = (modal) => {
    if (lockedLanguageModal !== modal) return false;
    modalInertObserver?.disconnect();
    modalInertObserver = null;
    modal?.removeEventListener('keydown', trapLanguageModalFocus);
    modalInerted.forEach((element) => { element.inert = false; });
    modalInerted = [];
    if (modalReturnFocus?.isConnected) modalReturnFocus.focus({ preventScroll: true });
    modalReturnFocus = null;
    lockedLanguageModal = null;
    return true;
  };

  function trapLanguageModalFocus(event) {
    if (event.key !== 'Tab') return;
    const focusable = modalFocusables(event.currentTarget);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  const renderSettings = (modal) => {
    const language = get();
    const spanish = language === 'es';
    const setText = (selector, value) => { const node = modal.querySelector(selector); if (node && node.textContent !== value) node.textContent = value; };
    setText('[data-settings-eyebrow]', spanish ? 'FILMSCRIPT' : 'FILMSCRIPT');
    setText('[data-settings-title]', spanish ? 'Ajustes' : 'Settings');
    setText('[data-settings-copy]', spanish ? 'Personaliza cómo se siente FilmScript en tu cuenta.' : 'Personalize how FilmScript feels in your account.');
    setText('[data-settings-language-label]', spanish ? 'Idioma' : 'Language');
    setText('[data-settings-language-copy]', spanish ? 'Elige el idioma de la interfaz.' : 'Choose the interface language.');
    setText('[data-settings-warning-title]', spanish ? 'Importante' : 'Important');
    setText('[data-settings-warning-copy]', spanish
      ? 'La interfaz cambia de inmediato. Tus guiones y el trabajo que Lumiere ya generó permanecen en su idioma original.'
      : 'The interface updates immediately. Your screenplays and work already generated by Lumiere remain in their original language.');
    setText('[data-settings-helper]', spanish ? 'Los cambios se aplican de inmediato en todo FilmScript.' : 'Changes apply across FilmScript immediately.');
    const close = modal.querySelector('[data-settings-close]');
    const closeLabel = spanish ? 'Cerrar ajustes' : 'Close settings';
    if (close && close.getAttribute('aria-label') !== closeLabel) close.setAttribute('aria-label', closeLabel);
    modal.querySelectorAll('[data-language-option]').forEach((option) => {
      const active = option.dataset.languageOption === language;
      if (option.getAttribute('aria-pressed') !== String(active)) option.setAttribute('aria-pressed', String(active));
      option.classList.toggle('is-active', active);
      const check = option.querySelector('.fs-language-check');
      if (check && check.textContent !== (active ? '✓' : '')) check.textContent = active ? '✓' : '';
    });
  };

  const ensureSettings = () => {
    let modal = document.getElementById(SETTINGS_ID);
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = SETTINGS_ID;
    modal.className = 'fs-language-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="fs-language-backdrop" data-settings-dismiss></div>
      <section class="fs-language-sheet" role="dialog" aria-modal="true" aria-labelledby="fs-language-title" aria-describedby="fs-language-settings-warning">
        <button type="button" class="fs-language-close" data-settings-close aria-label="Close settings">×</button>
        <div class="fs-language-eyebrow" data-settings-eyebrow>FILMSCRIPT</div>
        <h2 id="fs-language-title" data-settings-title>Settings</h2>
        <p class="fs-language-intro" data-settings-copy>Personalize how FilmScript feels in your account.</p>
        <div class="fs-language-rule" aria-hidden="true"></div>
        <div class="fs-language-section-title" data-settings-language-label>Language</div>
        <p class="fs-language-section-copy" data-settings-language-copy>Choose the interface language.</p>
        <div class="fs-language-options" role="group" aria-label="Language">
          <button type="button" class="fs-language-option" data-language-option="en" data-i18n-skip aria-pressed="false"><span><strong>English</strong></span><i class="fs-language-check" aria-hidden="true"></i></button>
          <button type="button" class="fs-language-option" data-language-option="es" data-i18n-skip aria-pressed="false"><span><strong>Español</strong></span><i class="fs-language-check" aria-hidden="true"></i></button>
        </div>
        <div class="fs-language-warning" id="fs-language-settings-warning" role="note"><span aria-hidden="true">!</span><p><strong data-settings-warning-title>Important</strong><small data-settings-warning-copy>The interface updates immediately. Your screenplays and work already generated by Lumiere remain in their original language.</small></p></div>
        <p class="fs-language-helper" data-settings-helper>Changes apply across FilmScript immediately.</p>
        <p class="fs-language-status" data-language-status role="status" aria-live="polite"></p>
      </section>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => {
      const option = event.target.closest('[data-language-option]');
      if (option) { saveLanguage(option.dataset.languageOption, modal); return; }
      if (event.target.closest('[data-settings-close], [data-settings-dismiss]')) closeSettings();
    });
    renderSettings(modal);
    return modal;
  };

  const ensureInitialChoice = () => {
    let modal = document.getElementById(INITIAL_CHOICE_ID);
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = INITIAL_CHOICE_ID;
    modal.className = 'fs-language-modal fs-language-initial-choice';
    modal.setAttribute('data-i18n-skip', '');
    modal.hidden = true;
    modal.innerHTML = `
      <div class="fs-language-backdrop"></div>
      <section class="fs-language-sheet" role="dialog" aria-modal="true" aria-labelledby="fs-language-initial-title" aria-describedby="fs-language-initial-copy fs-language-initial-warning">
        <div class="fs-language-eyebrow">FILMSCRIPT</div>
        <h2 id="fs-language-initial-title">Choose your language<br><span>Elige tu idioma</span></h2>
        <p class="fs-language-intro" id="fs-language-initial-copy">Choose the language you want to use across FilmScript.<br>Elige el idioma que quieres usar en FilmScript.</p>
        <div class="fs-language-rule" aria-hidden="true"></div>
        <div class="fs-language-options" role="group" aria-label="Choose your language / Elige tu idioma">
          <button type="button" class="fs-language-option" data-initial-language-option="en" aria-label="Choose English"><span><strong>English</strong><small>Use FilmScript in English</small></span><i class="fs-language-arrow" aria-hidden="true">→</i></button>
          <button type="button" class="fs-language-option" data-initial-language-option="es" aria-label="Elegir Español"><span><strong>Español</strong><small>Usa FilmScript en español</small></span><i class="fs-language-arrow" aria-hidden="true">→</i></button>
        </div>
        <div class="fs-language-warning fs-language-warning--bilingual" id="fs-language-initial-warning" role="note"><span aria-hidden="true">!</span><p><strong>IMPORTANT · IMPORTANTE</strong><small>Changing FilmScript’s language later will not translate work already generated by Lumiere.<br>Cambiar después el idioma de FilmScript no traducirá el trabajo que Lumiere ya haya generado.</small></p></div>
        <p class="fs-language-helper">You can change this later from your profile settings.<br>Puedes cambiarlo después desde los ajustes de tu perfil.</p>
        <p class="fs-language-status" data-language-status role="status" aria-live="polite"></p>
      </section>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => {
      const option = event.target.closest('[data-initial-language-option]');
      if (!option) return;
      saveLanguage(option.dataset.initialLanguageOption, modal, { initial: true });
    });
    return modal;
  };

  const isInitialChoiceOpen = () => {
    const modal = document.getElementById(INITIAL_CHOICE_ID);
    return Boolean(modal && !modal.hidden);
  };

  const openInitialChoice = () => {
    if (!shouldOfferInitialChoice()) return false;
    const modal = ensureInitialChoice();
    if (!modal.hidden) {
      window.setTimeout(() => modal.querySelector('[data-initial-language-option="en"]')?.focus(), 0);
      return true;
    }
    if (lockedLanguageModal || !lockLanguageModal(modal)) return false;
    modal.hidden = false;
    document.documentElement.classList.add('fs-language-open');
    window.setTimeout(() => modal.querySelector('[data-initial-language-option="en"]')?.focus(), 20);
    return true;
  };

  const closeInitialChoice = () => {
    const modal = document.getElementById(INITIAL_CHOICE_ID);
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.documentElement.classList.remove('fs-language-open');
    unlockLanguageModal(modal);
  };

  const openSettings = () => {
    const modal = ensureSettings();
    renderSettings(modal);
    if (!modal.hidden) {
      window.setTimeout(() => modal.querySelector(`[data-language-option="${get()}"]`)?.focus(), 0);
      return true;
    }
    if (lockedLanguageModal || !lockLanguageModal(modal)) return false;
    modal.hidden = false;
    document.documentElement.classList.add('fs-language-open');
    window.setTimeout(() => modal.querySelector(`[data-language-option="${get()}"]`)?.focus(), 20);
    return true;
  };

  const closeSettings = () => {
    const modal = document.getElementById(SETTINGS_ID);
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.documentElement.classList.remove('fs-language-open');
    unlockLanguageModal(modal);
  };

  const apply = (language = get(), root = document) => {
    const next = normalize(language);
    document.documentElement.lang = next;
    document.documentElement.setAttribute('data-filmscript-language', next);
    walk(root, next);
    injectLanguageButtons();
    injectProfileSettings();
    enforceProfileLayerPriority();
    refreshInjectedControls();
    return next;
  };

  const set = (language, { persist = true } = {}) => {
    const next = normalize(language);
    accountState.language = accountState.id ? next : accountState.language;
    try {
      localStorage.setItem(STORAGE_KEY, next);
      if (accountState.id) localStorage.setItem(accountStorageKey(accountState.id), next);
    } catch (error) {}
    apply(next);
    window.dispatchEvent(new CustomEvent('filmscript:language-change', { detail: { language: next } }));
    if (persist && accountState.id) persistAccountLanguage(next).catch(() => {});
    return next;
  };

  const persistAccountLanguage = async (language) => {
    if (!accountState.id || !window.filmscriptBilling?.updateProfile) return null;
    const next = normalize(language);
    accountState.saving = true;
    try {
      const account = await window.filmscriptBilling.updateProfile({ interfaceLanguage: next });
      const saved = supportedLanguage(account?.interfaceLanguage) || supportedLanguage(account?.profile?.interfaceLanguage) || next;
      accountState.language = saved;
      try {
        localStorage.setItem(STORAGE_KEY, saved);
        localStorage.setItem(accountStorageKey(accountState.id), saved);
      } catch (error) {}
      return account;
    } finally {
      accountState.saving = false;
    }
  };

  const languageStatus = (modal, message, error = false) => {
    const node = modal?.querySelector('[data-language-status]');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('is-error', error);
  };

  const saveLanguage = async (language, modal, { initial = false } = {}) => {
    if (accountState.saving) return;
    const next = set(language, { persist: false });
    modal?.querySelectorAll('button').forEach((button) => { button.disabled = true; });
    languageStatus(modal, next === 'es' ? 'Guardando el idioma de tu cuenta…' : 'Saving your account language…');
    try {
      await persistAccountLanguage(next);
      if (initial) {
        closeInitialChoice();
        window.dispatchEvent(new CustomEvent('filmscript:initial-language-choice', { detail: { language: next } }));
      } else {
        renderSettings(modal);
        languageStatus(modal, next === 'es'
          ? 'Interfaz cambiada a español. El trabajo existente de Lumiere no se tradujo.'
          : 'Interface changed to English. Existing Lumiere work was not translated.');
      }
    } catch (error) {
      languageStatus(modal, next === 'es'
        ? 'No se pudo guardar el idioma. Inténtalo de nuevo.'
        : 'The language could not be saved. Try again.', true);
    } finally {
      modal?.querySelectorAll('button').forEach((button) => { button.disabled = false; });
    }
  };

  const hydrateAccount = async (account) => {
    const id = String(account?.id || '').trim();
    if (!account?.authenticated || !id) return false;
    accountState.id = id;
    accountState.hydrated = true;
    const serverLanguage = supportedLanguage(account?.interfaceLanguage) || supportedLanguage(account?.profile?.interfaceLanguage);
    let cachedLanguage = null;
    try { cachedLanguage = supportedLanguage(localStorage.getItem(accountStorageKey(id))); } catch (error) {}
    accountState.language = serverLanguage || cachedLanguage || null;
    if (accountState.language) {
      set(accountState.language, { persist: false });
      if (!serverLanguage && cachedLanguage) persistAccountLanguage(cachedLanguage).catch(() => {});
    }
    window.dispatchEvent(new CustomEvent('filmscript:language-account-hydrated', {
      detail: { accountId: id, language: accountState.language },
    }));
    return true;
  };

  function observeRoot(root) {
    if (!root || observedRoots.has(root)) return;
    observedRoots.add(root);
    const observer = new MutationObserver((records) => {
      const language = get();
      for (const record of records) {
        if (record.type === 'characterData') translateTextNode(record.target, language);
        if (record.type === 'attributes') translateElementAttributes(record.target, language);
        record.addedNodes?.forEach((node) => walk(node, language));
      }
      injectLanguageButtons();
      injectProfileSettings();
      enforceProfileLayerPriority();
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES });
  }

  const installStyles = () => {
    if (document.getElementById('filmscript-language-styles')) return;
    const style = document.createElement('style');
    style.id = 'filmscript-language-styles';
    style.textContent = `
      .fs-language-modal,.fs-language-modal *{font-family:"SF Pro Text",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif!important}.fs-language-modal h1,.fs-language-modal h2,.fs-language-modal h3{font-family:"SF Pro Display","SF Pro Text",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif!important;font-weight:800!important}
      .fs-language-profile-item{display:flex!important;align-items:center;justify-content:space-between;gap:16px;min-height:34px}.fs-language-profile-item small{color:var(--muted,#888780);font:500 10.5px/1 "Helvetica Neue",Helvetica,Arial,sans-serif;letter-spacing:.15px}.fs-language-profile-item:hover small{color:var(--accent,#BA7517)}
      .fs-language-profile-item:focus-visible,.fs-language-option:focus-visible,.fs-language-close:focus-visible{outline:2px solid #BA7517;outline-offset:2px}
      /* The profile menu belongs above every workspace action on every FilmScript page. */
      .fs-app-topbar,.fs-marketing-topbar,.v5-topbar,[data-filmscript-profile-layer="1"]{position:relative;z-index:2147482000!important;isolation:isolate}
      [data-filmscript-profile-host="1"]{position:relative;z-index:2147482000!important}
      [data-filmscript-profile-panel]{z-index:2147482500!important}
      [data-testid="account-details-overlay"]{z-index:2147483000!important}
      .fs-language-modal[hidden]{display:none!important}.fs-language-modal{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:24px;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif}.fs-language-backdrop{position:absolute;inset:0;background:rgba(20,20,18,.34);backdrop-filter:blur(30px) saturate(1.3);-webkit-backdrop-filter:blur(30px) saturate(1.3);animation:fsLanguageFade .16s ease both}.fs-language-sheet{--fs-lang-bg:#FFFEF9;--fs-lang-ink:#242421;--fs-lang-muted:#6d6b64;--fs-lang-line:rgba(36,36,33,.28);position:relative;width:min(480px,calc(100vw - 32px));max-height:calc(100dvh - 40px);overflow:auto;box-sizing:border-box;padding:30px;background:linear-gradient(145deg,color-mix(in srgb,var(--fs-lang-bg) 82%,transparent),color-mix(in srgb,var(--fs-lang-bg) 68%,transparent));color:var(--fs-lang-ink);border:1px solid color-mix(in srgb,var(--fs-lang-ink) 17%,rgba(255,255,255,.68));border-radius:24px;box-shadow:inset 0 1px 0 rgba(255,255,255,.72),0 26px 90px rgba(0,0,0,.28);backdrop-filter:blur(42px) saturate(1.6);-webkit-backdrop-filter:blur(42px) saturate(1.6);animation:fsLanguageRise .2s cubic-bezier(.2,.8,.2,1) both}.fs-language-sheet:after{content:"";position:absolute;pointer-events:none;inset:4px;border:1px solid color-mix(in srgb,var(--fs-lang-ink) 10%,transparent);border-radius:20px;opacity:.55}
      :root[data-filmscript-theme="dark"] .fs-language-sheet{--fs-lang-bg:#242422;--fs-lang-ink:#F0EEE7;--fs-lang-muted:#b6b3aa;--fs-lang-line:rgba(240,238,231,.3)}
      .fs-language-sheet>*{position:relative;z-index:1}.fs-language-close{position:absolute;z-index:3;right:17px;top:15px;width:44px;height:44px;border:0;border-radius:50%;background:color-mix(in srgb,var(--fs-lang-bg) 42%,transparent);color:var(--fs-lang-muted);font:300 24px/1 sans-serif;cursor:pointer;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);transition:background-color .15s ease,color .15s ease,transform .15s ease}.fs-language-close:hover{background:color-mix(in srgb,var(--fs-lang-ink) 8%,transparent);color:var(--fs-lang-ink);transform:scale(1.03)}.fs-language-eyebrow{font-size:10px;font-weight:750;letter-spacing:1.7px;color:#BA7517}.fs-language-sheet h2{margin:8px 0 0;font-size:28px;line-height:1.08;letter-spacing:-.75px}.fs-language-initial-choice .fs-language-sheet h2 span{font-size:.64em;font-weight:500;letter-spacing:-.2px;color:var(--fs-lang-muted)}.fs-language-intro{margin:9px 48px 0 0;color:var(--fs-lang-muted);font-size:13px;line-height:1.5}.fs-language-rule{width:100%;height:1px;margin:22px 0 20px;background:color-mix(in srgb,var(--fs-lang-ink) 14%,transparent)}.fs-language-section-title{font-size:14px;font-weight:700}.fs-language-section-copy{margin:5px 0 0;color:var(--fs-lang-muted);font-size:12px;line-height:1.5}.fs-language-options{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.fs-language-option{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:70px;padding:12px 13px;border:1px solid color-mix(in srgb,var(--fs-lang-ink) 20%,transparent);border-radius:16px;background:color-mix(in srgb,var(--fs-lang-bg) 48%,transparent);color:var(--fs-lang-ink);text-align:left;cursor:pointer;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);transition:transform .16s cubic-bezier(.2,.8,.2,1),border-color .16s ease,background-color .16s ease}.fs-language-option:hover{transform:translateY(-1px);border-color:color-mix(in srgb,#BA7517 66%,var(--fs-lang-line))}.fs-language-option.is-active{border-color:#BA7517;background:color-mix(in srgb,#BA7517 12%,var(--fs-lang-bg) 52%)}.fs-language-option:disabled{opacity:.62;cursor:wait;transform:none}.fs-language-option span,.fs-language-option strong,.fs-language-option small{display:block}.fs-language-option strong{font-size:13px}.fs-language-option small{margin-top:4px;color:var(--fs-lang-muted);font-size:10.5px}.fs-language-arrow{font-style:normal;color:#BA7517;font-size:18px;transition:transform .16s ease}.fs-language-option:hover .fs-language-arrow{transform:translateX(3px)}.fs-language-check{display:grid;place-items:center;width:22px;height:22px;flex:0 0 22px;border:1px solid color-mix(in srgb,var(--fs-lang-ink) 24%,transparent);border-radius:50%;color:#BA7517;font:800 12px/1 sans-serif}.fs-language-option.is-active .fs-language-check{border-color:#BA7517}.fs-language-warning{display:grid;grid-template-columns:28px minmax(0,1fr);gap:11px;margin-top:16px;padding:12px 13px;border:1px solid color-mix(in srgb,#c9483d 58%,transparent);border-radius:15px;background:color-mix(in srgb,#c9483d 9%,var(--fs-lang-bg) 42%);color:var(--fs-lang-ink)}.fs-language-warning>span{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:#c9483d;color:#fff;font-size:12px;font-weight:800}.fs-language-warning p{margin:0}.fs-language-warning strong,.fs-language-warning small{display:block}.fs-language-warning strong{color:#b63e35;font-size:10px;letter-spacing:.8px;text-transform:uppercase}.fs-language-warning small{margin-top:4px;color:var(--fs-lang-muted);font-size:10.5px;line-height:1.45}.fs-language-helper{margin:14px 0 0;color:var(--fs-lang-muted);font-size:10.5px;line-height:1.45}.fs-language-status{min-height:16px;margin:8px 0 0;color:var(--fs-lang-muted);font-size:10.5px;line-height:1.35}.fs-language-status.is-error{color:#b63e35}.fs-language-open{overflow:hidden}@keyframes fsLanguageFade{from{opacity:0}to{opacity:1}}@keyframes fsLanguageRise{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}@media(max-width:520px){.fs-language-modal{padding:12px;align-items:end}.fs-language-sheet{max-height:calc(100dvh - 24px);padding:25px 20px calc(22px + env(safe-area-inset-bottom));border-radius:24px}.fs-language-options{grid-template-columns:1fr}}@media(prefers-reduced-transparency:reduce){.fs-language-backdrop{background:rgba(20,20,18,.78);backdrop-filter:none;-webkit-backdrop-filter:none}.fs-language-sheet,.fs-language-option,.fs-language-close{background:var(--fs-lang-bg);backdrop-filter:none;-webkit-backdrop-filter:none}}@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.fs-language-sheet,.fs-language-option,.fs-language-close{background:var(--fs-lang-bg)}}@media(prefers-reduced-motion:reduce){.fs-language-backdrop,.fs-language-sheet,.fs-language-quick,.fs-language-option,.fs-language-close{animation-duration:.01ms!important;transition-duration:.01ms!important}}
    `;
    document.head.appendChild(style);
  };

  const install = () => {
    installStyles();
    observeRoot(document.documentElement);
    apply(get());
    document.addEventListener('click', (event) => {
      const settings = event.target.closest?.('[data-filmscript-language-settings]');
      if (!settings) return;
      event.preventDefault();
      event.stopPropagation();
      // Language has its own gentle cue so opening this setting feels distinct
      // from navigating the rest of the profile menu.
      window.filmscriptSounds?.play?.('languageSelect');
      openSettings();
    }, true);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (isInitialChoiceOpen()) return;
        closeSettings();
      }
      if ((event.key === 'Enter' || event.key === ' ') && event.target.closest?.('[data-filmscript-language-settings]')) {
        event.preventDefault();
        openSettings();
      }
    });
    const offerAfterProfile = () => {
      if (!shouldOfferInitialChoice()) return;
      if (document.querySelector('.fs-profile-onboarding')) return;
      window.setTimeout(openInitialChoice, 40);
    };
    window.addEventListener('filmscript:profile-onboarding-resolved', offerAfterProfile);
    window.addEventListener('filmscript:language-account-hydrated', () => {
      if (!window.filmscriptProfileOnboarding?.isPending?.()) offerAfterProfile();
    });
  };

  document.documentElement.lang = get();
  document.documentElement.setAttribute('data-filmscript-language', get());
  window.filmscriptLanguage = Object.freeze({
    key: STORAGE_KEY,
    get,
    hasStoredLanguage,
    needsInitialChoice: shouldOfferInitialChoice,
    isAccountHydrated: () => accountState.hydrated,
    set,
    t,
    apply,
    openSettings,
    closeSettings,
    openInitialChoice,
    closeInitialChoice,
    hydrateAccount,
    languages: Object.freeze(['en', 'es']),
  });

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || (accountState.id && event.key === accountStorageKey(accountState.id))) apply(get());
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
