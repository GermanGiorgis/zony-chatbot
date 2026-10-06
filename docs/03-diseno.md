# 3. Diseño y arquitectura

Cómo está construido el sistema. Va de lo más general (quién habla con quién) a lo más concreto (clases y datos). Los nombres de archivos son reales: se pueden buscar en el repositorio.

## 3.1 Contexto

El sistema visto desde afuera: una aplicación web, las personas que la usan y los servicios con los que habla.

```mermaid
flowchart LR
    V(["Visitante<br/>navegador web o celular"])
    R(["Responsable del sitio"])

    subgraph Z["Zony Chatbot"]
        APP["Aplicación web<br/>Next.js en Vercel"]
    end

    GEM["Gemini<br/>IA principal, capa gratuita"]
    GRQ["Groq<br/>IA de respaldo, solo texto"]
    MET["Open-Meteo<br/>clima y ciudades"]
    YT["Páginas web y YouTube<br/>leídos por Gemini"]

    V -- "chatea, adjunta, dicta" --> APP
    APP -- "respuestas en streaming" --> V
    R -- "configura claves y lee el log" --> APP
    APP -- "conversación y archivos" --> GEM
    APP -. "si Gemini no puede" .-> GRQ
    APP -- "clima de una ciudad" --> MET
    GEM -- "lee los enlaces" --> YT
```

## 3.2 Contenedores

Las dos partes que se despliegan y el almacenamiento. No hay base de datos.

```mermaid
flowchart TB
    subgraph NAV["Navegador del visitante"]
        UI["Interfaz React<br/>chat, historial, personalizador"]
        R3D["Escena 3D<br/>React Three Fiber"]
        LS[("localStorage<br/>conversaciones, apariencia, preferencia de voz")]
        WS["Web Speech API<br/>dictado y lectura en voz alta"]
    end

    subgraph VER["Vercel"]
        API["POST /api/chat<br/>función del servidor"]
        EST["Archivos estáticos<br/>páginas, fondos, imágenes"]
    end

    EXT["Servicios externos<br/>Gemini, Groq, Open-Meteo"]

    UI <--> R3D
    UI <--> LS
    UI <--> WS
    UI -- "HTTPS, mensajes en JSON" --> API
    API -- "streaming de la respuesta" --> UI
    UI -- "carga inicial" --> EST
    API --> EXT
```

## 3.3 Componentes

### Servidor (`src/app/api` y `src/lib`)

```mermaid
flowchart LR
    ROUTE["route.ts<br/>endpoint POST"]
    RL["rate-limit.ts<br/>límite por visitante"]
    PREP["prepare.ts y documents.ts<br/>adjuntos a texto, topes"]
    INS["instructions.ts<br/>instrucciones del sistema"]
    TOOLS["tools.ts y math.ts<br/>calculadora, hora, clima"]
    MODEL["model.ts<br/>cadena de modelos con respaldo"]
    DEMO["demo.ts y demo-model.ts<br/>modo demo"]
    ERR["errors.ts<br/>mensajes en español"]
    AN["analytics.ts<br/>log sin datos personales"]

    ROUTE --> RL
    ROUTE --> PREP
    ROUTE --> INS
    ROUTE --> TOOLS
    ROUTE --> MODEL
    ROUTE --> ERR
    ROUTE --> AN
    MODEL --> DEMO
    DEMO --> TOOLS
    TOOLS --> AN
    ERR --> AN
```

| Módulo | Responsabilidad |
| --- | --- |
| `route.ts` | Orquesta cada pedido: límite, validación, preparación, elección de herramientas, llamada al modelo y devolución en streaming |
| `rate-limit.ts` | Ventana deslizante en memoria: 12 por minuto y 200 por día por visitante |
| `prepare.ts`, `documents.ts` | Convierte los adjuntos: lo nativo pasa, Office y texto se vuelven texto; aplica todos los topes |
| `instructions.ts` | Arma las instrucciones: personalidad, nombre del robot, herramientas, aviso contra instrucciones escondidas en archivos |
| `tools.ts`, `math.ts` | Herramientas de solo lectura; el evaluador matemático no usa `eval` |
| `model.ts` | Envuelve los modelos con un middleware de respaldo, tiempos de arranque y descanso |
| `demo.ts`, `demo-model.ts` | Respuestas sin IA, presentadas como un modelo más para que el resto del sistema no note la diferencia |
| `errors.ts` | Traduce errores de proveedores a mensajes claros; registra solo estado y mensaje, nunca el cuerpo del pedido |
| `analytics.ts` | Una línea JSON por evento, sin texto ni nombres de archivo |

