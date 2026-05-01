# Dialect Detection Benchmark Report

- **Date**: 2026-05-01T03:33:14.894Z
- **Corpus**: /Users/simongonzalezdecruz/workspaces/DialectOS/packages/benchmarks/dialect-detection-corpus/samples.json
- **Total samples**: 250
- **Top-1 correct**: 53
- **Top-3 correct**: 96
- **Top-1 accuracy**: 21.2%
- **Top-3 accuracy**: 38.4%
- **Avg confidence**: 12.7%

## By Difficulty

| Difficulty | Top-1 Acc | Top-3 Acc | Total |
|------------|-----------|-----------|-------|
| easy | 50.7% | 76.0% | 75 |
| medium | 11.0% | 23.0% | 100 |
| hard | 5.3% | 21.3% | 75 |

## By Dialect

| Dialect | Top-1 Acc | Top-3 Acc | Total |
|---------|-----------|-----------|-------|
| es-AD | 20.0% | 20.0% | 10 |
| es-AR | 30.0% | 80.0% | 10 |
| es-BO | 20.0% | 30.0% | 10 |
| es-BZ | 30.0% | 40.0% | 10 |
| es-CL | 30.0% | 60.0% | 10 |
| es-CO | 20.0% | 40.0% | 10 |
| es-CR | 10.0% | 10.0% | 10 |
| es-CU | 10.0% | 40.0% | 10 |
| es-DO | 10.0% | 10.0% | 10 |
| es-EC | 10.0% | 20.0% | 10 |
| es-ES | 70.0% | 80.0% | 10 |
| es-GQ | 40.0% | 40.0% | 10 |
| es-GT | 10.0% | 40.0% | 10 |
| es-HN | 10.0% | 30.0% | 10 |
| es-MX | 20.0% | 40.0% | 10 |
| es-NI | 10.0% | 20.0% | 10 |
| es-PA | 20.0% | 20.0% | 10 |
| es-PE | 10.0% | 40.0% | 10 |
| es-PH | 30.0% | 30.0% | 10 |
| es-PR | 10.0% | 30.0% | 10 |
| es-PY | 10.0% | 70.0% | 10 |
| es-SV | 10.0% | 10.0% | 10 |
| es-US | 30.0% | 50.0% | 10 |
| es-UY | 40.0% | 80.0% | 10 |
| es-VE | 20.0% | 30.0% | 10 |

## Hardest Dialects

| Dialect | Top-1 Acc | Total |
|---------|-----------|-------|
| es-CU | 10.0% | 10 |
| es-PE | 10.0% | 10 |
| es-PY | 10.0% | 10 |
| es-EC | 10.0% | 10 |
| es-GT | 10.0% | 10 |

## Confusion Matrix (expected → predicted)

