# Clasificación de contaminación de prompts (P0.1)

> **Regla central, no negociable:**
> **SOLO los runs `clean_blind` contribuyen a la Tasa de Aparición Orgánica (TAO).**

## Por qué existe esto

Antes de P0.1, el pilar 8 promediaba todas las menciones sin distinguir si la pregunta
llevaba el nombre del negocio adentro. Con datos reales de producción, el mismo negocio
daba:

| Tipo de pregunta | Runs | Menciones | % |
|---|---|---|---|
| Con el nombre del negocio | 18 | 17 | **94.4%** |
| Ciega (pregunta real de cliente) | 18 | 0 | **0.0%** |

El producto reportaba **47%** — que es simplemente la mezcla 50/50 de las dos poblaciones.
La visibilidad orgánica real era **cero**. La métrica medía nuestro diseño de preguntas,
no al cliente.

## Las 7 clases

| Clase | Significado | ¿TAO? | ¿Reconocimiento de marca? |
|---|---|---|---|
| **`clean_blind`** | Ninguna señal de identidad del cliente | ✅ **única elegible** | ❌ |
| `weak_blind` | Señal de baja confianza o colisión semántica | ❌ | ❌ |
| `named` | Nombre comercial, legal, acrónimo o variante conocida | ❌ | ✅ |
| `domain_seeded` | El dominio del cliente aparece en el prompt | ❌ | ✅ |
| `product_seeded` | Marca o producto propio del cliente | ❌ | ✅ |
| `comparative` | Cliente + competidor en la misma pregunta | ❌ | ❌ |
| `category` | Intención de categoría — ver nota abajo | ❌ | ❌ |

### Nota sobre `category`

El pedido original define `category` como una de las 7 clases, pero también dice que una
pregunta de categoría sin señales del cliente es *"category + clean_blind"*, mientras el
TEST 4 obligatorio exige que ese caso devuelva exactamente `clean_blind`.

Son **dos dimensiones distintas** mezcladas en una lista:

- **Contaminación:** `clean_blind` · `weak_blind` · `named` · `domain_seeded` · `product_seeded` · `comparative`
- **Intención:** `category` · `general`

Se resolvió separándolas: `promptClass` es **siempre** el veredicto de contaminación, y la
intención viaja aparte en `classification.intent`. El clasificador nunca devuelve
`category` como veredicto, y la compuerta lo excluye — así la regla central queda literal:
solo `clean_blind`.

## Cómo se decide (determinista, sin LLM)

Precedencia — gana la señal **más** contaminante:

1. `comparative` — señal del cliente **y** de un competidor
2. `domain_seeded` — dominio del cliente (cubre `www.`, `https://`, `.com.mx`, subdominios)
3. `product_seeded` — marca/producto propio
4. `named` — nombre o variante con confianza alta
5. `weak_blind` — colisión semántica, o coincidencia de baja confianza sin corroborar
6. `clean_blind` — sin ninguna señal

**Prohibido usar un LLM aquí.** Si un modelo decidiera si un prompt nombra al cliente, la
garantía central dependería de una inferencia no reproducible y un fallo del modelo
volvería a contaminar la métrica.

### Sesgo deliberado: ante la duda, contamina

Un falso `weak_blind` cuesta una pregunta menos en la muestra. Un falso `clean_blind`
corrompe la métrica que le vendemos al cliente. La asimetría de daño decide.

## Mecanismos específicos

### Colisión semántica (`Farmacia Guadalajara`)

Un negocio llamado como su categoría + su ciudad es nombrado por cualquier pregunta
genérica de su rubro:

```
Cliente: "Farmacia Guadalajara"
Prompt:  "¿Qué farmacia recomiendan en Guadalajara?"   → weak_blind, NO clean_blind
```

Regla: si **todos** los tokens del nombre aparecen en el prompt (en cualquier orden), el
prompt nombra al cliente en la práctica, aunque ningún token por separado pruebe identidad.

### Stopwords de categoría — mecanismo extensible

No hay una lista arbitraria gigante. Tres fuentes, en `identity/category-stopwords.ts`:

1. **Derivada de `RUBROS`** (`question-bank/taxonomy.ts`) — los 43 rubros ya contienen las
   palabras de categoría. Agregar un rubro nuevo extiende las stopwords solo.
2. **Derivada de `clients.niche`** — el rubro en texto libre del propio cliente.
3. **Semilla estructural manual** — solo formas jurídicas, conectores y palabras de lugar
   que no aparecen en ningún rubro.

### Nombres cortos / genéricos

Comparación siempre por **tokens con límite de palabra**, nunca substring:

```
Cliente "Sol" + "¿Cuál es una solución ideal?"  → clean_blind  (sol ≠ solución)
```

Además, `requiresCorroboration()`:
- palabra común del español (`ideal`, `sol`, `central`) → **siempre** exige contexto
- token corto y **derivado** → exige contexto
- token corto y **explícito** (ej. acrónimo `UANL` que el cliente registró) → no lo exige

### Variantes explícitas vs derivadas

`client_identity_variants.source`:
- **`explicit`** — el cliente o el admin la confirmó
- **`derived`** — la dedujo el sistema (dominios de `locations`/`app_listings`, nombre de app)

Las derivadas son más propensas a falso positivo, por eso el clasificador les exige más
contexto antes de tratarlas como prueba de identidad.

## La garantía estructural

La compuerta **no depende** de que alguien recuerde filtrar. `TaoObservation`
(`lib/metrics/tao.ts`) es un tipo con marca privada que solo este módulo puede producir, y
`computeTao()` acepta exclusivamente ese tipo. Pasarle un run contaminado **no compila**.

Se refuerza con:
- `TAO_ELIGIBLE_CLASSES` — una sola constante, un solo lugar
- Test de invariante que **falla a propósito** si esa lista crece
- `prompt_class` NULL o desconocida → **no elegible** (fail-safe para el histórico)
- `mention_method === "substring_fallback"` → **no elegible** (la regla dice "ni por
  fallback, ni por substring")

## Lo que P0.1 NO resuelve

- **Ventana temporal.** `tracking_runs` se sigue leyendo entero, sin `.limit()`: el score
  arrastra el promedio de por vida y el tope de 1000 filas de PostgREST. → **P0.2**
- **`ERROR → false` en cobertura de preguntas y Google Places.** Marcado con `TODO(P0.3)`
  en el código; no se tocó para no inventar una solución parcial. → **P0.3**
- **Resolución de identidad de Google Places.** Sigue aceptando nombre + ciudad. → **P0.4**