### Navegador (`src/components` y `src/lib`)

```mermaid
flowchart LR
    CHAT["Chat.tsx<br/>orquesta la pantalla"]
    COMP["Composer<br/>texto, adjuntos, micrófono"]
    MSG["Message<br/>Markdown, código, botones"]
    HIST["History<br/>lista de conversaciones"]
    CUST["Customizer<br/>personalizador"]
    VOICE["voice.ts<br/>dictado y lectura"]
    CONV["conversations.ts<br/>historial"]
    EMO["emotion.ts<br/>gesto según el texto"]
    BUS["bus.ts<br/>eventos hacia el robot"]
    STAGE["RobotStage y Scene<br/>cámara, luces, fondo"]
    ROBOT["Robot y rig.ts<br/>cuerpo, gestos, boca"]
    APP["appearance.ts y catalog.ts<br/>apariencia"]

    CHAT --> COMP
    CHAT --> MSG
    CHAT --> HIST
    CHAT --> CUST
    CHAT --> VOICE
    CHAT --> CONV
    CHAT --> EMO
    EMO --> BUS
    VOICE --> BUS
    CHAT --> BUS
    BUS --> ROBOT
    CUST --> APP
    APP --> ROBOT
    APP --> STAGE
    STAGE --> ROBOT
```

La comunicación entre el chat y el robot pasa por `bus.ts`, un canal de eventos mínimo: el chat dice "hacé este gesto", "mirá hacia acá" o "abrí la boca"; el robot no sabe nada del chat. Así el 3D se puede apagar sin tocar la lógica.

## 3.4 Secuencias

### a) Un mensaje de texto

```mermaid
sequenceDiagram
    actor V as Visitante
    participant UI as Chat.tsx
    participant R as route.ts
    participant P as prepare.ts
    participant M as Cadena de modelos
    participant G as Gemini
    participant B as Robot

    V->>UI: escribe y envía
    UI->>B: orientarse y asentir
    UI->>UI: recorta adjuntos viejos si hace falta
    UI->>R: POST con los mensajes y el nombre
    R->>R: límite de uso, tamaño y formato
    R->>P: prepara adjuntos y recorta el historial
    R->>R: elige herramientas, registra el evento
    R->>M: streamText con instrucciones y herramientas
    M->>G: pide la respuesta
    loop mientras llega la respuesta
        G-->>M: fragmento de texto
        M-->>R: fragmento
        R-->>UI: fragmento en streaming
        UI-->>V: muestra el texto
    end
    UI->>B: gesto según la primera frase
    UI->>UI: guarda la conversación
```

### b) Cuando un modelo falla

```mermaid
sequenceDiagram
    participant R as route.ts
    participant M as Cadena de modelos
    participant G1 as Gemini 1
    participant G2 as Gemini 2
    participant Q as Groq
    participant D as Modo demo

    R->>M: pide la respuesta
    M->>G1: intento 1, con tiempo máximo
    G1-->>M: error 429, cuota agotada
    M->>M: marca a Gemini 1 en descanso
    M->>G2: intento 2
    G2-->>M: sin respuesta a tiempo
    M->>M: marca a Gemini 2 en descanso
    M->>Q: intento 3
    Q-->>M: error 429
    M->>D: último recurso, nunca falla
    D-->>R: respuesta de ejemplo, avisando que es demo
```

Los modelos en descanso pasan al final de la cadena en los pedidos siguientes, así que la persona no vuelve a esperar por ellos.

### c) Un archivo adjunto

```mermaid
sequenceDiagram
    actor V as Visitante
    participant C as Composer
    participant A as attachments.ts
    participant R as route.ts
    participant P as prepare.ts
    participant D as documents.ts
    participant G as Gemini

    V->>C: adjunta archivos y envía
    C->>A: valida cantidad, tamaño y tipo
    A-->>C: aceptados y rechazados con motivo
    C->>R: POST con los archivos en base64
    R->>P: prepara cada archivo
    alt PDF, imagen o audio
        P->>P: lo deja pasar tal cual
    else Word, Excel, PowerPoint o texto
        P->>D: extrae el texto
        D-->>P: texto, con tope de caracteres
    else vacío, demasiado grande o no soportado
        P->>P: lo reemplaza por una nota explicativa
    end
    P-->>R: mensajes listos
    R->>G: conversación con los archivos
    G-->>V: respuesta que usa el contenido
```

### d) Voz: dictar y escuchar