| Expected \ Predicted | es-AD | es-AR | es-BO | es-BZ | es-CL | es-CO | es-CR | es-CU | es-DO | es-EC | es-ES | es-GQ | es-GT | es-HN | es-MX | es-NI | es-PA | es-PE | es-PH | es-PR | es-PY | es-SV | es-US | es-UY | es-VE |
|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|
| es-AD | **2** | **1** | 0 | 0 | 0 | 0 | 0 | **1** | 0 | 0 | **5** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | 0 | 0 | 0 |
| es-AR | 0 | **3** | 0 | 0 | **1** | 0 | 0 | **1** | 0 | 0 | **2** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **3** | 0 |
| es-BO | 0 | **1** | **2** | 0 | **1** | 0 | 0 | 0 | 0 | 0 | **6** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-BZ | 0 | 0 | 0 | **3** | 0 | 0 | 0 | 0 | 0 | 0 | **6** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | 0 | 0 | 0 |
| es-CL | 0 | 0 | 0 | 0 | **3** | 0 | 0 | **1** | 0 | 0 | **3** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **3** | 0 |
| es-CO | 0 | 0 | 0 | 0 | 0 | **2** | 0 | **1** | 0 | 0 | **5** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | **1** |
| es-CR | 0 | 0 | 0 | 0 | 0 | 0 | **1** | 0 | 0 | 0 | **7** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | 0 | **1** | 0 |
| es-CU | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | 0 | 0 | **7** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **2** | 0 |
| es-DO | 0 | **1** | 0 | 0 | 0 | 0 | 0 | 0 | **1** | 0 | **6** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **2** | 0 |
| es-EC | 0 | **1** | 0 | 0 | 0 | 0 | 0 | **1** | 0 | **1** | **4** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **3** | 0 |
| es-ES | 0 | 0 | 0 | 0 | **1** | 0 | 0 | **1** | 0 | 0 | **7** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | 0 |
| es-GQ | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **5** | **4** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | 0 |
| es-GT | 0 | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | 0 | **4** | 0 | **1** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | 0 | **3** | 0 |
| es-HN | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | 0 | **1** | **6** | 0 | 0 | **1** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | 0 |
| es-MX | 0 | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | 0 | **4** | 0 | 0 | 0 | **2** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | **2** | 0 |
| es-NI | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **7** | 0 | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **2** | 0 |
| es-PA | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **7** | 0 | 0 | 0 | 0 | 0 | **2** | 0 | 0 | 0 | 0 | 0 | 0 | **1** | 0 |
| es-PE | 0 | 0 | 0 | 0 | **1** | 0 | 0 | **1** | 0 | 0 | **5** | 0 | 0 | 0 | 0 | 0 | 0 | **1** | 0 | 0 | 0 | **1** | **1** | 0 | 0 |
| es-PH | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **6** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **3** | 0 | **1** | 0 | 0 | 0 | 0 |
| es-PR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | 0 | **1** | **4** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | 0 | **1** | 0 | **2** | 0 |
| es-PY | 0 | **4** | 0 | 0 | 0 | 0 | 0 | **1** | 0 | 0 | **3** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | 0 | 0 | **1** | 0 |
| es-SV | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **7** | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | 0 | 0 | **1** | 0 | **1** | 0 |
| es-US | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **6** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | **3** | 0 | 0 |
| es-UY | 0 | 0 | 0 | 0 | **1** | 0 | 0 | **2** | 0 | 0 | **3** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **4** | 0 |
| es-VE | 0 | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | 0 | **5** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **2** | **2** |

## Misclassifications

- **es-ES** → **es-CL** (medium)
  - Text: "El frigorífico está vacío, vamos a currar un poco y luego comemos."
  - Matched: po

- **es-ES** → **es-UY** (medium)
  - Text: "Mi móvil no funciona, ¿me prestas el tuyo?"
  - Matched: ta

- **es-ES** → **es-CU** (hard)
  - Text: "¿Queréis tomar algo? Hay cerveza en la nevera."
  - Matched: ma

- **es-MX** → **es-ES** (easy)
  - Text: "Voy a rentar un departamento cerca del estacionamiento del camión."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-UY)
  - Matched: none

- **es-MX** → **es-ES** (medium)
  - Text: "Pasa al auto, vamos por unos aguacates y plátanos."
  - Ambiguity: Input contains conflicting dialect markers (es-CL vs es-UY)
  - Matched: none

- **es-MX** → **es-UY** (medium)
  - Text: "Dejé la pluma en la habitación de la computadora."
  - Matched: computadora, ta

- **es-MX** → **es-US** (medium)
  - Text: "Ese vato es bien fresa, siempre trae ropa cara."
  - Matched: vato

- **es-MX** → **es-UY** (medium)
  - Text: "Estoy crudo después de la fiesta, ¿me das un jugo?"
  - Matched: ta

- **es-MX** → **es-ES** (hard)
  - Text: "¿Tú sabes dónde queda la nueva tienda de celulares?"
  - Matched: none

- **es-MX** → **es-CL** (hard)
  - Text: "Voy a lavar el carro y luego paso por ti."
  - Matched: po

- **es-MX** → **es-ES** (hard)
  - Text: "¿Quieres que prepare la cena? Ya casi es hora."
  - Matched: none

- **es-AR** → **es-UY** (easy)
  - Text: "Vos sabés que esta computadora está en el departamento del pibe."
  - Matched: vos, computadora, departamento, ta

- **es-AR** → **es-UY** (easy)
  - Text: "Qué quilombo, no tengo ni una moneda de guita para morfar."
  - Matched: bo, ta

