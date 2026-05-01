# Dialect Detection Benchmark Report

- **Date**: 2026-05-01T04:22:48.619Z
- **Corpus**: /Users/simongonzalezdecruz/workspaces/DialectOS/packages/benchmarks/dialect-detection-corpus/samples.json
- **Total samples**: 250
- **Top-1 correct**: 110
- **Top-3 correct**: 137
- **Top-1 accuracy**: 44.0%
- **Top-3 accuracy**: 54.8%
- **Avg confidence**: 9.2%

## By Difficulty

| Difficulty | Top-1 Acc | Top-3 Acc | Total |
|------------|-----------|-----------|-------|
| easy | 78.7% | 89.3% | 75 |
| medium | 43.0% | 52.0% | 100 |
| hard | 10.7% | 24.0% | 75 |

## By Dialect

| Dialect | Top-1 Acc | Top-3 Acc | Total |
|---------|-----------|-----------|-------|
| es-AD | 20.0% | 20.0% | 10 |
| es-AR | 80.0% | 90.0% | 10 |
| es-BO | 50.0% | 50.0% | 10 |
| es-BZ | 50.0% | 50.0% | 10 |
| es-CL | 60.0% | 70.0% | 10 |
| es-CO | 40.0% | 60.0% | 10 |
| es-CR | 40.0% | 40.0% | 10 |
| es-CU | 50.0% | 60.0% | 10 |
| es-DO | 40.0% | 50.0% | 10 |
| es-EC | 40.0% | 50.0% | 10 |
| es-ES | 100.0% | 100.0% | 10 |
| es-GQ | 40.0% | 40.0% | 10 |
| es-GT | 40.0% | 60.0% | 10 |
| es-HN | 30.0% | 50.0% | 10 |
| es-MX | 40.0% | 60.0% | 10 |
| es-NI | 30.0% | 40.0% | 10 |
| es-PA | 20.0% | 20.0% | 10 |
| es-PE | 50.0% | 60.0% | 10 |
| es-PH | 30.0% | 30.0% | 10 |
| es-PR | 30.0% | 50.0% | 10 |
| es-PY | 30.0% | 80.0% | 10 |
| es-SV | 30.0% | 30.0% | 10 |
| es-US | 50.0% | 50.0% | 10 |
| es-UY | 50.0% | 90.0% | 10 |
| es-VE | 60.0% | 70.0% | 10 |

## Hardest Dialects

| Dialect | Top-1 Acc | Total |
|---------|-----------|-------|
| es-PA | 20.0% | 10 |
| es-AD | 20.0% | 10 |
| es-PY | 30.0% | 10 |
| es-HN | 30.0% | 10 |
| es-SV | 30.0% | 10 |

## Confusion Matrix (expected → predicted)

| Expected \ Predicted | es-AD | es-AR | es-BO | es-BZ | es-CL | es-CO | es-CR | es-CU | es-DO | es-EC | es-ES | es-GQ | es-GT | es-HN | es-MX | es-NI | es-PA | es-PE | es-PH | es-PR | es-PY | es-SV | es-US | es-UY | es-VE |
|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|
| es-AD | **2** | **1** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **7** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-AR | 0 | **8** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **2** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-BO | 0 | **2** | **5** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **3** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-BZ | 0 | 0 | 0 | **5** | 0 | 0 | 0 | 0 | 0 | 0 | **5** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-CL | 0 | 0 | 0 | 0 | **6** | 0 | 0 | 0 | 0 | 0 | **4** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-CO | 0 | 0 | 0 | 0 | 0 | **4** | 0 | 0 | 0 | 0 | **6** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-CR | 0 | 0 | 0 | 0 | 0 | 0 | **4** | 0 | 0 | 0 | **6** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-CU | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **5** | 0 | 0 | **5** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-DO | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **4** | 0 | **6** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-EC | 0 | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | **4** | **5** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-ES | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **10** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-GQ | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **6** | **4** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-GT | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **6** | 0 | **4** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-HN | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | **6** | 0 | 0 | **3** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-MX | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **6** | 0 | 0 | 0 | **4** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-NI | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **7** | 0 | 0 | 0 | 0 | **3** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-PA | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **8** | 0 | 0 | 0 | 0 | 0 | **2** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-PE | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **4** | 0 | 0 | 0 | 0 | 0 | 0 | **5** | 0 | 0 | 0 | 0 | **1** | 0 | 0 |
| es-PH | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **6** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **3** | 0 | **1** | 0 | 0 | 0 | 0 |
| es-PR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **7** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **3** | 0 | 0 | 0 | 0 | 0 |
| es-PY | 0 | **4** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **3** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **3** | 0 | 0 | 0 | 0 |
| es-SV | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **6** | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | 0 | 0 | **3** | 0 | 0 | 0 |
| es-US | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **4** | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **5** | 0 | 0 |
| es-UY | 0 | **1** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **4** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **5** | 0 |
| es-VE | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **4** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **6** |