```mermaid
sequenceDiagram
    actor V as Visitante
    participant UI as Chat.tsx
    participant W as voice.ts
    participant SR as Reconocimiento del navegador
    participant TTS as Síntesis del navegador
    participant B as Robot

    V->>UI: toca el micrófono
    UI->>W: empezar a escuchar
    W->>SR: start, idioma es-AR
    loop mientras habla
        SR-->>W: palabras parciales
        W-->>UI: rellena el cuadro de texto
    end
    SR-->>W: frase final
    alt Voz activada
        W-->>UI: envía el mensaje solo
    else
        W-->>UI: deja el texto para editarlo
    end
    Note over UI: llega la respuesta completa
    UI->>W: speak con el texto de la respuesta
    W->>W: limpia el Markdown, parte en frases, elige la voz
    loop por cada frase
        W->>TTS: pronunciar
        TTS-->>W: llegó una palabra
        W-->>B: abrir la boca
    end
```

## 3.5 Flujos de decisión

### El pedido a `/api/chat`

```mermaid
flowchart TD
    A(["Llega un POST"]) --> B{"¿Hay clave de IA?"}
    B -- "no" --> B1["Usa el modo demo"]
    B -- "sí" --> C
    B1 --> C{"¿Supera el límite<br/>de mensajes?"}
    C -- "sí" --> C1(["429: esperá N segundos"])
    C -- "no" --> D{"¿El cuerpo es demasiado grande<br/>o tiene formato inválido?"}
    D -- "sí" --> D1(["413 o 400 con mensaje claro"])
    D -- "no" --> E["Prepara adjuntos y recorta el historial"]
    E --> F{"¿El último mensaje<br/>trae un enlace?"}
    F -- "sí" --> F1["Lectura de enlaces de Gemini"]
    F -- "no" --> G{"¿Búsqueda web activada?"}
    G -- "sí" --> G1["Búsqueda de Google"]
    G -- "no" --> G2["Herramientas propias:<br/>calculadora, hora, clima"]
    F1 --> H
    G1 --> H
    G2 --> H["Llama a la cadena de modelos"]
    H --> I(["Respuesta en streaming"])
```

### La cadena de respaldo

```mermaid
flowchart TD
    A(["Pedido al modelo"]) --> B["Ordena: primero los disponibles,<br/>después los que descansan, el demo al final"]
    B --> C{"¿El pedido trae archivos<br/>o enlaces?"}
    C -- "sí" --> C1["Saca a Groq de la cadena"]
    C -- "no" --> D
    C1 --> D["Toma el próximo modelo"]
    D --> E{"¿Es el demo?"}
    E -- "sí" --> E1(["Responde el demo"])
    E -- "no" --> F["Lo intenta con tiempo máximo:<br/>8 s, o 22 s si trae archivos"]
    F --> G{"¿Empezó a responder?"}
    G -- "sí" --> G1["Lo saca del descanso"] --> H(["Streaming de la respuesta"])
    G -- "no" --> I{"¿Error que justifica<br/>probar otro?<br/>429, 5xx, 404, tiempo"}
    I -- "no, por ejemplo 400" --> I1(["Devuelve el error"])
    I -- "sí" --> J["Lo pone en descanso:<br/>30 s, 2 min o 30 min según el error"]
    J --> D
```

### Preparación de cada adjunto

```mermaid
flowchart TD
    A(["Un archivo del mensaje"]) --> B{"¿Pasa de 5 archivos<br/>en el mensaje?"}
    B -- "sí" --> B1["Nota: se omitió"]
    B -- "no" --> C{"¿Viene en el mensaje<br/>y no es una URL externa?"}
    C -- "no" --> C1["Nota: se omitió"]
    C -- "sí" --> D{"¿Pesa más de 3 MB<br/>o supera el total?"}
    D -- "sí" --> D1["Nota: demasiado grande"]
    D -- "no" --> E{"¿Qué tipo es?"}
    E -- "PDF, imagen, audio" --> E1["Pasa al modelo tal cual"]
    E -- "Word, Excel, PowerPoint, texto" --> E2["Extrae texto y lo recorta"]
    E -- "otro" --> E3["Nota: formato no soportado"]
    E2 --> F{"¿Quedó vacío?"}
    F -- "sí" --> F1["Nota: archivo vacío"]
    F -- "no" --> F2["Texto al modelo"]
```

## 3.6 Estados

### El robot

El estado del chat se traduce al estado del robot. Los gestos puntuales (saludar, festejar...) se superponen a estos estados.