- **es-AR** → **es-ES** (medium)
  - Text: "La mina se fue en auto después de comprar la remera."
  - Ambiguity: Input contains conflicting dialect markers (es-AR vs es-UY)
  - Matched: none

- **es-AR** → **es-ES** (medium)
  - Text: "Este poroto está re piola, y la frutilla también."
  - Ambiguity: Input contains conflicting dialect markers (es-CL vs es-UY)
  - Matched: none

- **es-AR** → **es-CU** (medium)
  - Text: "Me da fiaca salir, prefiero quedarme en casa con maní."
  - Matched: ma

- **es-AR** → **es-CL** (medium)
  - Text: "¿Vos podés pasarme el agua? Hace mucho calor hoy."
  - Matched: po

- **es-AR** → **es-UY** (hard)
  - Text: "¿Sabés dónde queda la estación de tren?"
  - Matched: ta

- **es-CO** → **es-VE** (easy)
  - Text: "Pilas, pana, que el bus ya llegó al apartamento."
  - Matched: bus, apartamento, pana

- **es-CO** → **es-CU** (medium)
  - Text: "El maní está rico, dame banano y lentes para leer."
  - Matched: ma

- **es-CO** → **es-ES** (medium)
  - Text: "Ese veci es mono, pero a veces es una vaina."
  - Matched: none

- **es-CO** → **es-UY** (medium)
  - Text: "Vamos a tomar guaro, tengo guayabo de la fiesta."
  - Matched: bo, ta

- **es-CO** → **es-ES** (medium)
  - Text: "Llave, préstame el esfero para la clase de matemáticas."
  - Ambiguity: Input contains conflicting dialect markers (es-CU vs es-UY)
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

- **es-CU** → **es-UY** (easy)
  - Text: "Qué bola, acere, ¿tienes la computadora en el apartamento?"
  - Matched: computadora, bo, ta

- **es-CU** → **es-ES** (easy)
  - Text: "El jinetero está en la esquina con el fufú listo."
  - Ambiguity: Input contains conflicting dialect markers (es-CU vs es-GQ)
  - Matched: none

- **es-CU** → **es-ES** (medium)
  - Text: "Pasa la grifo que hace calor, socio."
  - Matched: none

- **es-CU** → **es-UY** (medium)
  - Text: "Ese temba sabe pinchar bien en la fiesta."
  - Matched: ta

- **es-CU** → **es-ES** (medium)
  - Text: "Voy a comprar papa y habichuela para el almuerzo."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-CU** → **es-ES** (medium)
  - Text: "Ma, préstame el carro para ir al trabajo."
  - Ambiguity: Input contains conflicting dialect markers (es-CU vs es-UY)
  - Matched: none

- **es-CU** → **es-ES** (hard)
  - Text: "¿Tú sabes dónde queda la nueva tienda?"
  - Matched: none

- **es-CU** → **es-ES** (hard)
  - Text: "Dame un momento que termino esto."
  - Matched: none

- **es-CU** → **es-ES** (hard)
  - Text: "Voy a buscar el auto que dejé ayer."
  - Ambiguity: Input contains conflicting dialect markers (es-PY vs es-BO)
  - Matched: none

- **es-PE** → **es-ES** (easy)
  - Text: "Causa, esta computadora está en el departamento con auto."
  - Ambiguity: Input contains conflicting dialect markers (es-PE vs es-UY)
  - Matched: none

- **es-PE** → **es-ES** (easy)
  - Text: "Qué bro, el chibolo se fue al chifa con el poto sucio."
  - Ambiguity: Input contains conflicting dialect markers (es-PE vs es-CL)
  - Matched: none

- **es-PE** → **es-ES** (medium)
  - Text: "Vamos al huarique, traé tu chela y los lentes."
  - Ambiguity: Input contains conflicting dialect markers (es-AR vs es-UY)
  - Matched: none

- **es-PE** → **es-ES** (medium)
  - Text: "El chapo trajo maní y frutilla para todos."
  - Ambiguity: Input contains conflicting dialect markers (es-CU vs es-CL)
  - Matched: none

