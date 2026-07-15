// Shared, persistent FilmScript interface-language preference.
// Screenplay text, imported documents, script titles and saved conversations are
// deliberately excluded: changing the interface language must never rewrite art.
(() => {
  'use strict';

  const STORAGE_KEY = 'filmscript_language';
  const SETTINGS_ID = 'filmscript-language-settings';
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
    'Dark theme': 'Tema oscuro',
    'Light theme': 'Tema claro',
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
    'Choose FilmScript Pro': 'Elegir FilmScript Pro',
    'Choose FilmScript Pro →': 'Elegir FilmScript Pro →',
    'View FilmScript Pro': 'Ver FilmScript Pro',
    'View FilmScript Pro · $20 / month': 'Ver FilmScript Pro · $20 / mes',
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
    'Lumiere offers editorial suggestions and analysis. You decide what belongs in your work and remain responsible for the final text.': 'Lumiere ofrece sugerencias editoriales y análisis. Tú decides qué pertenece a tu obra y sigues siendo responsable del texto final.',
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
    'You will return to FilmScript after payment. FilmScript verifies the checkout securely and unlocks Pro automatically.': 'Volverás a FilmScript después del pago. FilmScript verifica el pago de forma segura y desbloquea Pro automáticamente.',
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
    'Coffee first, then pages. The quiet hours are where the good scenes hide.': 'Primero café, luego páginas. En las horas tranquilas se esconden las buenas escenas.',
    'Good morning, writer.': 'Buenos días, guionista.',
    'Fresh coffee, fresh pages. Your characters slept even less than you did.': 'Café fresco, páginas nuevas. Tus personajes durmieron aún menos que tú.',
    'Good afternoon, writer.': 'Buenas tardes, guionista.',
    'A perfect hour for second acts. Lunch can wait, the midpoint cannot.': 'Una hora perfecta para los segundos actos. El almuerzo puede esperar; el punto medio no.',
    'The light is turning golden. A fine moment to fix that third act.': 'La luz se vuelve dorada. Un buen momento para arreglar ese tercer acto.',
    'Good evening, writer.': 'Buenas noches, guionista.',
    'Prime time. Your characters have been waiting for you all day.': 'Hora estelar. Tus personajes te han esperado todo el día.',
    'Writing past bedtime.': 'Escribiendo después de dormir.',
    'One more scene, you said, two hours ago. We believe you.': 'Una escena más, dijiste hace dos horas. Te creemos.',

    // Editor controls and Lumiere.
    'Editor': 'Editor',
    'Breakdown': 'Desglose',
    'Script Breakdown': 'Desglose de guion',
    'Stripboard': 'Plan de rodaje',
    'Shot List': 'Lista de planos',
    'Shot lists': 'Listas de planos',
    'Budget': 'Presupuesto',
    'Analysis': 'Análisis',
    'Analysis · Lumière': 'Análisis · Lumière',
    'Developing': 'En desarrollo',
    'Needs Attention': 'Necesita atención',
    'Production Ready': 'Listo para producción',
    'Current screenplay reading': 'Lectura actual del guion',
    'What’s working': 'Lo que funciona',
    'Needs attention': 'Necesita atención',
    'Production impact': 'Impacto de producción',
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
    'Lumière’s read': 'Lectura de Lumière',
    'Fix first': 'Corregir primero',
    'Scenes that need attention': 'Escenas que necesitan atención',
    'Open Scene': 'Abrir escena',
    'Keep an eye on': 'Prestar atención',
    'Key moments': 'Momentos clave',
    'Jump to Scene': 'Ir a la escena',
    'Production': 'Producción',
    'Production overview': 'Resumen de producción',
    'Locations': 'Locaciones',
    'Complex scenes': 'Escenas complejas',
    'Plan carefully': 'Planificar con cuidado',
    'High complexity scenes': 'Escenas de alta complejidad',
    'Connected screenplay': 'Guion conectado',
    'Scene explorer': 'Explorador de escenas',
    'All scenes': 'Todas las escenas',
    'High complexity': 'Alta complejidad',
    'Screenplay priorities': 'Prioridades del guion',
    'Ask Lumière about Story': 'Preguntar a Lumière sobre la historia',
    'Ask Lumière about Characters': 'Preguntar a Lumière sobre los personajes',
    'Ask Lumière about Production': 'Preguntar a Lumière sobre la producción',
    'Story clarity timeline': 'Línea de claridad de la historia',
    'Filter scene explorer': 'Filtrar explorador de escenas',
    'Only the screenplay choices that change how this film is made.': 'Solo las decisiones del guion que cambian cómo se realiza esta película.',
    'Momentum, emotion, and dramatic pressure in one view.': 'Impulso, emoción y presión dramática en una sola vista.',
    'Momentum, emotion, and dramatic pressure—combined into one readable arc.': 'Impulso, emoción y presión dramática combinados en un arco fácil de leer.',
    'Where the screenplay begins, turns, peaks, and lands.': 'Dónde comienza, gira, alcanza su pico y termina el guion.',
    'No material scene issue was identified in this pass.': 'No se identificó ningún problema importante de escena en esta lectura.',
    'Lumière has not identified a decisive key moment yet.': 'Lumière aún no ha identificado un momento clave decisivo.',
    'No unusually complex scene was identified.': 'No se identificó ninguna escena de complejidad inusual.',
    'No clear strength has enough evidence yet.': 'Aún no hay suficiente evidencia para destacar una fortaleza clara.',
    'No critical writing issue was identified in this pass.': 'No se identificó ningún problema crítico de escritura en esta lectura.',
    'No material production impact was identified.': 'No se identificó ningún impacto importante de producción.',
    'Your existing insights and exports remain available. FilmScript Pro is required only for a new Lumière reading.': 'Tus análisis y exportaciones existentes siguen disponibles. FilmScript Pro solo es necesario para una nueva lectura de Lumière.',
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
    'Lumière Insight': 'Observación de Lumière',
    'Lumière Suggests': 'Lumière sugiere',
    'Ask Lumière': 'Preguntar a Lumière',
    'Ask Lumière why': 'Preguntar a Lumière por qué',
    'View Full Analysis': 'Ver análisis completo',
    'Full Analysis': 'Análisis completo',
    'Export Report': 'Exportar informe',
    'All analysis powered by Lumière AI': 'Todo el análisis funciona con la IA de Lumière',
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
    'Switch to dark mode': 'Cambiar a modo oscuro',
    'Switch to light mode': 'Cambiar a modo claro',
    'Updating analysis…': 'Actualizando análisis…',
    'Lumiere is connecting to the current screenplay…': 'Lumiere se está conectando al guion actual…',
    'Analysis is not available for this screenplay.': 'El análisis no está disponible para este guion.',
    'Could not load Analysis.': 'No se pudo cargar el análisis.',
    'Could not refresh Analysis.': 'No se pudo actualizar el análisis.',
    'Could not update Analysis.': 'No se pudo actualizar el análisis.',
    'Could not save that Analysis change.': 'No se pudo guardar ese cambio del análisis.',
    'No scenes match this filter.': 'Ninguna escena coincide con este filtro.',
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
    'Tell Lumière the intended genre': 'Indicar a Lumière el género previsto',
    'Intended genre': 'Género previsto',
    'Choose a genre': 'Elige un género',
    'No scenes match this filter.': 'Ninguna escena coincide con este filtro.',
    'Save as note': 'Guardar como nota',
    'Saved as note': 'Guardado como nota',
    'Dismiss insight': 'Descartar observación',
    'Supporting scenes': 'Escenas de respaldo',
    'Close full analysis': 'Cerrar análisis completo',
    'Lumière observes and suggests. Your screenplay is never rewritten without explicit permission.': 'Lumière observa y sugiere. Tu guion nunca se reescribe sin permiso explícito.',
    'Write a few scenes and Lumière will begin analyzing your screenplay.': 'Escribe algunas escenas y Lumière comenzará a analizar tu guion.',
    'Lumière is connecting to the current screenplay…': 'Lumière se está conectando al guion actual…',
    'Lumière is reading the current draft…': 'Lumière está leyendo el borrador actual…',
    'FilmScript Pro is required for new Lumière story structure analysis.': 'Se requiere FilmScript Pro para generar un nuevo análisis de estructura narrativa con Lumière.',
    'More screenplay context is needed before Lumière can interpret story structure.': 'Lumière necesita más contexto del guion para interpretar la estructura narrativa.',
    'Connected production': 'Producción conectada',
    'Budget saves automatically': 'El presupuesto se guarda automáticamente',
    'Budget views': 'Vistas del presupuesto',
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
    'FilmScript Pro is required to use Lumiere. Your existing work remains editable and exportable.': 'Se requiere FilmScript Pro para usar Lumiere. Tu trabajo existente sigue siendo editable y exportable.',
    'Lumiere requires FilmScript Pro': 'Lumiere requiere FilmScript Pro',
    'Your screenplay and existing production documents remain available to edit and export. An active plan is required only to generate new work with Lumiere.': 'Tu guion y los documentos de producción existentes siguen disponibles para editar y exportar. Solo se requiere un plan activo para generar trabajo nuevo con Lumiere.',
    'Your screenplay and every existing breakdown, stripboard, shot list, and budget remain available to edit and export. An active plan is required only to generate new work with Lumiere.': 'Tu guion y todos los desgloses, planes de rodaje, listas de planos y presupuestos existentes siguen disponibles para editar y exportar. Solo se requiere un plan activo para generar trabajo nuevo con Lumiere.',
    'Canceling never deletes your scripts or existing production documents.': 'Cancelar nunca elimina tus guiones ni los documentos de producción existentes.',
    'Canceling never deletes your existing production documents.': 'Cancelar nunca elimina tus documentos de producción existentes.',
    'View FilmScript Pro · $20 a month': 'Ver FilmScript Pro · $20 al mes',
    'No active plan · Lumiere unavailable': 'Sin plan activo · Lumiere no disponible',
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
    'FilmScript Pro · $20 a month. Cancel any time.': 'FilmScript Pro · $20 al mes. Cancela cuando quieras.',
    '"This line leans on a cliché. Want a sharper image?"': '"Esta línea se apoya en un cliché. ¿Quieres una imagen más precisa?"',
    'reading Scene 12': 'leyendo la escena 12',
    'Run a full analysis on act two. Where does the tension sag?': 'Haz un análisis completo del segundo acto. ¿Dónde pierde fuerza la tensión?',
    '"The crowd parts around her like water" leans on a familiar image. Mara notices textures, not shapes. What does the crowd sound like to her?': '"La multitud se abre a su alrededor como agua" usa una imagen conocida. Mara percibe texturas, no formas. ¿Cómo suena la multitud para ella?',
    'Done. Tension climbs to the storm, then flattens for eleven pages while Mara waits. Scenes 44 to 47 repeat the same beat. Full report is on your desk.': 'Listo. La tensión sube hasta la tormenta y luego se aplana durante once páginas mientras Mara espera. Las escenas 44 a 47 repiten el mismo momento. El informe completo está en tu escritorio.',
    'Step 01 · Write': 'Paso 01 · Escribe',
    'A real Hollywood format editor.': 'Un verdadero editor con formato de Hollywood.',
    'Scene headings, action, dialogue and transitions, all on industry standard margins. The page feels like paper and sounds like a typewriter.': 'Encabezados de escena, acción, diálogo y transiciones, todo con márgenes estándar de la industria. La página se siente como papel y suena como una máquina de escribir.',
    'Format at one key. Tab cycles the block types, ⌘1 to ⌘6 jumps straight to one.': 'Formato con una tecla. Tab recorre los tipos de bloque y ⌘1 a ⌘6 salta directamente a cada uno.',
    'Typewriter sound you can mute any time.': 'Sonido de máquina de escribir que puedes silenciar cuando quieras.',
    'Hand drawn pages, light and dark, WGA checked as you type.': 'Páginas dibujadas a mano, claras u oscuras, revisadas con formato WGA mientras escribes.',
    'INT. RAILWAY CAFÉ. RAINY AFTERNOON': 'INT. CAFÉ DE LA ESTACIÓN. TARDE LLUVIOSA',
    'Steam fogs the window. MARA watches the platform. A train sighs in, brakes hissing.': 'El vapor empaña la ventana. MARA observa el andén. Un tren entra suspirando, con los frenos silbando.',
    '(barely audible)': '(apenas audible)',
    "He's not coming. He never was. I just liked the waiting.": 'No va a venir. Nunca iba a hacerlo. Solo me gustaba esperar.',
    'She closes the notebook.': 'Cierra el cuaderno.',
    'Steam fogs the window. MARA watches the platform, her notebook shut beside a cooling cup of tea. A train sighs in, brakes hissing. She pulls her wool coat tighter.': 'El vapor empaña la ventana. MARA observa el andén, con el cuaderno cerrado junto a una taza de té que se enfría. Un tren entra suspirando, con los frenos silbando. Ella se ajusta el abrigo de lana.',
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
    'Mara alone at the window, steam on the glass': 'Mara sola junto a la ventana, con vapor en el vidrio',
    'The notebook stays shut': 'El cuaderno permanece cerrado',
    'The train arrives beyond the glass': 'El tren llega detrás del vidrio',
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
    'Breakdowns, stripboards, shot lists and script analysis are Lumiere features, included in the $20 plan.': 'Los desgloses, planes de rodaje, listas de planos y análisis de guion son funciones de Lumiere incluidas en el plan de $20.',
    'Is there a free trial?': '¿Hay una prueba gratuita?',
    'Your first script is on us. Write it fully before you pick a plan.': 'Tu primer guion corre por nuestra cuenta. Escríbelo completo antes de elegir un plan.',
    'FilmScript. Write better, not louder.': 'FilmScript. Escribe mejor, no más fuerte.',

    // Pricing.
    'Everything you need to finish the script.': 'Todo lo que necesitas para terminar el guion.',
    'One simple plan. No annual lock in. Cancel whenever you like.': 'Un plan sencillo. Sin compromiso anual. Cancela cuando quieras.',
    'Most loved': 'Más elegido',
    '/ month': '/ mes',
    '$20 / month': '$20 / mes',
    'FilmScript Pro · $20 / month': 'FilmScript Pro · $20 / mes',
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
    'One connected workflow for writing, planning and preparing the shoot.': 'Un flujo conectado para escribir, planificar y preparar el rodaje.',
    'Screenplay editor': 'Editor de guion',
    'Professional formatting, scene navigation and focused writing.': 'Formato profesional, navegación por escenas y escritura enfocada.',
    'Script feedback, analysis and conversations saved per screenplay.': 'Comentarios, análisis y conversaciones guardadas por cada guion.',
    'Editable cast, props, wardrobe, locations and production elements.': 'Reparto, utilería, vestuario, locaciones y elementos de producción editables.',
    'Stripboards': 'Planes de rodaje',
    'Drag scenes into a practical shooting order and export the plan.': 'Arrastra escenas a un orden práctico de rodaje y exporta el plan.',
    'Editable camera coverage generated scene by scene with Lumière.': 'Cobertura de cámara editable, generada escena por escena con Lumière.',
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
    'Review the details before you continue. Cancellation stops future renewals and Lumiere generation, but it never deletes your existing work.': 'Revisa los detalles antes de continuar. La cancelación detiene futuras renovaciones y la generación con Lumiere, pero nunca elimina tu trabajo existente.',
    'I understand that canceling removes Lumiere generation, while my scripts and existing production documents remain editable and exportable.': 'Entiendo que cancelar desactiva la generación con Lumiere, mientras mis guiones y documentos de producción existentes siguen siendo editables y exportables.',
    'Cancel through Recurrente': 'Cancelar mediante Recurrente',
    'Keep my plan': 'Conservar mi plan',
    'FilmScript never exposes your Recurrente secret key or payment details in the browser.': 'FilmScript nunca expone tu llave secreta de Recurrente ni los detalles de pago en el navegador.',
    'This Google account does not have an active FilmScript Pro subscription. Existing scripts and production documents remain editable and exportable.': 'Esta cuenta de Google no tiene una suscripción activa a FilmScript Pro. Los guiones y documentos de producción existentes siguen siendo editables y exportables.',
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
    'Could not save this budget.': 'No se pudo guardar este presupuesto.'
  });

  const normalize = (value) => SUPPORTED.has(String(value || '').toLowerCase())
    ? String(value).toLowerCase()
    : 'en';

  const get = () => {
    try { return normalize(localStorage.getItem(STORAGE_KEY)); }
    catch (error) { return 'en'; }
  };

  const translateDynamic = (value) => {
    let match;
    if ((match = value.match(/^Updated (just now|\d+s ago|\d+m ago)$/))) {
      const when = match[1] === 'just now' ? 'justo ahora' : match[1]
        .replace(/^(\d+)s ago$/, 'hace $1 s')
        .replace(/^(\d+)m ago$/, 'hace $1 min');
      return `Actualizado ${when}`;
    }
    if ((match = value.match(/^Scene (\d+) · Page (\d+)$/))) return `Escena ${match[1]} · Página ${match[2]}`;
    if ((match = value.match(/^Scenes ([\d, ]+) · Pages? ([\d, ]+)$/))) return `Escenas ${match[1]} · Páginas ${match[2]}`;
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
    return translated ? `${leading}${translated}${trailing}`.replaceAll('Lumière', 'Lumiere') : raw.replaceAll('Lumière', 'Lumiere');
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
          <button type="button" class="fs-language-option" data-language-option="en" data-i18n-skip aria-pressed="false"><span><strong>English</strong><small>English</small></span><i class="fs-language-check" aria-hidden="true"></i></button>
          <button type="button" class="fs-language-option" data-language-option="es" data-i18n-skip aria-pressed="false"><span><strong>Español</strong><small>Spanish · Español</small></span><i class="fs-language-check" aria-hidden="true"></i></button>
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
      .fs-language-profile-item{display:flex!important;align-items:center;justify-content:space-between;gap:16px;min-height:34px}.fs-language-profile-item small{color:var(--muted,#888780);font:500 10.5px/1 "Helvetica Neue",Helvetica,Arial,sans-serif;letter-spacing:.15px}.fs-language-profile-item:hover small{color:var(--accent,#BA7517)}
      .fs-language-profile-item:focus-visible,.fs-language-option:focus-visible,.fs-language-close:focus-visible{outline:2px solid #BA7517;outline-offset:2px}
      .fs-language-modal[hidden]{display:none!important}.fs-language-modal{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:24px;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif}.fs-language-backdrop{position:absolute;inset:0;background:rgba(20,20,18,.48);backdrop-filter:blur(10px);animation:fsLanguageFade .16s ease both}.fs-language-sheet{--fs-lang-bg:#FFFEF9;--fs-lang-ink:#242421;--fs-lang-muted:#77756e;--fs-lang-line:rgba(36,36,33,.34);position:relative;width:min(460px,calc(100vw - 32px));box-sizing:border-box;padding:28px;background:var(--fs-lang-bg);color:var(--fs-lang-ink);border:1px solid var(--fs-lang-line);border-radius:21px 18px 23px 17px/19px 22px 17px 21px;box-shadow:0 26px 90px rgba(0,0,0,.28);animation:fsLanguageRise .2s cubic-bezier(.2,.8,.2,1) both}.fs-language-sheet:after{content:"";position:absolute;pointer-events:none;inset:4px 5px 4px 4px;border:1px solid color-mix(in srgb,var(--fs-lang-ink) 24%,transparent);border-radius:17px 16px 18px 15px/16px 18px 15px 17px;opacity:.42;transform:rotate(.08deg)}
      :root[data-filmscript-theme="dark"] .fs-language-sheet{--fs-lang-bg:#242422;--fs-lang-ink:#F0EEE7;--fs-lang-muted:#aaa79e;--fs-lang-line:rgba(240,238,231,.3)}
      .fs-language-sheet>*{position:relative;z-index:1}.fs-language-close{position:absolute;z-index:3;right:17px;top:15px;width:32px;height:32px;border:0;border-radius:50%;background:transparent;color:var(--fs-lang-muted);font:300 24px/1 sans-serif;cursor:pointer;transition:background-color .15s ease,color .15s ease}.fs-language-close:hover{background:color-mix(in srgb,var(--fs-lang-ink) 8%,transparent);color:var(--fs-lang-ink)}.fs-language-eyebrow{font-size:10px;font-weight:750;letter-spacing:1.7px;color:#BA7517}.fs-language-sheet h2{margin:8px 0 0;font-size:28px;line-height:1.08;letter-spacing:-.75px}.fs-language-intro{margin:9px 42px 0 0;color:var(--fs-lang-muted);font-size:13px;line-height:1.5}.fs-language-rule{width:100%;height:1px;margin:22px 0 20px;background:color-mix(in srgb,var(--fs-lang-ink) 14%,transparent);transform:rotate(-.15deg)}.fs-language-section-title{font-size:14px;font-weight:700}.fs-language-section-copy{margin:5px 0 0;color:var(--fs-lang-muted);font-size:12px;line-height:1.5}.fs-language-options{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.fs-language-option{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:70px;padding:12px 13px;border:1px solid color-mix(in srgb,var(--fs-lang-ink) 20%,transparent);border-radius:13px 11px 14px 10px/11px 14px 10px 13px;background:transparent;color:var(--fs-lang-ink);text-align:left;cursor:pointer;transition:transform .16s cubic-bezier(.2,.8,.2,1),border-color .16s ease,background-color .16s ease}.fs-language-option:hover{transform:translateY(-1px);border-color:color-mix(in srgb,#BA7517 66%,var(--fs-lang-line))}.fs-language-option.is-active{border-color:#BA7517;background:rgba(186,117,23,.09)}.fs-language-option span,.fs-language-option strong,.fs-language-option small{display:block}.fs-language-option strong{font-size:13px}.fs-language-option small{margin-top:4px;color:var(--fs-lang-muted);font-size:10.5px}.fs-language-check{display:grid;place-items:center;width:22px;height:22px;flex:0 0 22px;border:1px solid color-mix(in srgb,var(--fs-lang-ink) 24%,transparent);border-radius:50%;color:#BA7517;font:800 12px/1 sans-serif}.fs-language-option.is-active .fs-language-check{border-color:#BA7517}.fs-language-helper{margin:15px 0 0;color:var(--fs-lang-muted);font-size:10.5px;line-height:1.45}.fs-language-open{overflow:hidden}@keyframes fsLanguageFade{from{opacity:0}to{opacity:1}}@keyframes fsLanguageRise{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}@media(max-width:520px){.fs-language-modal{padding:14px}.fs-language-sheet{padding:25px 20px}.fs-language-options{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){.fs-language-backdrop,.fs-language-sheet,.fs-language-quick,.fs-language-option{animation-duration:.01ms!important;transition-duration:.01ms!important}}
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
      if (event.key === 'Escape') closeSettings();
      if ((event.key === 'Enter' || event.key === ' ') && event.target.closest?.('[data-filmscript-language-settings]')) {
        event.preventDefault();
        openSettings();
      }
    });
  };

  document.documentElement.lang = get();
  document.documentElement.setAttribute('data-filmscript-language', get());
  window.filmscriptLanguage = Object.freeze({
    key: STORAGE_KEY,
    get,
    set,
    t,
    apply,
    openSettings,
    closeSettings,
    languages: Object.freeze(['en', 'es']),
  });

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) apply(get());
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