## Misclassifications

- **es-MX** → **es-ES** (medium)
  - Text: "Pasa al auto, vamos por unos aguacates y plátanos."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-MX** → **es-ES** (medium)
  - Text: "Dejé la pluma en la habitación de la computadora."
  - Ambiguity: Input contains conflicting dialect markers (es-AR vs es-UY)
  - Matched: none

- **es-MX** → **es-ES** (medium)
  - Text: "Ese vato es bien fresa, siempre trae ropa cara."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-US)
  - Matched: none

- **es-MX** → **es-ES** (hard)
  - Text: "¿Tú sabes dónde queda la nueva tienda de celulares?"
  - Matched: none

- **es-MX** → **es-ES** (hard)
  - Text: "Voy a lavar el carro y luego paso por ti."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-GT)
  - Matched: none

- **es-MX** → **es-ES** (hard)
  - Text: "¿Quieres que prepare la cena? Ya casi es hora."
  - Matched: none

- **es-AR** → **es-ES** (medium)
  - Text: "Me da fiaca salir, prefiero quedarme en casa con maní."
  - Matched: none

- **es-AR** → **es-ES** (medium)
  - Text: "¿Vos podés pasarme el agua? Hace mucho calor hoy."
  - Ambiguity: Input contains conflicting dialect markers (es-AR vs es-UY)
  - Matched: none

- **es-CO** → **es-ES** (medium)
  - Text: "El maní está rico, dame banano y lentes para leer."
  - Matched: none

- **es-CO** → **es-ES** (medium)
  - Text: "Ese veci es mono, pero a veces es una vaina."
  - Matched: none

- **es-CO** → **es-ES** (medium)
  - Text: "Llave, préstame el esfero para la clase de matemáticas."
  - Matched: none

- **es-CO** → **es-ES** (hard)
  - Text: "¿Tú sabes si el carro ya está listo?"
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-GT)
  - Matched: none

- **es-CO** → **es-ES** (hard)
  - Text: "Voy a comprar papa para la cena de hoy."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-CO** → **es-ES** (hard)
  - Text: "¿Quieres que te acompañe a la tienda?"
  - Matched: none

- **es-CU** → **es-ES** (easy)
  - Text: "El jinetero está en la esquina con el fufú listo."
  - Ambiguity: Input contains conflicting dialect markers (es-CU vs es-GQ)
  - Matched: none

- **es-CU** → **es-ES** (medium)
  - Text: "Voy a comprar papa y habichuela para el almuerzo."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-CU** → **es-ES** (hard)
  - Text: "¿Tú sabes dónde queda la nueva tienda?"
  - Matched: none

- **es-CU** → **es-ES** (hard)
  - Text: "Dame un momento que termino esto."
  - Matched: none

- **es-CU** → **es-ES** (hard)
  - Text: "Voy a buscar el auto que dejé ayer."
  - Ambiguity: Input contains conflicting dialect markers (es-AR vs es-UY)
  - Matched: none

- **es-PE** → **es-US** (medium)
  - Text: "Ese flaco es cholo pero tiene buen corazón."
  - Matched: cholo

- **es-PE** → **es-ES** (medium)
  - Text: "Oye pe, pasa la pluma que escribo rápido."
  - Matched: none

- **es-PE** → **es-ES** (hard)
  - Text: "¿Sabes si el bus pasa por aquí?"
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-PE)
  - Matched: none