- **es-PE** → **es-US** (medium)
  - Text: "Ese flaco es cholo pero tiene buen corazón."
  - Matched: cholo

- **es-PE** → **es-CU** (medium)
  - Text: "Oye pe, pasa la pluma que escribo rápido."
  - Matched: ma

- **es-PE** → **es-CL** (hard)
  - Text: "¿Sabes si el bus pasa por aquí?"
  - Matched: po

- **es-PE** → **es-ES** (hard)
  - Text: "Voy a comprar papa para hacer la cena."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-PE** → **es-SV** (hard)
  - Text: "¿Quieres que vayamos juntos al centro?"
  - Matched: vaya

- **es-CL** → **es-UY** (easy)
  - Text: "Qué bacán, el pololo me invitó palta y choclo."
  - Matched: ta

- **es-CL** → **es-UY** (medium)
  - Text: "Esa mina es flaite, siempre anda con liantas."
  - Matched: ta

- **es-CL** → **es-CU** (medium)
  - Text: "La raja, al tiro llego con los lentes y el maní."
  - Matched: ma

- **es-CL** → **es-ES** (medium)
  - Text: "¡Chucha! Se me olvidó el auto en la calle."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-CL** → **es-ES** (hard)
  - Text: "¿Sabes si hay caleta por aquí?"
  - Ambiguity: Input contains conflicting dialect markers (es-CL vs es-UY)
  - Matched: none

- **es-CL** → **es-UY** (hard)
  - Text: "Voy a dejar el computador en casa."
  - Matched: ta

- **es-CL** → **es-ES** (hard)
  - Text: "¿Quieres que prepare algo para comer?"
  - Matched: none

- **es-VE** → **es-ES** (easy)
  - Text: "Qué chévere, el bus trajo computadora y auto para todos."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-UY)
  - Matched: none

- **es-VE** → **es-ES** (easy)
  - Text: "Arrecho, ese pajúo sifrino no sabe nada de guarapo."
  - Ambiguity: Input contains conflicting dialect markers (es-CL vs es-VE)
  - Matched: none

- **es-VE** → **es-CL** (medium)
  - Text: "Voy a la porra con el chimbo de morrocoy."
  - Matched: po

- **es-VE** → **es-UY** (medium)
  - Text: "Dame el lapicero y los lentes para leer la carta."
  - Matched: ta

- **es-VE** → **es-UY** (medium)
  - Text: "Ese ladilla no quiere comer caraota con papa."
  - Matched: papa, ta

- **es-VE** → **es-ES** (hard)
  - Text: "¿Sabes si el carro tiene gasolina?"
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-GT)
  - Matched: none

- **es-VE** → **es-ES** (hard)
  - Text: "Voy a buscar el auto que dejé en el parqueo."
  - Ambiguity: Input contains conflicting dialect markers (es-PY vs es-BO)
  - Matched: none

- **es-VE** → **es-ES** (hard)
  - Text: "¿Quieres que vayamos juntos mañana?"
  - Ambiguity: Input contains conflicting dialect markers (es-CU vs es-SV)
  - Matched: none

- **es-UY** → **es-CU** (easy)
  - Text: "Qué fiaca, el payador no vino al fogón con mate."
  - Matched: ma

- **es-UY** → **es-CL** (medium)
  - Text: "La gurisa trajo frutilla y poroto para el chajá."
  - Matched: po

- **es-UY** → **es-ES** (medium)
  - Text: "Ese karai tiene mufa, siempre pierde en la changa."
  - Matched: none

- **es-UY** → **es-ES** (hard)
  - Text: "¿Sabés dónde queda la parada del colectivo?"
  - Ambiguity: Input contains conflicting dialect markers (es-AR vs es-UY)
  - Matched: none

- **es-UY** → **es-CU** (hard)
  - Text: "Cuando vengas, traé el mate que quedó en casa."
  - Matched: ma

- **es-UY** → **es-ES** (hard)
  - Text: "Podés dejar el auto acá, no hay problema."
  - Ambiguity: Input contains conflicting dialect markers (es-CU vs es-CL)
  - Matched: none

- **es-PY** → **es-ES** (easy)
  - Text: "Che, vos sabés que el chipa y el terere son lo mejor."
  - Ambiguity: Input contains conflicting dialect markers (es-AR vs es-UY)
  - Matched: none

