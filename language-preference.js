// Shared, persistent FilmScript interface-language preference.
// Screenplay text, imported documents, script titles and saved conversations are
// deliberately excluded: changing the interface language must never rewrite art.
(() => {
  'use strict';

  const STORAGE_KEY = 'filmscript_language';
  const SETTINGS_ID = 'filmscript-language-settings';
  const INITIAL_CHOICE_ID = 'filmscript-language-initial-choice';
  const SUPPORTED = new Set(['en', 'es']);
  const originalText = new WeakMap();
  const lastText = new WeakMap();
  const originalAttributes = new WeakMap();
  const lastAttributes = new WeakMap();
  const observedRoots = new WeakSet();
  const ATTRIBUTES = ['placeholder', 'title', 'aria-label'];

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
    'Sign out': 'Cerrar sesión',
    'Account details': 'Detalles de la cuenta',
    'Personalize Lumiere': 'Personalizar Lumiere',
    'Directors, films and the kind of feedback that serves your voice.': 'Directores, películas y el tipo de feedback que fortalece tu voz.',
    'My scripts': 'Mis guiones',
    'Plan and billing': 'Plan y facturación',
    'Terms & conditions': 'Términos y condiciones',
    'Upgrade to FilmScript Pro': 'Mejorar a FilmScript Pro',
    'FilmScript Basic': 'FilmScript Basic',
    'FilmScript Pro': 'FilmScript Pro',
    'Choose a plan': 'Elegir un plan',
    'Choose Basic': 'Elegir Basic',
    'Choose Pro': 'Elegir Pro',
    'Start for free': 'Empezar gratis',
    'Choose FilmScript Pro': 'Elegir FilmScript Pro',
    'Choose FilmScript Pro →': 'Elegir FilmScript Pro →',
    'View FilmScript Pro': 'Ver FilmScript Pro',
    'View FilmScript Pro · $19.99 / month': 'Ver FilmScript Pro · $19.99 / mes',
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
    'Manage or cancel FilmScript Pro from the profile menu.': 'Administra o cancela FilmScript Pro desde el menú de perfil.',
    'Your writing stays yours.': 'Tu escritura sigue siendo tuya.',
    'You retain ownership of scripts and notes created in FilmScript.': 'Conservas la propiedad de los guiones y notas creados en FilmScript.',
    'You retain ownership of scripts, notes, and material created in FilmScript. We do not sell your writing.': 'Conservas la propiedad de los guiones, notas y material creado en FilmScript. No vendemos tu escritura.',
    'Lumiere is an assistant.': 'Lumiere es un asistente.',
    'It offers suggestions and analysis. You decide what belongs in your work.': 'Ofrece sugerencias y análisis. Tú decides qué pertenece a tu obra.',
    'Lumiere credits and usage limits.': 'Créditos y límites de uso de Lumiere.',
    'FilmScript Pro includes 100 Lumiere credits per monthly billing period. AI actions may use different amounts depending on the size and complexity of the request. Credits reset with each monthly renewal, do not roll over, and have no cash value. When credits run out, new Lumiere generations pause until the next reset; your scripts and existing production documents stay available. Free and Basic plans include no Lumiere credits.': 'FilmScript Pro incluye 100 créditos de Lumiere por cada periodo mensual de facturación. Las acciones de IA pueden usar cantidades distintas según el tamaño y la complejidad de la solicitud. Los créditos se reinician con cada renovación mensual, no se acumulan y no tienen valor en efectivo. Cuando se agotan, las nuevas generaciones de Lumiere se pausan hasta el siguiente reinicio; tus guiones y documentos de producción existentes siguen disponibles. Los planes Free y Basic no incluyen créditos de Lumiere.',
    'FilmScript Pro includes 100 Lumiere credits per monthly billing period. A rolling 8-hour session allows 20 credits and each week allows 60; both windows reset automatically. Credits reset with each monthly renewal, do not roll over, and have no cash value. When a window or the monthly allowance is reached, you can wait for its reset or purchase 20 extra credits for $5. Your scripts and existing production documents stay available. Free and Basic plans include no Lumiere credits.': 'FilmScript Pro incluye 100 créditos de Lumiere por cada periodo mensual de facturación. Una sesión continua de 8 horas permite 20 créditos y cada semana permite 60; ambas ventanas se reinician automáticamente. Los créditos mensuales no se acumulan ni tienen valor en efectivo. Cuando se alcanza una ventana o el límite mensual, puedes esperar su reinicio o comprar 20 créditos extra por $5. Tus guiones y documentos de producción existentes siguen disponibles. Los planes Free y Basic no incluyen créditos de Lumiere.',
    'FilmScript Pro includes 100 Lumiere credits per monthly billing period. A rolling 8-hour session allows 20 credits and each week allows 60; both windows reset automatically. Credits reset with each monthly renewal, do not roll over, and have no cash value. When a window or the monthly allowance is reached, new Lumiere generations pause until the next reset; you can wait for its reset or purchase 80 extra credits for $5. Your scripts and existing production documents stay available. Free and Basic plans include no Lumiere credits.': 'FilmScript Pro incluye 100 créditos de Lumiere por cada periodo mensual de facturación. Una sesión continua de 8 horas permite 20 créditos y cada semana permite 60; ambas ventanas se reinician automáticamente. Los créditos mensuales no se acumulan ni tienen valor en efectivo. Cuando se alcanza una ventana o el límite mensual, las nuevas generaciones de Lumiere se pausan hasta el siguiente reinicio; puedes esperar su reinicio o comprar 80 créditos extra por $5. Tus guiones y documentos de producción existentes siguen disponibles. Los planes Free y Basic no incluyen créditos de Lumiere.',
    'Lumiere offers editorial suggestions and analysis. You decide what belongs in your work and remain responsible for the final text.': 'Lumiere ofrece sugerencias editoriales y análisis. Tú decides qué pertenece a tu obra y sigues siendo responsable del texto final.',
    'Too inspired to wait until tomorrow?': '¿Demasiado inspirado para esperar hasta mañana?',
    'Reset your Lumiere limits for $5 and keep going.': 'Restablece tus límites de Lumiere por $5 y sigue adelante.',
    'Buy 20 extra Lumiere credits for $5 and keep going.': 'Compra 20 créditos extra de Lumiere por $5 y sigue adelante.',
    'Reset your Lumiere limits for $5 and keep going. Buy 80 extra credits for the next stretch.': 'Restablece tus límites de Lumiere por $5 y sigue adelante. Compra 80 créditos extra para continuar.',
    'Reset limits for $5': 'Restablecer límites por $5',
    'Buy extra credits · $5': 'Comprar créditos extra · $5',
    'Opening reset…': 'Abriendo recarga…',
    'Opening top-up…': 'Abriendo recarga…',
    'Lumiere credits are empty. Reset your limits for $5 to keep going.': 'Tus créditos de Lumiere se agotaron. Restablece tus límites por $5 para continuar.',
    'Could not open the credit reset checkout.': 'No se pudo abrir el pago para restablecer los créditos.',
    'Could not verify the credit reset yet.': 'Aún no se pudo verificar el reinicio de créditos.',
    'Payment received. Your reset is being verified.': 'Pago recibido. Estamos verificando tu reinicio.',
    'Lumiere limits reset. Keep creating.': 'Límites de Lumiere restablecidos. Sigue creando.',
    'Extra Lumiere credits added. Keep creating.': 'Créditos extra de Lumiere añadidos. Sigue creando.',
    'Payment received. Your extra credits are being verified.': 'Pago recibido. Estamos verificando tus créditos extra.',
    'Lumiere usage': 'Uso de Lumiere',
    'Session · 8h': 'Sesión · 8 h',
    'This week': 'Esta semana',
    'This month': 'Este mes',
    'Starts on first use': 'Comienza al usar Lumiere',
    'Subscriptions.': 'Suscripciones.',
    'FilmScript Pro subscriptions.': 'Suscripciones de FilmScript Pro.',
    'Paid plans renew monthly through Recurrente and can be canceled from your account menu.': 'Los planes de pago se renuevan mensualmente mediante Recurrente y se pueden cancelar desde el menú de tu cuenta.',
    'FilmScript Pro renews monthly through Recurrente. You can cancel from your account menu. Access remains available according to the payment provider’s confirmed subscription status.': 'FilmScript Pro se renueva mensualmente mediante Recurrente. Puedes cancelarlo desde el menú de tu cuenta. El acceso permanece disponible según el estado de suscripción confirmado por el proveedor de pago.',
    'Fair use.': 'Uso responsable.',
    'Use FilmScript only with material you have permission to use.': 'Usa FilmScript únicamente con material para el que tengas permiso.',
    'Do not use FilmScript to upload material you do not have permission to use, or to interfere with the service or other writers.': 'No uses FilmScript para subir material que no tengas permiso de utilizar ni para interferir con el servicio u otros escritores.',
    'Questions?': '¿Preguntas?',
    'Contact support if you need help with your account, billing, or your writing workspace.': 'Contacta a soporte si necesitas ayuda con tu cuenta, facturación o espacio de escritura.',
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
    'PDF or .fs, the FilmScript text format.': 'PDF o .fs, el formato de texto de FilmScript.',
    'Your scripts': 'Tus guiones',
    'Search scripts': 'Buscar guiones',
    'Script options': 'Opciones del guion',
    'Delete script': 'Eliminar guion',
    'Opening screenplay': 'Abriendo guion',
    'Untitled screenplay': 'Guion sin título',
    'Imported screenplay': 'Guion importado',
    'No scripts match': 'Ningún guion coincide',
    'That PDF keeps its text locked away. Export it as .fs or plain text and try again.': 'Ese PDF mantiene el texto bloqueado. Expórtalo como .fs o texto plano e inténtalo de nuevo.',
    'Could not read that file. Try a .fs or plain text export.': 'No se pudo leer ese archivo. Prueba con una exportación .fs o de texto plano.',
    'Could not open that imported script.': 'No se pudo abrir ese guion importado.',
    'Open an imported screenplay before starting preproduction.': 'Abre un guion importado antes de iniciar la preproducción.',
    'Could not delete that script. Please try again.': 'No se pudo eliminar ese guion. Inténtalo de nuevo.',
    'Still awake, writer.': '¿Aún despierto, guionista?',
    'Inspiration at this hour comes from the shower, one last movie, or a TikTok spiral that got out of hand. Write it down before it escapes.': 'A esta hora la inspiración llega en la ducha, con una última película o en una espiral de TikTok que se salió de control. Escríbela antes de que escape.',
    'Up before the sun.': 'Despierto antes que el sol.',
    'Coffee first, then pages. Build your next scene at your own pace.': 'Primero café, luego páginas. Construye tu siguiente escena a tu ritmo.',
    'Good morning, writer.': 'Buenos días, guionista.',
    'Fresh coffee, fresh pages. Your characters slept even less than you did.': 'Café fresco, páginas nuevas. Tus personajes durmieron aún menos que tú.',
    'Good afternoon, writer.': 'Buenas tardes, guionista.',
    'A perfect hour for second acts. Lunch can wait, the midpoint cannot.': 'El café ya hizo su parte. Ahora toca rescatar ese segundo acto antes de que pida vacaciones.',
    'The light is turning golden. A fine moment to fix that third act.': 'La tarde está dorada y ese tercer acto sigue pidiendo auxilio. Vamos a darle una vuelta.',
    'Good evening, writer.': 'Buenas noches, guionista.',
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
    'Your existing insights and exports remain available. FilmScript Pro is required only for a new Lumiere reading.': 'Tus análisis y exportaciones existentes siguen disponibles. FilmScript Pro solo es necesario para una nueva lectura de Lumiere.',
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
    'Lumiere credits are empty. Reset your limits for $5 to continue.': 'Los créditos de Lumiere están agotados. Restablece tus límites por $5 para continuar.',
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
    'FilmScript Pro is required for new Lumiere story structure analysis.': 'Se requiere FilmScript Pro para generar un nuevo análisis de estructura narrativa con Lumiere.',
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
    'FilmScript Pro at $19.99 / month is required to use Lumiere. Your scripts and manual production work remain available to edit and export.': 'Se requiere FilmScript Pro de $19.99 / mes para usar Lumiere. Tus guiones y trabajo manual de producción siguen disponibles para editar y exportar.',
    'Lumiere requires FilmScript Pro': 'Lumiere requiere FilmScript Pro',
    'Your screenplay and existing production documents remain available to edit and export. An active plan is required only to generate new work with Lumiere.': 'Tu guion y los documentos de producción existentes siguen disponibles para editar y exportar. Solo se requiere un plan activo para generar trabajo nuevo con Lumiere.',
    'Your screenplay and every existing breakdown, stripboard, shot list, and budget remain available to edit and export. An active plan is required only to generate new work with Lumiere.': 'Tu guion y todos los desgloses, planes de rodaje, listas de planos y presupuestos existentes siguen disponibles para editar y exportar. Solo se requiere un plan activo para generar trabajo nuevo con Lumiere.',
    'Canceling never deletes your scripts or existing production documents.': 'Cancelar nunca elimina tus guiones ni los documentos de producción existentes.',
    'Canceling never deletes your existing production documents.': 'Cancelar nunca elimina tus documentos de producción existentes.',
    'Free · Lumiere unavailable': 'Gratis · Lumiere no disponible',
    'FilmScript Pro required': 'Se requiere FilmScript Pro',
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
    'FilmScript Pro inactive': 'FilmScript Pro inactivo',
    'Your existing production work stays yours.': 'Tu trabajo de producción existente sigue siendo tuyo.',
    'Keep editing and exporting existing breakdowns, stripboards, shot lists, and budgets. An active plan is required only to generate new work with Lumiere.': 'Sigue editando y exportando desgloses, planes de rodaje, listas de planos y presupuestos existentes. Solo se requiere un plan activo para generar trabajo nuevo con Lumiere.',
    'Keep editing and exporting existing breakdowns, stripboards, shot lists, budgets, and calendars. An active plan is required only to generate new work with Lumiere.': 'Sigue editando y exportando desgloses, planes de rodaje, listas de planos, presupuestos y calendarios existentes. Solo se requiere un plan activo para generar trabajo nuevo con Lumiere.',
    'Keep editing existing breakdowns, stripboards, shot lists, budgets, and calendars, with exports where available. An active plan is required only to generate new work with Lumiere.': 'Sigue editando tus desgloses, planes de rodaje, listas de planos, presupuestos y calendarios existentes, con exportaciones donde estén disponibles. Solo se requiere un plan activo para generar trabajo nuevo con Lumiere.',
    'Keep editing and exporting existing documents. FilmScript Pro is required only for new Lumiere generation.': 'Sigue editando y exportando documentos existentes. FilmScript Pro solo es necesario para generar contenido nuevo con Lumiere.',
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
    'FilmScript Pro required': 'Se requiere FilmScript Pro',
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
    'INT DAY': 'INT DÍA',
    'EXT DAY': 'EXT DÍA',
    'INT NIGHT': 'INT NOCHE',
    'EXT NIGHT': 'EXT NOCHE',
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

    // Marketing / Features.
    'Write the script. FilmScript handles the rest.': 'Escribe el guion. FilmScript se encarga del resto.',
    'A professional screenplay editor with an AI companion named Lumiere. Write your pages, then turn them into breakdowns, stripboards and shot lists. All text, all yours.': 'Un editor profesional de guion con un compañero de IA llamado Lumiere. Escribe tus páginas y conviértelas en desgloses, planes de rodaje y listas de planos. Todo el texto, completamente tuyo.',
    'Start writing': 'Empezar a escribir',
    'See pricing': 'Ver precios',
    'Start writing with FilmScript Pro · $19.99/month': 'Empieza a escribir con FilmScript Pro · $19.99/mes',
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
    'Yes. Add or drop Lumiere any time from your account menu. Changes apply right away.': 'Sí. Activa o desactiva Lumiere cuando quieras desde el menú de tu cuenta. Los cambios se aplican de inmediato.',
    'What do my pages export to?': '¿En qué formato se exportan mis páginas?',
    'Industry standard PDF, WGA checked, ready to send the moment you finish.': 'PDF estándar de la industria, revisado según WGA y listo para enviar al terminar.',
    'Which plan makes the production documents?': '¿Qué plan crea los documentos de producción?',
    'Breakdowns, stripboards, shot lists and script analysis are Lumiere features, included in the Pro plan.': 'Los desgloses, planes de rodaje, listas de planos y análisis de guion son funciones de Lumiere incluidas en el plan Pro.',
    'Is there a free trial?': '¿Hay una prueba gratuita?',
    'Your first script is on us. Write it fully before you pick a plan.': 'Tu primer guion corre por nuestra cuenta. Escríbelo completo antes de elegir un plan.',
    'FilmScript. Write better, not louder.': 'FilmScript. Escribe mejor, no más fuerte.',

    // Pricing.
    'Choose the workspace that fits your process.': 'Elige el espacio de trabajo que se adapta a tu proceso.',
    'Start free, build your production manually with Basic, or unlock the full Lumiere workflow with Pro.': 'Empieza gratis, construye tu producción manualmente con Basic o desbloquea el flujo completo de Lumiere con Pro.',
    'Most loved': 'Más elegido',
    '/ month': '/ mes',
    '$0 / month': '$0 / mes',
    '$12.99 / month': '$12.99 / mes',
    '$19.99 / month': '$19.99 / mes',
    'FilmScript Basic · $12.99 / month': 'FilmScript Basic · $12.99 / mes',
    'FilmScript Pro · $19.99 / month': 'FilmScript Pro · $19.99 / mes',
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

    // Plan and billing.
    'Checking your subscription': 'Verificando tu suscripción',
    'FilmScript is securely checking your subscription with Recurrente.': 'FilmScript está verificando de forma segura tu suscripción con Recurrente.',
    'Google account': 'Cuenta de Google',
    'Your FilmScript Pro plan': 'Tu plan FilmScript Pro',
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
    'Cancel FilmScript Pro': 'Cancelar FilmScript Pro',
    'Cancel FilmScript Pro?': '¿Cancelar FilmScript Pro?',
    'Cancel FilmScript Basic': 'Cancelar FilmScript Basic',
    'Cancel FilmScript Basic?': '¿Cancelar FilmScript Basic?',
    'Review the details before you continue. Cancellation stops future renewals and Lumiere generation, but it never deletes your existing work.': 'Revisa los detalles antes de continuar. La cancelación detiene futuras renovaciones y la generación con Lumiere, pero nunca elimina tu trabajo existente.',
    'I understand that canceling removes Lumiere generation, while my scripts and existing production documents remain editable and exportable.': 'Entiendo que cancelar desactiva la generación con Lumiere, mientras mis guiones y documentos de producción existentes siguen siendo editables y exportables.',
    'Cancel through Recurrente': 'Cancelar mediante Recurrente',
    'Keep my plan': 'Conservar mi plan',
    'FilmScript never exposes your Recurrente secret key or payment details in the browser.': 'FilmScript nunca expone tu llave secreta de Recurrente ni los detalles de pago en el navegador.',
    'This Google account does not have an active FilmScript subscription. Existing scripts and production documents remain editable and exportable.': 'Esta cuenta de Google no tiene una suscripción activa de FilmScript. Los guiones y documentos de producción existentes siguen siendo editables y exportables.',
    'Cancellation complete': 'Cancelación completada',
    'FilmScript Pro canceled': 'FilmScript Pro cancelado',
    'FilmScript Pro is canceled. Your existing work remains available to edit and export; Lumiere generation is now locked.': 'FilmScript Pro está cancelado. Tu trabajo existente sigue disponible para editar y exportar; la generación con Lumiere ahora está bloqueada.',
    'Return to FilmScript': 'Volver a FilmScript',
    'Nothing was changed': 'No se modificó nada',
    'We could not complete that': 'No pudimos completar la acción',
    'Recurrente could not be reached. Your plan remains active.': 'No fue posible comunicarse con Recurrente. Tu plan sigue activo.',

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
    'Music': 'Música'
  });

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

  const get = () => {
    try { return normalize(localStorage.getItem(STORAGE_KEY)); }
    catch (error) { return 'en'; }
  };

  const hasStoredLanguage = () => {
    try {
      const stored = String(localStorage.getItem(STORAGE_KEY) || '').toLowerCase();
      return SUPPORTED.has(stored);
    } catch (error) {
      return false;
    }
  };

  const shouldOfferInitialChoice = () => {
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
    if ((match = value.match(/^FilmScript Pro is required for new Lumiere (.+) analysis\.$/))) return `Se requiere FilmScript Pro para generar un nuevo análisis de ${match[1]} con Lumiere.`;
    if ((match = value.match(/^Ask Lumiere about (.+)$/))) return `Preguntar a Lumiere sobre ${match[1]}`;
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
    if ((match = value.match(/^(\d+)% credits left$/))) return `${match[1]}% de créditos disponibles`;
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
    if (element.closest('[data-i18n-skip], [data-fs-page], [data-v5-cover], [contenteditable="true"]')) return true;
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

  const renderSettings = (modal) => {
    const language = get();
    const spanish = language === 'es';
    const setText = (selector, value) => { const node = modal.querySelector(selector); if (node && node.textContent !== value) node.textContent = value; };
    setText('[data-settings-eyebrow]', spanish ? 'FILMSCRIPT' : 'FILMSCRIPT');
    setText('[data-settings-title]', spanish ? 'Ajustes' : 'Settings');
    setText('[data-settings-copy]', spanish ? 'Personaliza cómo se siente FilmScript en este dispositivo.' : 'Personalize how FilmScript feels on this device.');
    setText('[data-settings-language-label]', spanish ? 'Idioma' : 'Language');
    setText('[data-settings-language-copy]', spanish ? 'Elige el idioma de la interfaz. Tus guiones y chats nunca se traducen.' : 'Choose the interface language. Your scripts and chats are never translated.');
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
      <section class="fs-language-sheet" role="dialog" aria-modal="true" aria-labelledby="fs-language-title">
        <button type="button" class="fs-language-close" data-settings-close aria-label="Close settings">×</button>
        <div class="fs-language-eyebrow" data-settings-eyebrow>FILMSCRIPT</div>
        <h2 id="fs-language-title" data-settings-title>Settings</h2>
        <p class="fs-language-intro" data-settings-copy>Personalize how FilmScript feels on this device.</p>
        <div class="fs-language-rule" aria-hidden="true"></div>
        <div class="fs-language-section-title" data-settings-language-label>Language</div>
        <p class="fs-language-section-copy" data-settings-language-copy>Choose the interface language. Your scripts and chats are never translated.</p>
        <div class="fs-language-options" role="group" aria-label="Language">
          <button type="button" class="fs-language-option" data-language-option="en" data-i18n-skip aria-pressed="false"><span><strong>English</strong></span><i class="fs-language-check" aria-hidden="true"></i></button>
          <button type="button" class="fs-language-option" data-language-option="es" data-i18n-skip aria-pressed="false"><span><strong>Español</strong></span><i class="fs-language-check" aria-hidden="true"></i></button>
        </div>
        <p class="fs-language-helper" data-settings-helper>Changes apply across FilmScript immediately.</p>
      </section>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => {
      const option = event.target.closest('[data-language-option]');
      if (option) { set(option.dataset.languageOption); return; }
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
    modal.innerHTML = `
      <div class="fs-language-backdrop"></div>
      <section class="fs-language-sheet" role="dialog" aria-modal="true" aria-labelledby="fs-language-initial-title">
        <div class="fs-language-eyebrow">FILMSCRIPT</div>
        <h2 id="fs-language-initial-title">Choose your language<br><span>Elige tu idioma</span></h2>
        <p class="fs-language-intro">Choose the language you want to use across FilmScript.<br>Elige el idioma que quieres usar en FilmScript.</p>
        <div class="fs-language-rule" aria-hidden="true"></div>
        <div class="fs-language-options" role="group" aria-label="Choose your language / Elige tu idioma">
          <button type="button" class="fs-language-option" data-initial-language-option="en" aria-label="Choose English"><span><strong>English</strong><small>Use FilmScript in English</small></span><i class="fs-language-arrow" aria-hidden="true">→</i></button>
          <button type="button" class="fs-language-option" data-initial-language-option="es" aria-label="Elegir Español"><span><strong>Español</strong><small>Usa FilmScript en español</small></span><i class="fs-language-arrow" aria-hidden="true">→</i></button>
        </div>
        <p class="fs-language-helper">You can change this later from your profile settings.<br>Puedes cambiarlo después desde los ajustes de tu perfil.</p>
      </section>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => {
      const option = event.target.closest('[data-initial-language-option]');
      if (!option) return;
      const next = set(option.dataset.initialLanguageOption);
      closeInitialChoice();
      window.dispatchEvent(new CustomEvent('filmscript:initial-language-choice', { detail: { language: next } }));
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
  };

  const openSettings = () => {
    const modal = ensureSettings();
    renderSettings(modal);
    modal.hidden = false;
    document.documentElement.classList.add('fs-language-open');
    window.setTimeout(() => modal.querySelector(`[data-language-option="${get()}"]`)?.focus(), 20);
  };

  const closeSettings = () => {
    const modal = document.getElementById(SETTINGS_ID);
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.documentElement.classList.remove('fs-language-open');
  };

  const apply = (language = get(), root = document) => {
    const next = normalize(language);
    document.documentElement.lang = next;
    document.documentElement.setAttribute('data-filmscript-language', next);
    walk(root, next);
    injectLanguageButtons();
    injectProfileSettings();
    refreshInjectedControls();
    return next;
  };

  const set = (language) => {
    const next = normalize(language);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (error) {}
    apply(next);
    window.dispatchEvent(new CustomEvent('filmscript:language-change', { detail: { language: next } }));
    return next;
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
      .fs-language-modal[hidden]{display:none!important}.fs-language-modal{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:24px;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif}.fs-language-backdrop{position:absolute;inset:0;background:rgba(20,20,18,.48);backdrop-filter:blur(10px);animation:fsLanguageFade .16s ease both}.fs-language-sheet{--fs-lang-bg:#FFFEF9;--fs-lang-ink:#242421;--fs-lang-muted:#77756e;--fs-lang-line:rgba(36,36,33,.34);position:relative;width:min(460px,calc(100vw - 32px));box-sizing:border-box;padding:28px;background:var(--fs-lang-bg);color:var(--fs-lang-ink);border:1px solid var(--fs-lang-line);border-radius:21px 18px 23px 17px/19px 22px 17px 21px;box-shadow:0 26px 90px rgba(0,0,0,.28);animation:fsLanguageRise .2s cubic-bezier(.2,.8,.2,1) both}.fs-language-sheet:after{content:"";position:absolute;pointer-events:none;inset:4px 5px 4px 4px;border:1px solid color-mix(in srgb,var(--fs-lang-ink) 24%,transparent);border-radius:17px 16px 18px 15px/16px 18px 15px 17px;opacity:.42;transform:rotate(.08deg)}
      :root[data-filmscript-theme="dark"] .fs-language-sheet{--fs-lang-bg:#242422;--fs-lang-ink:#F0EEE7;--fs-lang-muted:#aaa79e;--fs-lang-line:rgba(240,238,231,.3)}
      .fs-language-sheet>*{position:relative;z-index:1}.fs-language-close{position:absolute;z-index:3;right:17px;top:15px;width:32px;height:32px;border:0;border-radius:50%;background:transparent;color:var(--fs-lang-muted);font:300 24px/1 sans-serif;cursor:pointer;transition:background-color .15s ease,color .15s ease}.fs-language-close:hover{background:color-mix(in srgb,var(--fs-lang-ink) 8%,transparent);color:var(--fs-lang-ink)}.fs-language-eyebrow{font-size:10px;font-weight:750;letter-spacing:1.7px;color:#BA7517}.fs-language-sheet h2{margin:8px 0 0;font-size:28px;line-height:1.08;letter-spacing:-.75px}.fs-language-initial-choice .fs-language-sheet h2 span{font-size:.64em;font-weight:500;letter-spacing:-.2px;color:var(--fs-lang-muted)}.fs-language-intro{margin:9px 42px 0 0;color:var(--fs-lang-muted);font-size:13px;line-height:1.5}.fs-language-rule{width:100%;height:1px;margin:22px 0 20px;background:color-mix(in srgb,var(--fs-lang-ink) 14%,transparent);transform:rotate(-.15deg)}.fs-language-section-title{font-size:14px;font-weight:700}.fs-language-section-copy{margin:5px 0 0;color:var(--fs-lang-muted);font-size:12px;line-height:1.5}.fs-language-options{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.fs-language-option{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:70px;padding:12px 13px;border:1px solid color-mix(in srgb,var(--fs-lang-ink) 20%,transparent);border-radius:13px 11px 14px 10px/11px 14px 10px 13px;background:transparent;color:var(--fs-lang-ink);text-align:left;cursor:pointer;transition:transform .16s cubic-bezier(.2,.8,.2,1),border-color .16s ease,background-color .16s ease}.fs-language-option:hover{transform:translateY(-1px);border-color:color-mix(in srgb,#BA7517 66%,var(--fs-lang-line))}.fs-language-option.is-active{border-color:#BA7517;background:rgba(186,117,23,.09)}.fs-language-option span,.fs-language-option strong,.fs-language-option small{display:block}.fs-language-option strong{font-size:13px}.fs-language-option small{margin-top:4px;color:var(--fs-lang-muted);font-size:10.5px}.fs-language-arrow{font-style:normal;color:#BA7517;font-size:18px;transition:transform .16s ease}.fs-language-option:hover .fs-language-arrow{transform:translateX(3px)}.fs-language-check{display:grid;place-items:center;width:22px;height:22px;flex:0 0 22px;border:1px solid color-mix(in srgb,var(--fs-lang-ink) 24%,transparent);border-radius:50%;color:#BA7517;font:800 12px/1 sans-serif}.fs-language-option.is-active .fs-language-check{border-color:#BA7517}.fs-language-helper{margin:15px 0 0;color:var(--fs-lang-muted);font-size:10.5px;line-height:1.45}.fs-language-open{overflow:hidden}@keyframes fsLanguageFade{from{opacity:0}to{opacity:1}}@keyframes fsLanguageRise{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}@media(max-width:520px){.fs-language-modal{padding:14px}.fs-language-sheet{padding:25px 20px}.fs-language-options{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){.fs-language-backdrop,.fs-language-sheet,.fs-language-quick,.fs-language-option{animation-duration:.01ms!important;transition-duration:.01ms!important}}
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
      window.filmscriptSounds?.play?.('profileOption');
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
    if (shouldOfferInitialChoice()) window.setTimeout(openInitialChoice, 80);
  };

  document.documentElement.lang = get();
  document.documentElement.setAttribute('data-filmscript-language', get());
  window.filmscriptLanguage = Object.freeze({
    key: STORAGE_KEY,
    get,
    hasStoredLanguage,
    needsInitialChoice: shouldOfferInitialChoice,
    set,
    t,
    apply,
    openSettings,
    closeSettings,
    openInitialChoice,
    closeInitialChoice,
    languages: Object.freeze(['en', 'es']),
  });

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) apply(get());
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