- **es-PE** → **es-ES** (hard)
  - Text: "Voy a comprar papa para hacer la cena."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-PE** → **es-ES** (hard)
  - Text: "¿Quieres que vayamos juntos al centro?"
  - Matched: none

- **es-CL** → **es-ES** (medium)
  - Text: "La raja, al tiro llego con los lentes y el maní."
  - Matched: none

- **es-CL** → **es-ES** (medium)
  - Text: "Voy a comprar poroto y frutilla para la once."
  - Matched: none

- **es-CL** → **es-ES** (hard)
  - Text: "Voy a dejar el computador en casa."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-CL)
  - Matched: none

- **es-CL** → **es-ES** (hard)
  - Text: "¿Quieres que prepare algo para comer?"
  - Matched: none

- **es-VE** → **es-ES** (easy)
  - Text: "Qué chévere, el bus trajo computadora y auto para todos."
  - Ambiguity: Input contains conflicting dialect markers (es-EC vs es-PE)
  - Matched: none

- **es-VE** → **es-ES** (medium)
  - Text: "Dame el lapicero y los lentes para leer la carta."
  - Matched: none

- **es-VE** → **es-ES** (hard)
  - Text: "¿Sabes si el carro tiene gasolina?"
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-GT)
  - Matched: none

- **es-VE** → **es-ES** (hard)
  - Text: "¿Quieres que vayamos juntos mañana?"
  - Matched: none

- **es-UY** → **es-ES** (medium)
  - Text: "Pasa los anteojos que no veo la computadora."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-UY** → **es-ES** (medium)
  - Text: "Vos sabés que esta papa está buena para el auto."
  - Ambiguity: Input contains conflicting dialect markers (es-PY vs es-AR)
  - Matched: none

- **es-UY** → **es-ES** (hard)
  - Text: "¿Sabés dónde queda la parada del colectivo?"
  - Ambiguity: Input contains conflicting dialect markers (es-AR vs es-UY)
  - Matched: none

- **es-UY** → **es-AR** (hard)
  - Text: "Cuando vengas, traé el mate que quedó en casa."
  - Matched: none

- **es-UY** → **es-ES** (hard)
  - Text: "Podés dejar el auto acá, no hay problema."
  - Ambiguity: Input contains conflicting dialect markers (es-AR vs es-UY)
  - Matched: none

- **es-PY** → **es-AR** (easy)
  - Text: "Qué tranquilopa, de balde me hallo en este al pedo."
  - Matched: none

- **es-PY** → **es-AR** (medium)
  - Text: "Ese chake está vai-vai después del gua'u."
  - Matched: none

- **es-PY** → **es-ES** (medium)
  - Text: "Pasa los anteojos que no veo el bus."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-PE)
  - Matched: none

- **es-PY** → **es-ES** (medium)
  - Text: "Vos tenés que traer la papa para el auto."
  - Ambiguity: Input contains conflicting dialect markers (es-PY vs es-AR)
  - Matched: none

- **es-PY** → **es-AR** (hard)
  - Text: "¿Sabés si hay agua en la casa?"
  - Matched: none

- **es-PY** → **es-ES** (hard)
  - Text: "Vení temprano para que no llegues tarde."
  - Matched: none

- **es-PY** → **es-AR** (hard)
  - Text: "Hacé lo que te digo y no te arrepentirás."
  - Matched: none

- **es-BO** → **es-ES** (medium)
  - Text: "Ese jichi tiene q'omer pero no quiere ch'iti."
  - Matched: none

- **es-BO** → **es-ES** (medium)
  - Text: "Pasa los lentes y el frijol para el almuerzo."
  - Matched: none

- **es-BO** → **es-AR** (hard)
  - Text: "¿Sabés dónde queda el mercado?"
  - Matched: none

- **es-BO** → **es-ES** (hard)
  - Text: "Traé la papa que dejaste en la mesa."
  - Ambiguity: Input contains conflicting dialect markers (es-AR vs es-UY)
  - Matched: none

- **es-BO** → **es-AR** (hard)
  - Text: "Andá despacio por la calle empedrada."
  - Matched: none

- **es-EC** → **es-CL** (easy)
  - Text: "El chibolo dejó el computador en el departamento con papa."
  - Matched: computador, papa, departamento