- **es-PY** → **es-AR** (easy)
  - Text: "Qué tranquilopa, de balde me hallo en este al pedo."
  - Matched: none

- **es-PY** → **es-CU** (medium)
  - Text: "El jagua trajo maní y frutilla para el jopara."
  - Matched: ma

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

- **es-PY** → **es-UY** (hard)
  - Text: "Vení temprano para que no llegues tarde."
  - Matched: ta

- **es-PY** → **es-AR** (hard)
  - Text: "Hacé lo que te digo y no te arrepentirás."
  - Matched: none

- **es-BO** → **es-ES** (easy)
  - Text: "El cholita dejó la computadora en el departamento del joven."
  - Ambiguity: Input contains conflicting dialect markers (es-UY vs es-BO)
  - Matched: none

- **es-BO** → **es-ES** (easy)
  - Text: "Qué pucha, el chango no quiere llajwa con papa."
  - Ambiguity: Input contains conflicting dialect markers (es-AR vs es-UY)
  - Matched: none

- **es-BO** → **es-ES** (medium)
  - Text: "Ese jichi tiene q'omer pero no quiere ch'iti."
  - Matched: none

- **es-BO** → **es-ES** (medium)
  - Text: "Pasa los lentes y el frijol para el almuerzo."
  - Matched: none

- **es-BO** → **es-ES** (medium)
  - Text: "Vos sabés que el auto está en el qhatu."
  - Ambiguity: Input contains conflicting dialect markers (es-AR vs es-UY)
  - Matched: none

- **es-BO** → **es-AR** (hard)
  - Text: "¿Sabés dónde queda el mercado?"
  - Matched: none

- **es-BO** → **es-ES** (hard)
  - Text: "Traé la papa que dejaste en la mesa."
  - Ambiguity: Input contains conflicting dialect markers (es-AR vs es-UY)
  - Matched: none

- **es-BO** → **es-CL** (hard)
  - Text: "Andá despacio por la calle empedrada."
  - Matched: po

- **es-EC** → **es-UY** (easy)
  - Text: "El chibolo dejó el computador en el departamento con papa."
  - Matched: papa, departamento, bo, ta

- **es-EC** → **es-AR** (easy)
  - Text: "Qué bacán, el longo trajo caña y esfero."
  - Matched: none

- **es-EC** → **es-ES** (medium)
  - Text: "Achachay, hace frío, dame el chado de la chulla."
  - Matched: none

- **es-EC** → **es-UY** (medium)
  - Text: "Ese cacho está chuchaqui después de la fiesta."
  - Matched: ta

- **es-EC** → **es-ES** (medium)
  - Text: "Pasa los lentes y el banano para el almuerzo."
  - Matched: none

- **es-EC** → **es-CU** (medium)
  - Text: "Vamos en carro a buscar maní y guagua."
  - Matched: guagua, ma

- **es-EC** → **es-ES** (hard)
  - Text: "¿Sabes si el bus ya pasó?"
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-PE)
  - Matched: none

- **es-EC** → **es-UY** (hard)
  - Text: "Voy a dejar la computadora en casa."
  - Matched: computadora, ta

- **es-EC** → **es-ES** (hard)
  - Text: "¿Quieres que prepare algo de comer?"
  - Matched: none

- **es-GT** → **es-UY** (easy)
  - Text: "Bo, dejé la computadora en el departamento con papa."
  - Matched: computadora, papa, departamento, bo, ta

- **es-GT** → **es-CL** (easy)
  - Text: "Qué shute, el chucho no quiere clavo ni cipote."
  - Matched: po

- **es-GT** → **es-ES** (medium)
  - Text: "Ese canche es culero, siempre trae morral vacío."
  - Ambiguity: Input contains conflicting dialect markers (es-AR vs es-UY)
  - Matched: none

- **es-GT** → **es-ES** (medium)
  - Text: "Pasa los lentes y el frijol para la cena."
  - Matched: none

- **es-GT** → **es-UY** (medium)
  - Text: "El patojo hizo bochinche en el istmo."
  - Matched: che, bo

