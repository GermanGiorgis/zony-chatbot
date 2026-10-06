# 1. Requisitos

## 1.1 Propósito y alcance

**Propósito.** Un asistente conversacional en español, gratuito de operar, que haga cosas que un chat común no hace: leer archivos y enlaces, usar herramientas, hablar y escuchar, y tener un cuerpo (un robot 3D) que reaccione y se pueda personalizar.

**Alcance.** Una aplicación web de una sola página, sin cuentas de usuario ni base de datos propia. La conversación se guarda en el navegador de quien la usa. La inteligencia viene de servicios externos con capa gratuita.

**Fuera de alcance** (decisiones conscientes, ver [análisis](02-analisis.md#7-alternativas-descartadas)):

- Cuentas, inicio de sesión y sincronización entre dispositivos.
- Guardar los archivos adjuntos (solo se guarda una marca con el nombre).
- Pagos, planes o límites por usuario registrado.
- Búsqueda en documentos propios (RAG) y memoria entre conversaciones.
- Moderación avanzada de contenido (se apoya en los filtros del proveedor).

## 1.2 Actores

| Actor | Quién es | Qué quiere |
| --- | --- | --- |
| **Visitante** | Cualquier persona que abre la web (incluye a quien evalúa el portfolio) | Conversar, adjuntar, personalizar al robot, probar la voz |
| **Responsable del sitio** | Quien despliega el proyecto | Que funcione gratis, sin que un visitante gaste toda la cuota, y poder medir el uso |
| **Gemini** (Google) | Proveedor principal de IA | Recibe la conversación y devuelve texto en streaming |
| **Groq** | Proveedor de respaldo | Responde solo texto cuando Gemini agotó su cuota |
| **Open-Meteo** | Servicio público de clima | Datos del tiempo para la herramienta de clima |
| **Navegador** | Entorno del visitante | Aporta almacenamiento, voz (Web Speech) y WebGL |

## 1.3 Requisitos funcionales

Cada requisito tiene un identificador para poder rastrearlo hasta el código y las pruebas (ver [matriz de trazabilidad](04-pruebas.md#43-trazabilidad-requisitos-pruebas)).

### Conversación

| ID | Requisito | Prioridad |
| --- | --- | --- |
| RF-01 | El visitante escribe un mensaje y recibe la respuesta **en streaming**, palabra por palabra | Alta |
| RF-02 | El visitante puede **detener** una respuesta en curso y **reintentar** si falló | Alta |
| RF-03 | El visitante puede pedir **otra respuesta** a la última pregunta | Media |
| RF-04 | Las respuestas se muestran en Markdown, con **código resaltado** (22 lenguajes) y botón **copiar** | Media |
| RF-05 | Los errores se muestran con **mensajes claros en español**, sin detalles internos | Alta |

### Historial

| ID | Requisito | Prioridad |
| --- | --- | --- |
| RF-06 | Las conversaciones se **guardan solas** y vuelven al recargar la página | Alta |
| RF-07 | El visitante puede **abrir, renombrar y borrar** conversaciones y empezar una nueva | Media |
| RF-08 | Dos pestañas abiertas no se pisan los datos entre sí | Baja |

### Archivos y enlaces

| ID | Requisito | Prioridad |
| --- | --- | --- |
| RF-09 | Adjuntar hasta **5 archivos** por mensaje (3 MB en total) arrastrando, pegando o con el clip | Alta |
| RF-10 | **PDF, imágenes y audio** se envían al modelo tal cual | Alta |
| RF-11 | **Word, Excel, PowerPoint, texto y código** se convierten a texto en el servidor | Alta |
| RF-12 | Un **enlace** a una página web o a un video de YouTube se lee y se usa en la respuesta | Media |

### Herramientas

| ID | Requisito | Prioridad |
| --- | --- | --- |
| RF-13 | El modelo puede usar una **calculadora**, la **hora** de una zona y el **clima** de una ciudad | Media |
| RF-14 | El chat **muestra qué herramienta se usó** y con qué resultado | Baja |

### Voz

| ID | Requisito | Prioridad |
| --- | --- | --- |
| RF-15 | El visitante puede **dictar** su mensaje con el micrófono | Media |
| RF-16 | El visitante puede **escuchar** cualquier respuesta, o activar **Voz** para que se lean todas y lo dictado se envíe solo | Media |

### Robot

| ID | Requisito | Prioridad |
| --- | --- | --- |
| RF-17 | El robot 3D refleja el **estado** del chat: en línea, pensando, esperando, hablando, error | Alta |
| RF-18 | El robot hace un **gesto según el contenido** de la respuesta (saluda, festeja, se encoge de hombros, asiente...) | Media |
| RF-19 | Mientras se lee una respuesta en voz alta, la **boca sigue las palabras** | Baja |
| RF-20 | El visitante **personaliza** al robot: cabeza, torso, brazos, piernas, ropa, sombrero, lentes, colores, acabado, fondo (6 escenas) y nombre; hay 10 estilos listos y un botón aleatorio | Media |
| RF-21 | Al pasar el mouse por una opción se ve una **vista previa** sin guardarla | Baja |
| RF-22 | La apariencia y el nombre **se recuerdan** entre visitas, y el modelo usa el nombre elegido | Media |

### Continuidad del servicio

| ID | Requisito | Prioridad |
| --- | --- | --- |
| RF-23 | Si un modelo falla, está ocupado o agotó su cuota, el sistema **prueba el siguiente** (cadena de respaldo Gemini, Groq) | Alta |
| RF-24 | Si no queda ninguno, o no hay clave configurada, el sistema responde en **modo demo**, avisando en cada respuesta que lo es | Alta |
| RF-25 | Un visitante no puede agotar la cuota de todos: hay un **límite de mensajes** por minuto y por día | Alta |

### Transparencia

| ID | Requisito | Prioridad |
| --- | --- | --- |
| RF-26 | La app **avisa** que los mensajes se procesan con servicios externos y tiene una página de **créditos** | Media |

## 1.4 Requisitos no funcionales

| ID | Categoría | Requisito | Cómo se cumple |
| --- | --- | --- | --- |
| RNF-01 | Rendimiento | La primera palabra de la respuesta llega en pocos segundos; ningún modelo lento bloquea el chat | Tiempo máximo de arranque por modelo (8 s, 22 s con archivos o enlaces) y modelos "en descanso" tras fallar |
| RNF-02 | Disponibilidad | El chat **nunca queda mudo** | Cadena de respaldo y modo demo como último eslabón |
| RNF-03 | Costo | Operar **sin costo** | Capas gratuitas de Gemini y Groq; voz con las APIs del navegador; clima gratuito |
| RNF-04 | Seguridad | Un visitante no puede abusar del servidor ni de la cuota | Límite por IP, topes de tamaño y cantidad, solo archivos subidos (nunca se descarga una URL elegida por el visitante), calculadora sin `eval`, imágenes remotas bloqueadas en las respuestas |
| RNF-05 | Privacidad | No se guardan datos personales en el servidor | Historial solo en el navegador; métricas sin texto ni nombres de archivo; la app avisa qué se envía a terceros |
| RNF-06 | Accesibilidad | Se puede usar con teclado y lector de pantalla, y respeta la preferencia de menos movimiento | Foco visible, roles y etiquetas, trampa de foco en diálogos, `prefers-reduced-motion`, contraste en tarjetas |
| RNF-07 | Compatibilidad | Funciona en Chrome, Edge, Firefox y Safari, en escritorio y celular | Diseño responsive; el dictado solo aparece donde el navegador lo soporta |
| RNF-08 | Robustez | El 3D es opcional | Sin WebGL, o si la GPU pierde el contexto, el chat sigue con una imagen fija del robot |
| RNF-09 | Mantenibilidad | Cambiar el código es seguro | TypeScript, ESLint, pruebas unitarias y de integración, CI en cada cambio |
| RNF-10 | Portabilidad | Se despliega en Vercel y se prueba en local sin ninguna clave | Node 20.9 o superior; sin clave arranca en modo demo |
| RNF-11 | Observabilidad | Se puede saber si lo usan y qué falla | Una línea JSON por evento en el log del servidor, sin datos personales |
| RNF-12 | Licencia | Reutilizable | Código bajo MIT; robot y fondos originales (sin imágenes de terceros) |

## 1.5 Restricciones y supuestos

- **Capa gratuita.** Cada modelo tiene una cuota diaria compartida entre todos los visitantes; por eso existe la cadena de respaldo.
- **4,5 MB por petición en Vercel.** Los archivos viajan en base64 dentro de cada mensaje, y cada turno reenvía la conversación: de ahí el tope de 3 MB y el recorte de adjuntos viejos.
- **La voz depende del navegador.** La calidad de las voces y la existencia del dictado no las controla el proyecto.
- **El límite por IP vive en memoria.** En serverless es por instancia: protege la cuota, no es un control de seguridad fuerte.
- **Supuesto:** quien usa el sitio escribe en español rioplatense o neutro; el sistema también responde en otros idiomas si se le pide.

## 1.6 Criterios de aceptación globales

El sistema se considera aceptable cuando:

1. Con una clave válida, un mensaje de texto recibe respuesta en streaming y el robot reacciona.
2. Adjuntar un PDF, una imagen, un Word y un enlace produce respuestas que usan su contenido.
3. Con todas las claves ausentes o agotadas, el chat sigue respondiendo y lo declara.
4. Sin WebGL el chat funciona igual.
5. Typecheck, lint, pruebas y build pasan en un clon limpio (lo verifica el CI).

Siguiente: [2. Análisis](02-analisis.md).