- **es-EC** → **es-ES** (medium)
  - Text: "Pasa los lentes y el banano para el almuerzo."
  - Matched: none

- **es-EC** → **es-ES** (medium)
  - Text: "Vamos en carro a buscar maní y guagua."
  - Ambiguity: Input contains conflicting dialect markers (es-CU vs es-EC)
  - Matched: none

- **es-EC** → **es-ES** (hard)
  - Text: "¿Sabes si el bus ya pasó?"
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-PE)
  - Matched: none

- **es-EC** → **es-ES** (hard)
  - Text: "Voy a dejar la computadora en casa."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-EC** → **es-ES** (hard)
  - Text: "¿Quieres que prepare algo de comer?"
  - Matched: none

- **es-GT** → **es-ES** (easy)
  - Text: "Bo, dejé la computadora en el departamento con papa."
  - Ambiguity: Input contains conflicting dialect markers (es-UY vs es-GT)
  - Matched: none

- **es-GT** → **es-ES** (medium)
  - Text: "Pasa los lentes y el frijol para la cena."
  - Matched: none

- **es-GT** → **es-ES** (medium)
  - Text: "Vamos en bus a comprar papa y plátano."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-PE)
  - Matched: none

- **es-GT** → **es-ES** (hard)
  - Text: "¿Sabes si el carro tiene gasolina?"
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-GT)
  - Matched: none

- **es-GT** → **es-ES** (hard)
  - Text: "Voy a lavar el auto antes de salir."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-GT** → **es-ES** (hard)
  - Text: "¿Quieres que vayamos temprano?"
  - Matched: none

- **es-HN** → **es-ES** (easy)
  - Text: "Dejé la computadora en el departamento con papa y frijol."
  - Ambiguity: Input contains conflicting dialect markers (es-AR vs es-UY)
  - Matched: none

- **es-HN** → **es-EC** (easy)
  - Text: "Qué chuco, el ñaño no quiere chure ni choco."
  - Matched: ñaño

- **es-HN** → **es-ES** (medium)
  - Text: "Pasa los lentes que no veo el bus."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-PE)
  - Matched: none

- **es-HN** → **es-ES** (medium)
  - Text: "Vamos en carro a buscar papa y frijol."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-GT)
  - Matched: none

- **es-HN** → **es-ES** (hard)
  - Text: "¿Sabes si ya llegó el autobús?"
  - Matched: autobús

- **es-HN** → **es-ES** (hard)
  - Text: "Voy a dejar el auto en la casa."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-HN** → **es-ES** (hard)
  - Text: "¿Quieres que prepare la cena?"
  - Matched: none

- **es-SV** → **es-ES** (easy)
  - Text: "Dejé la computadora en el departamento con papa."
  - Ambiguity: Input contains conflicting dialect markers (es-AR vs es-UY)
  - Matched: none

- **es-SV** → **es-ES** (medium)
  - Text: "Pasa los lentes y el frijol para la cena."
  - Matched: none

- **es-SV** → **es-MX** (medium)
  - Text: "El chamba trajo chivo para el pacha."
  - Matched: chamba

- **es-SV** → **es-ES** (medium)
  - Text: "Vamos en bus a buscar papa y lentes."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-PE)
  - Matched: none

- **es-SV** → **es-ES** (hard)
  - Text: "¿Sabes si el carro está listo?"
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-GT)
  - Matched: none

- **es-SV** → **es-ES** (hard)
  - Text: "Voy a lavar el auto antes de irme."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-SV** → **es-ES** (hard)
  - Text: "¿Quieres que te ayude con eso?"
  - Matched: none

- **es-NI** → **es-ES** (easy)
  - Text: "Nica, qué maje, el carro tiene pisto y cipote."
  - Ambiguity: Input contains conflicting dialect markers (es-HN vs es-NI)
  - Matched: none

- **es-NI** → **es-ES** (easy)
  - Text: "Dejé la computadora en el departamento con papa."
  - Ambiguity: Input contains conflicting dialect markers (es-AR vs es-UY)
  - Matched: none

- **es-NI** → **es-ES** (medium)
  - Text: "Pasa los lentes y el frijol para la cena."
  - Matched: none

