# Documentación de Zony Chatbot

Esta carpeta explica **qué hace** el proyecto, **por qué** está hecho así y **cómo** funciona por dentro. Está pensada para leerse en orden, de lo general a lo técnico, y cada documento se entiende solo.

| Documento | Para qué sirve | Tiene |
| --- | --- | --- |
| [1. Requisitos](01-requisitos.md) | Qué tiene que hacer el sistema y con qué condiciones | Alcance, actores, requisitos funcionales y no funcionales, restricciones, fuera de alcance |
| [2. Análisis](02-analisis.md) | Entender el problema antes de resolverlo | Casos de uso, recorrido del usuario, reglas de negocio, modelo del dominio, riesgos, alternativas descartadas |
| [3. Diseño y arquitectura](03-diseno.md) | Cómo está construido | Contexto, contenedores, componentes, secuencias, flujos, estados, clases, datos, despliegue |
| [4. Pruebas](04-pruebas.md) | Cómo se sabe que funciona | Estrategia, qué cubre cada prueba y trazabilidad con los requisitos |

## Cómo leer los diagramas

Los diagramas están escritos en [Mermaid](https://mermaid.js.org): GitHub los dibuja solo, y el texto vive junto al código (se puede revisar y versionar como cualquier archivo). Hay un diagrama de cada tipo:

| Tipo | Qué responde | Dónde |
| --- | --- | --- |
| Contexto y contenedores | ¿Con quién habla el sistema y de qué partes se compone? | [Diseño §1 y §2](03-diseno.md) |
| Casos de uso | ¿Qué puede hacer cada persona? | [Análisis §2](02-analisis.md) |
| Recorrido del usuario | ¿Cómo se siente una visita? | [Análisis §3](02-analisis.md) |
| Modelo del dominio (clases) | ¿Qué conceptos maneja el sistema? | [Análisis §5](02-analisis.md) |
| Componentes | ¿Qué módulos hay y cómo se hablan? | [Diseño §3](03-diseno.md) |
| Secuencia | ¿Qué pasa, paso a paso, cuando ocurre algo? | [Diseño §4](03-diseno.md) |
| Actividad (flujo) | ¿Qué decisiones toma el sistema? | [Diseño §5](03-diseno.md) |
| Estados | ¿En qué situaciones puede estar algo y cómo cambia? | [Diseño §6](03-diseno.md) |
| Clases (diseño) | ¿Cómo se organiza el código importante? | [Diseño §7](03-diseno.md) |
| Entidad-relación | ¿Qué datos se guardan y dónde? | [Diseño §8](03-diseno.md) |
| Despliegue | ¿Dónde corre cada cosa? | [Diseño §9](03-diseno.md) |

## En una frase

Zony es un chat de IA que responde en streaming, lee archivos y enlaces, y vive en un robot 3D personalizable que reacciona a lo que se dice. Funciona gratis sobre la capa gratuita de Gemini, con Groq de respaldo y un modo demo para que **nunca se quede mudo**.

Volver al [README principal](../README.md).