- **es-GT** → **es-UY** (medium)
  - Text: "Vamos en bus a comprar papa y plátano."
  - Matched: papa, ta

- **es-GT** → **es-ES** (hard)
  - Text: "¿Sabes si el carro tiene gasolina?"
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-GT)
  - Matched: none

- **es-GT** → **es-ES** (hard)
  - Text: "Voy a lavar el auto antes de salir."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-GT** → **es-SV** (hard)
  - Text: "¿Quieres que vayamos temprano?"
  - Matched: vaya

- **es-HN** → **es-UY** (easy)
  - Text: "Dejé la computadora en el departamento con papa y frijol."
  - Matched: computadora, papa, departamento, ta

- **es-HN** → **es-EC** (easy)
  - Text: "Qué chuco, el ñaño no quiere chure ni choco."
  - Matched: ñaño

- **es-HN** → **es-CU** (medium)
  - Text: "Ese mañe es bayunco, siempre trae pichu sucio."
  - Matched: ma

- **es-HN** → **es-ES** (medium)
  - Text: "Pasa los lentes que no veo el bus."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-PE)
  - Matched: none

- **es-HN** → **es-ES** (medium)
  - Text: "El chepa trajo cirilo para el arrastrado."
  - Ambiguity: Input contains conflicting dialect markers (es-AR vs es-UY)
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

- **es-SV** → **es-UY** (easy)
  - Text: "Dejé la computadora en el departamento con papa."
  - Matched: computadora, papa, departamento, ta

- **es-SV** → **es-ES** (easy)
  - Text: "Qué tuanis, el chero trajo chel y chunche."
  - Ambiguity: Input contains conflicting dialect markers (es-AR vs es-UY)
  - Matched: none

- **es-SV** → **es-ES** (medium)
  - Text: "Ese bicho es cerote, siempre trae puch sucio."
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

- **es-NI** → **es-UY** (easy)
  - Text: "Dejé la computadora en el departamento con papa."
  - Matched: computadora, papa, departamento, ta

- **es-NI** → **es-ES** (medium)
  - Text: "Ese pinolero es arre, siempre trae pichilingo."
  - Matched: none

- **es-NI** → **es-ES** (medium)
  - Text: "Pasa los lentes y el frijol para la cena."
  - Matched: none

- **es-NI** → **es-UY** (medium)
  - Text: "El chele trajo naca para el samaritano."
  - Matched: che, ta

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

- **es-CR** → **es-UY** (easy)
  - Text: "Dejé la computadora en el departamento con carro y papa."
  - Matched: computadora, papa, departamento, ta

- **es-CR** → **es-ES** (easy)
  - Text: "Qué tuanis, el guaro trajo chunche y brete."
  - Ambiguity: Input contains conflicting dialect markers (es-AR vs es-UY)
  - Matched: none

- **es-CR** → **es-ES** (medium)
  - Text: "Ese roine es sarasa, siempre trae jupa."
  - Matched: none

- **es-CR** → **es-ES** (medium)
  - Text: "Pasa los lentes y el frijol para la cena."
  - Matched: none

- **es-CR** → **es-ES** (medium)
  - Text: "El yigüirro trajo bomba para el carajillo."
  - Ambiguity: Input contains conflicting dialect markers (es-UY vs es-GT)
  - Matched: none

- **es-CR** → **es-ES** (medium)
  - Text: "Vamos en bus a la pulpería con papa."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-PE)
  - Matched: none

- **es-CR** → **es-ES** (hard)
  - Text: "¿Sabes si el carro tiene gasolina?"
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-GT)
  - Matched: none

- **es-CR** → **es-ES** (hard)
  - Text: "Voy a dejar el auto en la casa."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-CR** → **es-SV** (hard)
  - Text: "¿Quieres que vayamos juntos?"
  - Matched: vaya

- **es-PA** → **es-UY** (easy)
  - Text: "Dejé la computadora en el departamento con papa."
  - Matched: computadora, papa, departamento, ta

- **es-PA** → **es-ES** (medium)
  - Text: "Ese sorrin es majare, siempre trae talla."
  - Ambiguity: Input contains conflicting dialect markers (es-CU vs es-UY)
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