- **es-NI** → **es-ES** (medium)
  - Text: "Vamos en bus a buscar papa y lentes."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-PE)
  - Matched: none

- **es-NI** → **es-ES** (hard)
  - Text: "¿Sabes si ya pasó el autobús?"
  - Matched: autobús

- **es-NI** → **es-ES** (hard)
  - Text: "Voy a dejar el carro en la casa."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-GT)
  - Matched: none

- **es-NI** → **es-ES** (hard)
  - Text: "¿Quieres que prepare algo de comer?"
  - Matched: none

- **es-CR** → **es-ES** (easy)
  - Text: "Dejé la computadora en el departamento con carro y papa."
  - Ambiguity: Input contains conflicting dialect markers (es-GT vs es-HN)
  - Matched: none

- **es-CR** → **es-ES** (medium)
  - Text: "Ese roine es sarasa, siempre trae jupa."
  - Matched: none

- **es-CR** → **es-ES** (medium)
  - Text: "Pasa los lentes y el frijol para la cena."
  - Matched: none

- **es-CR** → **es-ES** (hard)
  - Text: "¿Sabes si el carro tiene gasolina?"
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-GT)
  - Matched: none

- **es-CR** → **es-ES** (hard)
  - Text: "Voy a dejar el auto en la casa."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-CR** → **es-ES** (hard)
  - Text: "¿Quieres que vayamos juntos?"
  - Matched: none

- **es-PA** → **es-ES** (easy)
  - Text: "Dejé la computadora en el departamento con papa."
  - Ambiguity: Input contains conflicting dialect markers (es-AR vs es-UY)
  - Matched: none

- **es-PA** → **es-ES** (medium)
  - Text: "Ese sorrin es majare, siempre trae talla."
  - Matched: none

- **es-PA** → **es-ES** (medium)
  - Text: "Pasa los lentes y el frijol para la cena."
  - Matched: none

- **es-PA** → **es-ES** (medium)
  - Text: "El pelar trajo aju para el tongo."
  - Matched: none

- **es-PA** → **es-ES** (medium)
  - Text: "Vamos en bus a buscar papa y lentes."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-PE)
  - Matched: none

- **es-PA** → **es-ES** (hard)
  - Text: "¿Sabes si el carro está listo?"
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-GT)
  - Matched: none

- **es-PA** → **es-ES** (hard)
  - Text: "Voy a lavar el auto antes de salir."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-PA** → **es-ES** (hard)
  - Text: "¿Quieres que te acompañe?"
  - Matched: none

- **es-DO** → **es-ES** (easy)
  - Text: "Dejé la computadora en el apartamento con auto y papa."
  - Ambiguity: Input contains conflicting dialect markers (es-VE vs es-DO)
  - Matched: none

- **es-DO** → **es-ES** (medium)
  - Text: "Pasa los lentes y la habichuela para la cena."
  - Matched: none

- **es-DO** → **es-ES** (medium)
  - Text: "Vamos en bus a buscar papa y lentes."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-PE)
  - Matched: none

- **es-DO** → **es-ES** (hard)
  - Text: "¿Sabes si el auto tiene gasolina?"
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-DO** → **es-ES** (hard)
  - Text: "Voy a dejar el carro en la casa."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-GT)
  - Matched: none

- **es-DO** → **es-ES** (hard)
  - Text: "¿Quieres que prepare la cena?"
  - Matched: none

- **es-PR** → **es-ES** (easy)
  - Text: "Dejé la computadora en el apartamento con auto y papa."
  - Ambiguity: Input contains conflicting dialect markers (es-VE vs es-DO)
  - Matched: none

- **es-PR** → **es-ES** (medium)
  - Text: "Pasa los lentes y la habichuela para la cena."
  - Matched: none

- **es-PR** → **es-ES** (medium)
  - Text: "El nene trajo mami para el papi."
  - Matched: none

- **es-PR** → **es-ES** (medium)
  - Text: "Vamos en guagua a buscar papa y lentes."
  - Ambiguity: Input contains conflicting dialect markers (es-CU vs es-EC)
  - Matched: none

- **es-PR** → **es-ES** (hard)
  - Text: "¿Sabes si el auto está listo?"
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-PR** → **es-ES** (hard)
  - Text: "Voy a dejar el carro en el parking."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-GT)
  - Matched: none