```mermaid
stateDiagram-v2
    [*] --> idle
    state "En línea" as idle
    state "Pensando" as thinking
    state "Esperando" as waiting
    state "Hablando" as talking
    state "Error" as error

    idle --> thinking: el visitante envía un mensaje
    thinking --> talking: llega la primera palabra
    thinking --> waiting: pasan 8 segundos sin respuesta
    waiting --> talking: llega la primera palabra
    waiting --> error: falla la respuesta
    thinking --> error: falla la respuesta
    talking --> idle: termina la respuesta y la lectura en voz alta
    talking --> error: se corta la respuesta
    error --> idle: el visitante reintenta o escribe de nuevo
    idle --> talking: lee una respuesta en voz alta
```

### El pedido de respuesta (estado del chat)

```mermaid
stateDiagram-v2
    [*] --> ready
    state "Listo" as ready
    state "Enviado" as submitted
    state "Respondiendo" as streaming
    state "Con error" as failed

    ready --> submitted: envía un mensaje o pide otra respuesta
    submitted --> streaming: llega el primer fragmento
    streaming --> ready: termina
    submitted --> failed: falla antes de empezar
    streaming --> failed: se corta
    submitted --> ready: el visitante detiene
    streaming --> ready: el visitante detiene
    failed --> submitted: reintenta
    failed --> ready: escribe otra cosa
```

### El dictado

```mermaid
stateDiagram-v2
    [*] --> parado
    state "Parado" as parado
    state "Escuchando" as escuchando
    state "Procesando" as procesando

    parado --> escuchando: toca el micrófono
    escuchando --> procesando: deja de hablar o toca de nuevo
    escuchando --> parado: error de permiso o de micrófono
    procesando --> parado: entrega la frase final
    parado --> [*]
```

### Un modelo de la cadena

```mermaid
stateDiagram-v2
    [*] --> disponible
    state "Disponible" as disponible
    state "En descanso" as descanso

    disponible --> descanso: falla, está ocupado o agotó la cuota
    descanso --> disponible: pasa el tiempo de descanso o responde bien una vez
```

## 3.7 Clases y módulos clave

Cómo se organiza el código de la cadena de modelos y las herramientas.

```mermaid
classDiagram
    direction TB
    class ChatBackend {
        <<tipo>>
        kind: google, gateway o demo
        model
    }
    class getBackend {
        <<función>>
        lee las variables de entorno
        arma la cadena de modelos
    }
    class FallbackMiddleware {
        <<middleware>>
        cooling: modelos en descanso
        wrapStream
        wrapGenerate
        run: recorre la cadena
    }
    class LanguageModel {
        <<interfaz del AI SDK>>
        doStream
        doGenerate
    }
    class GeminiModel
    class GroqModel
    class DemoModel {
        provider: zony-demo
        doStream
        doGenerate
    }
    class demoAnswer {
        <<función>>
        calcula, hora, clima
        respuestas de ejemplo
    }
    class Tool {
        <<AI SDK>>
        descripcion
        esquema de entrada
        execute
    }
    class calculadora
    class horaActual
    class clima

    getBackend --> ChatBackend : devuelve
    ChatBackend --> FallbackMiddleware : envuelve el modelo con
    FallbackMiddleware o-- LanguageModel : recorre
    LanguageModel <|.. GeminiModel
    LanguageModel <|.. GroqModel
    LanguageModel <|.. DemoModel
    DemoModel --> demoAnswer : usa
    Tool <|-- calculadora
    Tool <|-- horaActual
    Tool <|-- clima
    demoAnswer ..> calculadora : misma lógica
    demoAnswer ..> horaActual : misma lógica
    demoAnswer ..> clima : misma lógica
```

La idea clave: el modo demo es **un modelo más** que cumple la misma interfaz que Gemini y Groq. Para el resto del sistema (streaming, interfaz, robot, voz) no hay diferencia entre una respuesta real y una de demo.

## 3.8 Datos

No hay base de datos: todo lo persistente vive en el `localStorage` del navegador de cada persona. Esto es lo que se guarda:

```mermaid
erDiagram
    ALMACENAMIENTO_LOCAL ||--o{ CONVERSACION : "zony-conversations-v1"
    ALMACENAMIENTO_LOCAL ||--|| CONVERSACION_ACTIVA : "zony-active-conversation"
    ALMACENAMIENTO_LOCAL ||--|| APARIENCIA : "zony-appearance-v2"
    ALMACENAMIENTO_LOCAL ||--|| PREFERENCIA_DE_VOZ : "zony-voice-replies"
    CONVERSACION ||--o{ MENSAJE : contiene
    MENSAJE ||--o{ PARTE : "se compone de"
    CONVERSACION_ACTIVA }o--|| CONVERSACION : "apunta a"

    CONVERSACION {
        string id
        string titulo
        number updatedAt
        boolean custom "renombrada a mano"
    }
    MENSAJE {
        string id
        string role "user o assistant"
    }
    PARTE {
        string type "texto, archivo o herramienta"
        string contenido "texto, o solo el nombre si es un archivo"
    }
    APARIENCIA {
        string cabeza
        string torso
        string brazos
        string piernas
        string ropa
        string sombrero
        string lentes
        string colores "carcasa, musculos, metal, luz"
        string acabado
        string fondo
        string movimiento
        string nombre
    }
    PREFERENCIA_DE_VOZ {
        boolean activada
    }
```

| Dato | Detalle |
| --- | --- |
| Conversaciones | Hasta 60; título de 60 caracteres como máximo; los adjuntos no se guardan, solo una marca con el nombre |
| Apariencia | Se valida al leerla: un valor desconocido o un color inválido vuelve al valor por defecto |
| Sincronización entre pestañas | Un evento `storage` hace que cada pestaña vuelva a leer antes de escribir, para no pisarse |
| Si el almacenamiento falla | La app sigue funcionando y avisa una vez bajo el cuadro de texto |
| En el servidor | Solo un contador en memoria para el límite de mensajes; nada de contenido |

## 3.9 Despliegue

```mermaid
flowchart LR
    DEV["Desarrollo<br/>npm run dev"]
    GH["GitHub<br/>repositorio zony-chatbot"]
    CI["GitHub Actions<br/>typecheck, lint, pruebas, build"]

    subgraph VERCEL["Vercel"]
        BUILD["Compilación de Next.js"]
        FN["Función /api/chat<br/>hasta 60 s por respuesta"]
        CDN["Red de distribución<br/>páginas y fondos"]
        ENV[("Variables de entorno<br/>claves de Gemini y Groq")]
    end

    USR(["Visitante"])
    EXT["Gemini, Groq, Open-Meteo"]

    DEV -- "git push" --> GH
    GH --> CI
    GH -- "cada push a main" --> BUILD
    BUILD --> FN
    BUILD --> CDN
    ENV --> FN
    USR --> CDN
    USR --> FN
    FN --> EXT
```

| Pieza | Detalle |
| --- | --- |
| Variables | `GOOGLE_GENERATIVE_AI_API_KEY` y, opcional, `GROQ_API_KEY`. Sin ellas el sitio arranca en modo demo. Lista completa en `.env.example` |
| Límite de Vercel | Cuerpo de petición de 4,5 MB: de ahí el tope de 3 MB en adjuntos |
| Duración | La función puede tardar hasta 60 s en responder (`maxDuration`) |
| Lo que no se despliega | Las imágenes originales, los datos del entorno local y los archivos de trabajo (`.gitignore`) |

## 3.10 Cómo se dibuja el robot

Un recorrido por el flujo del 3D, para quien quiera entender cómo "vive" el robot.

```mermaid
flowchart LR
    CAT["catalog.ts<br/>opciones: partes, colores, fondos"] --> APP["appearance.ts<br/>apariencia validada y guardada"]
    APP --> ROBOT["Robot.tsx<br/>arma el cuerpo con piezas procedurales"]
    ROBOT --> RIG["rig.ts<br/>resortes, gestos, boca y parpadeo"]
    BUS["bus.ts<br/>gestos, atención, voz"] --> RIG
    MOOD["Estado del chat"] --> RIG
    RIG --> FRAME["Un cuadro de animación"]
    SCN["Scene.tsx<br/>fondo, luces, reflejos, sombra"] --> FRAME
    CAM["Cámara en RobotStage.tsx<br/>encuadre y parallax"] --> FRAME
    FRAME --> BLOOM["Brillo de neón"]
    BLOOM --> PANT(["Pantalla"])
    FALLBACK["Sin WebGL o contexto perdido"] -. "imagen fija" .-> PANT
```

- **Piezas procedurales:** el cuerpo es geometría generada en código (perfiles de revolución y mallas esculpidas), no un modelo descargado.
- **Fondo dentro de la escena:** la imagen del fondo está detrás del robot y una versión diminuta de la misma sirve de mapa de entorno, así los neones se reflejan en sus piezas brillantes.
- **Los fondos** los dibuja `scripts/build-scenes.mjs`: proyecta neones, anillos y pisos con una cámara en perspectiva (horizonte al centro, altura de ojo de la cámara del 3D) y los guarda como imágenes.

Siguiente: [4. Pruebas](04-pruebas.md).