- **es-DO** → **es-UY** (easy)
  - Text: "Dejé la computadora en el apartamento con auto y papa."
  - Matched: computadora, auto, papa, ta

- **es-DO** → **es-AR** (easy)
  - Text: "Qué chin, el jevo trajo china y kukú."
  - Matched: none

- **es-DO** → **es-ES** (medium)
  - Text: "Ese papichulo es vaina, siempre trae bandola."
  - Matched: none

- **es-DO** → **es-ES** (medium)
  - Text: "Pasa los lentes y la habichuela para la cena."
  - Matched: none

- **es-DO** → **es-UY** (medium)
  - Text: "El concon trajo vívere para el aplatar."
  - Matched: ta

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

- **es-PR** → **es-UY** (easy)
  - Text: "Dejé la computadora en el apartamento con auto y papa."
  - Matched: computadora, auto, papa, ta

- **es-PR** → **es-ES** (easy)
  - Text: "Qué cabra, el jevo trajo zafacón y pulpo."
  - Ambiguity: Input contains conflicting dialect markers (es-CL vs es-PR)
  - Matched: none

- **es-PR** → **es-UY** (medium)
  - Text: "Ese bichote es chota, siempre trae floor."
  - Matched: ta

- **es-PR** → **es-ES** (medium)
  - Text: "Pasa los lentes y la habichuela para la cena."
  - Matched: none

- **es-PR** → **es-CU** (medium)
  - Text: "El nene trajo mami para el papi."
  - Matched: ma

- **es-PR** → **es-EC** (medium)
  - Text: "Vamos en guagua a buscar papa y lentes."
  - Matched: papa, bus, guagua

- **es-PR** → **es-ES** (hard)
  - Text: "¿Sabes si el auto está listo?"
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-PR** → **es-ES** (hard)
  - Text: "Voy a dejar el carro en el parking."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-GT)
  - Matched: none

- **es-PR** → **es-SV** (hard)
  - Text: "¿Quieres que vayamos juntos?"
  - Matched: vaya

- **es-GQ** → **es-UY** (easy)
  - Text: "Dejé la computadora en el río muni con batata."
  - Matched: computadora, ta

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

- **es-US** → **es-ES** (easy)
  - Text: "Voy a parquear el carro cerca de la computadora."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-UY)
  - Matched: none

- **es-US** → **es-ES** (medium)
  - Text: "Ese huero es fresa, siempre trae chafa."
  - Matched: none

- **es-US** → **es-ES** (medium)
  - Text: "El mijo trajo mija para la raza."
  - Matched: none

- **es-US** → **es-ES** (medium)
  - Text: "Mande, voy en troca a buscar papa."
  - Ambiguity: Input contains conflicting dialect markers (es-CU vs es-US)
  - Matched: none

- **es-US** → **es-ES** (hard)
  - Text: "¿Sabes si el carro está listo?"
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-GT)
  - Matched: none

- **es-US** → **es-ES** (hard)
  - Text: "Voy a dejar el auto en la casa."
  - Ambiguity: Input contains conflicting dialect markers (es-MX vs es-AR)
  - Matched: none

- **es-US** → **es-SV** (hard)
  - Text: "¿Quieres que vayamos juntos?"
  - Matched: vaya

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

- **es-BZ** → **es-ES** (easy)
  - Text: "Qué breki, el mopan trajo zapote y cayuco."
  - Ambiguity: Input contains conflicting dialect markers (es-CL vs es-BZ)
  - Matched: none

- **es-BZ** → **es-ES** (medium)
  - Text: "Ese kekchi es bway, siempre trae yucatec."
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

- **es-BZ** → **es-SV** (hard)
  - Text: "¿Quieres que vayamos juntos?"
  - Matched: vaya

- **es-AD** → **es-AR** (easy)
  - Text: "Qué caldea, el comú trajo parroquia y principado."
  - Matched: none

- **es-AD** → **es-CU** (medium)
  - Text: "Ese vall es pas, siempre trae madriu."
  - Matched: ma

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

- **es-AD** → **es-SV** (hard)
  - Text: "¿Queréis que vayamos juntos?"
  - Matched: vaya