- **es-PR** → **es-ES** (hard)
  - Text: "¿Quieres que vayamos juntos?"
  - Matched: none

- **es-GQ** → **es-ES** (easy)
  - Text: "Dejé la computadora en el río muni con batata."
  - Ambiguity: Input contains conflicting dialect markers (es-AR vs es-UY)
  - Matched: none

- **es-GQ** → **es-ES** (medium)
  - Text: "Pasa los lentes y la papa para la cena."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-GQ** → **es-ES** (medium)
  - Text: "Vamos en bus a buscar papa y lentes."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-PE)
  - Matched: none

- **es-GQ** → **es-ES** (hard)
  - Text: "¿Sabes si el carro tiene gasolina?"
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-GT)
  - Matched: none

- **es-GQ** → **es-ES** (hard)
  - Text: "Voy a dejar el auto en la casa."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-GQ** → **es-ES** (hard)
  - Text: "¿Quieres que prepare algo de comer?"
  - Matched: none

- **es-US** → **es-MX** (medium)
  - Text: "Ese huero es fresa, siempre trae chafa."
  - Matched: fresa

- **es-US** → **es-ES** (medium)
  - Text: "El mijo trajo mija para la raza."
  - Matched: none

- **es-US** → **es-ES** (hard)
  - Text: "¿Sabes si el carro está listo?"
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-GT)
  - Matched: none

- **es-US** → **es-ES** (hard)
  - Text: "Voy a dejar el auto en la casa."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-US** → **es-ES** (hard)
  - Text: "¿Quieres que vayamos juntos?"
  - Matched: none

- **es-PH** → **es-ES** (medium)
  - Text: "Ese kamo es mo'o, siempre trae evo."
  - Matched: none

- **es-PH** → **es-ES** (medium)
  - Text: "Pasa los lentes y la papa para la cena."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-PH** → **es-PY** (medium)
  - Text: "El jaha trajo akon para el dele."
  - Matched: jaha

- **es-PH** → **es-ES** (medium)
  - Text: "Vamos en bus a buscar papa y lentes."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-PE)
  - Matched: none

- **es-PH** → **es-ES** (hard)
  - Text: "¿Sabes si el carro tiene gasolina?"
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-GT)
  - Matched: none

- **es-PH** → **es-ES** (hard)
  - Text: "Voy a dejar el auto en la casa."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-PH** → **es-ES** (hard)
  - Text: "¿Quieres que prepare algo de comer?"
  - Matched: none

- **es-BZ** → **es-ES** (medium)
  - Text: "Pasa los lentes y la papa para la cena."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-BZ** → **es-ES** (medium)
  - Text: "Vamos en bus a buscar papa y lentes."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-PE)
  - Matched: none

- **es-BZ** → **es-ES** (hard)
  - Text: "¿Sabes si el carro está listo?"
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-GT)
  - Matched: none

- **es-BZ** → **es-ES** (hard)
  - Text: "Voy a dejar el auto en la casa."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-BZ** → **es-ES** (hard)
  - Text: "¿Quieres que vayamos juntos?"
  - Matched: none

- **es-AD** → **es-AR** (easy)
  - Text: "Qué caldea, el comú trajo parroquia y principado."
  - Matched: none

- **es-AD** → **es-ES** (medium)
  - Text: "Ese vall es pas, siempre trae madriu."
  - Matched: none

- **es-AD** → **es-ES** (medium)
  - Text: "Pasa los lentes y la papa para la cena."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-AD** → **es-ES** (medium)
  - Text: "El xaval trajo doncs para el aixo."
  - Matched: none

- **es-AD** → **es-ES** (medium)
  - Text: "Vamos en bus a buscar papa y lentes."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-PE)
  - Matched: none

- **es-AD** → **es-ES** (hard)
  - Text: "¿Sabéis si el carro está listo?"
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-GT)
  - Matched: none

- **es-AD** → **es-ES** (hard)
  - Text: "Voy a dejar el coche en la casa."
  - Matched: coche

- **es-AD** → **es-ES** (hard)
  - Text: "¿Queréis que vayamos juntos?"
  - Matched: none

