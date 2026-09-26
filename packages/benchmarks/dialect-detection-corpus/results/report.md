# Dialect Detection Benchmark Report

- **Date**: 2026-05-10T19:14:19.779Z
- **Corpus**: ~/workspaces/kyanite-labs/DialectOS/packages/benchmarks/dialect-detection-corpus/samples.json
- **Total samples**: 250
- **Top-1 correct**: 137
- **Top-3 correct**: 158
- **Top-1 accuracy**: 54.8%
- **Top-3 accuracy**: 63.2%
- **Avg confidence**: 10.3%

## By Difficulty

| Difficulty | Top-1 Acc | Top-3 Acc | Total |
|------------|-----------|-----------|-------|
| easy | 88.0% | 93.3% | 75 |
| medium | 60.0% | 68.0% | 100 |
| hard | 14.7% | 26.7% | 75 |

## By Dialect

| Dialect | Top-1 Acc | Top-3 Acc | Total |
|---------|-----------|-----------|-------|
| es-AD | 50.0% | 50.0% | 10 |
| es-AR | 100.0% | 100.0% | 10 |
| es-BO | 50.0% | 50.0% | 10 |
| es-BZ | 50.0% | 50.0% | 10 |
| es-CL | 60.0% | 80.0% | 10 |
| es-CO | 70.0% | 90.0% | 10 |
| es-CR | 40.0% | 40.0% | 10 |
| es-CU | 60.0% | 70.0% | 10 |
| es-DO | 30.0% | 50.0% | 10 |
| es-EC | 50.0% | 60.0% | 10 |
| es-ES | 100.0% | 100.0% | 10 |
| es-GQ | 40.0% | 40.0% | 10 |
| es-GT | 40.0% | 60.0% | 10 |
| es-HN | 60.0% | 60.0% | 10 |
| es-MX | 80.0% | 80.0% | 10 |
| es-NI | 40.0% | 40.0% | 10 |
| es-PA | 40.0% | 40.0% | 10 |
| es-PE | 60.0% | 80.0% | 10 |
| es-PH | 40.0% | 40.0% | 10 |
| es-PR | 30.0% | 50.0% | 10 |
| es-PY | 60.0% | 80.0% | 10 |
| es-SV | 40.0% | 50.0% | 10 |
| es-US | 60.0% | 60.0% | 10 |
| es-UY | 60.0% | 90.0% | 10 |
| es-VE | 60.0% | 70.0% | 10 |

## Hardest Dialects

| Dialect | Top-1 Acc | Total |
|---------|-----------|-------|
| es-DO | 30.0% | 10 |
| es-PR | 30.0% | 10 |
| es-GT | 40.0% | 10 |
| es-SV | 40.0% | 10 |
| es-NI | 40.0% | 10 |

## Confusion Matrix (expected → predicted)

| Expected \ Predicted | es-AD | es-AR | es-BO | es-BZ | es-CL | es-CO | es-CR | es-CU | es-DO | es-EC | es-ES | es-GQ | es-GT | es-HN | es-MX | es-NI | es-PA | es-PE | es-PH | es-PR | es-PY | es-SV | es-US | es-UY | es-VE |
|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|------|
| es-AD | **5** | 0 | 0 | 0 | 0 | **2** | 0 | 0 | 0 | 0 | **2** | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-AR | 0 | **10** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-BO | 0 | **3** | **5** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | 0 | 0 | **1** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-BZ | 0 | 0 | 0 | **5** | 0 | **2** | 0 | 0 | 0 | 0 | **1** | 0 | 0 | 0 | **2** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-CL | 0 | 0 | 0 | 0 | **6** | **2** | 0 | 0 | 0 | 0 | **2** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-CO | 0 | 0 | 0 | 0 | 0 | **7** | 0 | 0 | 0 | 0 | **2** | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-CR | 0 | 0 | 0 | 0 | 0 | **1** | **4** | 0 | 0 | 0 | **2** | 0 | **1** | **1** | **1** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-CU | 0 | **1** | 0 | 0 | 0 | 0 | 0 | **6** | 0 | 0 | **1** | 0 | 0 | 0 | **2** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-DO | 0 | 0 | 0 | 0 | 0 | **3** | 0 | 0 | **3** | 0 | **2** | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** |
| es-EC | 0 | 0 | 0 | 0 | 0 | **2** | 0 | 0 | 0 | **5** | **2** | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-ES | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **10** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-GQ | 0 | **1** | 0 | 0 | 0 | **2** | 0 | 0 | 0 | 0 | **1** | **4** | 0 | 0 | **2** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-GT | 0 | 0 | 0 | 0 | 0 | **2** | 0 | 0 | 0 | 0 | **1** | 0 | **4** | **1** | **1** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | 0 |
| es-HN | 0 | 0 | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | **2** | 0 | 0 | **6** | **1** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-MX | 0 | 0 | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | **1** | 0 | 0 | 0 | **8** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-NI | 0 | **1** | 0 | 0 | 0 | **2** | 0 | 0 | 0 | 0 | **2** | 0 | 0 | **1** | 0 | **4** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-PA | 0 | **1** | 0 | 0 | 0 | **2** | 0 | 0 | 0 | 0 | **1** | 0 | 0 | **1** | **1** | 0 | **4** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-PE | 0 | 0 | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | **1** | 0 | 0 | 0 | **2** | 0 | 0 | **6** | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| es-PH | 0 | 0 | 0 | 0 | 0 | **2** | 0 | 0 | 0 | 0 | **2** | 0 | 0 | 0 | **2** | 0 | 0 | 0 | **4** | 0 | 0 | 0 | 0 | 0 | 0 |
| es-PR | 0 | 0 | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | **4** | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | **3** | 0 | 0 | 0 | 0 | **1** |
| es-PY | 0 | **2** | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **6** | 0 | 0 | 0 | 0 |
| es-SV | 0 | **1** | 0 | 0 | 0 | **2** | 0 | 0 | 0 | 0 | **1** | 0 | 0 | **1** | **1** | 0 | 0 | 0 | 0 | 0 | 0 | **4** | 0 | 0 | 0 |
| es-US | 0 | 0 | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | **2** | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **6** | 0 | 0 |
| es-UY | 0 | **2** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | 0 | **1** | 0 | 0 | **6** | 0 |
| es-VE | 0 | 0 | 0 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | **3** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **6** |

## Misclassifications

- **es-MX** → **es-CO** (hard)
  - Text: "Voy a lavar el carro y luego paso por ti."
  - Matched: carro

- **es-MX** → **es-ES** (hard)
  - Text: "¿Quieres que prepare la cena? Ya casi es hora."
  - Matched: none

- **es-CO** → **es-ES** (medium)
  - Text: "Vamos a tomar guaro, tengo guayabo de la fiesta."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-CR)
  - Matched: none

- **es-CO** → **es-MX** (hard)
  - Text: "Voy a comprar papa para la cena de hoy."
  - Matched: papa

- **es-CO** → **es-ES** (hard)
  - Text: "¿Quieres que te acompañe a la tienda?"
  - Matched: none

- **es-CU** → **es-MX** (medium)
  - Text: "Voy a comprar papa y habichuela para el almuerzo."
  - Matched: papa

- **es-CU** → **es-MX** (hard)
  - Text: "¿Tú sabes dónde queda la nueva tienda?"
  - Matched: none

- **es-CU** → **es-ES** (hard)
  - Text: "Dame un momento que termino esto."
  - Matched: none

- **es-CU** → **es-AR** (hard)
  - Text: "Voy a buscar el auto que dejé ayer."
  - Matched: auto

- **es-PE** → **es-MX** (medium)
  - Text: "Oye pe, pasa la pluma que escribo rápido."
  - Matched: pluma

- **es-PE** → **es-CO** (hard)
  - Text: "¿Sabes si el bus pasa por aquí?"
  - Matched: bus

- **es-PE** → **es-MX** (hard)
  - Text: "Voy a comprar papa para hacer la cena."
  - Matched: papa

- **es-PE** → **es-ES** (hard)
  - Text: "¿Quieres que vayamos juntos al centro?"
  - Matched: none

- **es-CL** → **es-CO** (medium)
  - Text: "La raja, al tiro llego con los lentes y el maní."
  - Matched: maní

- **es-CL** → **es-ES** (medium)
  - Text: "Voy a comprar poroto y frutilla para la once."
  - Matched: none

- **es-CL** → **es-CO** (hard)
  - Text: "Voy a dejar el computador en casa."
  - Matched: computador

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

- **es-VE** → **es-CO** (hard)
  - Text: "¿Sabes si el carro tiene gasolina?"
  - Matched: carro

- **es-VE** → **es-ES** (hard)
  - Text: "¿Quieres que vayamos juntos mañana?"
  - Matched: none

- **es-UY** → **es-MX** (medium)
  - Text: "Pasa los anteojos que no veo la computadora."
  - Matched: computadora

- **es-UY** → **es-PY** (medium)
  - Text: "Vos sabés que esta papa está buena para el auto."
  - Matched: auto, papa, vos

- **es-UY** → **es-AR** (hard)
  - Text: "¿Sabés dónde queda la parada del colectivo?"
  - Matched: colectivo

- **es-UY** → **es-AR** (hard)
  - Text: "Podés dejar el auto acá, no hay problema."
  - Matched: auto

- **es-PY** → **es-CO** (medium)
  - Text: "Pasa los anteojos que no veo el bus."
  - Matched: bus

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

- **es-BO** → **es-HN** (medium)
  - Text: "Pasa los lentes y el frijol para el almuerzo."
  - Matched: frijol

- **es-BO** → **es-AR** (hard)
  - Text: "¿Sabés dónde queda el mercado?"
  - Matched: none

- **es-BO** → **es-AR** (hard)
  - Text: "Traé la papa que dejaste en la mesa."
  - Matched: papa

- **es-BO** → **es-AR** (hard)
  - Text: "Andá despacio por la calle empedrada."
  - Matched: none

- **es-EC** → **es-ES** (medium)
  - Text: "Pasa los lentes y el banano para el almuerzo."
  - Ambiguity: Input contains conflicting dialect markers (es-CO vs es-EC)
  - Matched: none

- **es-EC** → **es-CO** (medium)
  - Text: "Vamos en carro a buscar maní y guagua."
  - Matched: carro, maní

- **es-EC** → **es-CO** (hard)
  - Text: "¿Sabes si el bus ya pasó?"
  - Matched: bus

- **es-EC** → **es-MX** (hard)
  - Text: "Voy a dejar la computadora en casa."
  - Matched: computadora

- **es-EC** → **es-ES** (hard)
  - Text: "¿Quieres que prepare algo de comer?"
  - Matched: none

- **es-GT** → **es-UY** (easy)
  - Text: "Bo, dejé la computadora en el departamento con papa."
  - Matched: computadora, papa, departamento, bo

- **es-GT** → **es-HN** (medium)
  - Text: "Pasa los lentes y el frijol para la cena."
  - Matched: frijol

- **es-GT** → **es-CO** (medium)
  - Text: "Vamos en bus a comprar papa y plátano."
  - Matched: papa, bus

- **es-GT** → **es-CO** (hard)
  - Text: "¿Sabes si el carro tiene gasolina?"
  - Matched: carro

- **es-GT** → **es-MX** (hard)
  - Text: "Voy a lavar el auto antes de salir."
  - Matched: auto

- **es-GT** → **es-ES** (hard)
  - Text: "¿Quieres que vayamos temprano?"
  - Matched: none

- **es-HN** → **es-CO** (medium)
  - Text: "Pasa los lentes que no veo el bus."
  - Matched: bus

- **es-HN** → **es-ES** (hard)
  - Text: "¿Sabes si ya llegó el autobús?"
  - Matched: autobús

- **es-HN** → **es-MX** (hard)
  - Text: "Voy a dejar el auto en la casa."
  - Matched: auto

- **es-HN** → **es-ES** (hard)
  - Text: "¿Quieres que prepare la cena?"
  - Matched: none

- **es-SV** → **es-AR** (easy)
  - Text: "Dejé la computadora en el departamento con papa."
  - Matched: computadora, papa, departamento

- **es-SV** → **es-HN** (medium)
  - Text: "Pasa los lentes y el frijol para la cena."
  - Matched: frijol

- **es-SV** → **es-CO** (medium)
  - Text: "Vamos en bus a buscar papa y lentes."
  - Matched: papa, bus

- **es-SV** → **es-CO** (hard)
  - Text: "¿Sabes si el carro está listo?"
  - Matched: carro

- **es-SV** → **es-MX** (hard)
  - Text: "Voy a lavar el auto antes de irme."
  - Matched: auto

- **es-SV** → **es-ES** (hard)
  - Text: "¿Quieres que te ayude con eso?"
  - Matched: none

- **es-NI** → **es-AR** (easy)
  - Text: "Dejé la computadora en el departamento con papa."
  - Matched: computadora, papa, departamento

- **es-NI** → **es-HN** (medium)
  - Text: "Pasa los lentes y el frijol para la cena."
  - Matched: frijol

- **es-NI** → **es-CO** (medium)
  - Text: "Vamos en bus a buscar papa y lentes."
  - Matched: papa, bus

- **es-NI** → **es-ES** (hard)
  - Text: "¿Sabes si ya pasó el autobús?"
  - Matched: autobús

- **es-NI** → **es-CO** (hard)
  - Text: "Voy a dejar el carro en la casa."
  - Matched: carro

- **es-NI** → **es-ES** (hard)
  - Text: "¿Quieres que prepare algo de comer?"
  - Matched: none

- **es-CR** → **es-GT** (easy)
  - Text: "Dejé la computadora en el departamento con carro y papa."
  - Matched: computadora, carro, papa, departamento

- **es-CR** → **es-ES** (medium)
  - Text: "Ese roine es sarasa, siempre trae jupa."
  - Matched: none

- **es-CR** → **es-HN** (medium)
  - Text: "Pasa los lentes y el frijol para la cena."
  - Matched: frijol

- **es-CR** → **es-CO** (hard)
  - Text: "¿Sabes si el carro tiene gasolina?"
  - Matched: carro

- **es-CR** → **es-MX** (hard)
  - Text: "Voy a dejar el auto en la casa."
  - Matched: auto

- **es-CR** → **es-ES** (hard)
  - Text: "¿Quieres que vayamos juntos?"
  - Matched: none

- **es-PA** → **es-AR** (easy)
  - Text: "Dejé la computadora en el departamento con papa."
  - Matched: computadora, papa, departamento

- **es-PA** → **es-HN** (medium)
  - Text: "Pasa los lentes y el frijol para la cena."
  - Matched: frijol

- **es-PA** → **es-CO** (medium)
  - Text: "Vamos en bus a buscar papa y lentes."
  - Matched: papa, bus

- **es-PA** → **es-CO** (hard)
  - Text: "¿Sabes si el carro está listo?"
  - Matched: carro

- **es-PA** → **es-MX** (hard)
  - Text: "Voy a lavar el auto antes de salir."
  - Matched: auto

- **es-PA** → **es-ES** (hard)
  - Text: "¿Quieres que te acompañe?"
  - Matched: none

- **es-DO** → **es-VE** (easy)
  - Text: "Dejé la computadora en el apartamento con auto y papa."
  - Matched: computadora, auto, papa, apartamento

- **es-DO** → **es-CO** (medium)
  - Text: "Ese papichulo es vaina, siempre trae bandola."
  - Matched: vaina

- **es-DO** → **es-ES** (medium)
  - Text: "Pasa los lentes y la habichuela para la cena."
  - Matched: none

- **es-DO** → **es-CO** (medium)
  - Text: "Vamos en bus a buscar papa y lentes."
  - Matched: papa, bus

- **es-DO** → **es-MX** (hard)
  - Text: "¿Sabes si el auto tiene gasolina?"
  - Matched: auto

- **es-DO** → **es-CO** (hard)
  - Text: "Voy a dejar el carro en la casa."
  - Matched: carro

- **es-DO** → **es-ES** (hard)
  - Text: "¿Quieres que prepare la cena?"
  - Matched: none

- **es-PR** → **es-VE** (easy)
  - Text: "Dejé la computadora en el apartamento con auto y papa."
  - Matched: computadora, auto, papa, apartamento

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

- **es-PR** → **es-MX** (hard)
  - Text: "¿Sabes si el auto está listo?"
  - Matched: auto

- **es-PR** → **es-CO** (hard)
  - Text: "Voy a dejar el carro en el parking."
  - Matched: carro

- **es-PR** → **es-ES** (hard)
  - Text: "¿Quieres que vayamos juntos?"
  - Matched: none

- **es-GQ** → **es-AR** (easy)
  - Text: "Dejé la computadora en el río muni con batata."
  - Matched: computadora

- **es-GQ** → **es-MX** (medium)
  - Text: "Pasa los lentes y la papa para la cena."
  - Matched: papa

- **es-GQ** → **es-CO** (medium)
  - Text: "Vamos en bus a buscar papa y lentes."
  - Matched: papa, bus

- **es-GQ** → **es-CO** (hard)
  - Text: "¿Sabes si el carro tiene gasolina?"
  - Matched: carro

- **es-GQ** → **es-MX** (hard)
  - Text: "Voy a dejar el auto en la casa."
  - Matched: auto

- **es-GQ** → **es-ES** (hard)
  - Text: "¿Quieres que prepare algo de comer?"
  - Matched: none

- **es-US** → **es-ES** (medium)
  - Text: "El mijo trajo mija para la raza."
  - Matched: none

- **es-US** → **es-CO** (hard)
  - Text: "¿Sabes si el carro está listo?"
  - Matched: carro

- **es-US** → **es-MX** (hard)
  - Text: "Voy a dejar el auto en la casa."
  - Matched: auto

- **es-US** → **es-ES** (hard)
  - Text: "¿Quieres que vayamos juntos?"
  - Matched: none

- **es-PH** → **es-ES** (medium)
  - Text: "Ese kamo es mo'o, siempre trae evo."
  - Matched: none

- **es-PH** → **es-MX** (medium)
  - Text: "Pasa los lentes y la papa para la cena."
  - Matched: papa

- **es-PH** → **es-CO** (medium)
  - Text: "Vamos en bus a buscar papa y lentes."
  - Matched: papa, bus

- **es-PH** → **es-CO** (hard)
  - Text: "¿Sabes si el carro tiene gasolina?"
  - Matched: carro

- **es-PH** → **es-MX** (hard)
  - Text: "Voy a dejar el auto en la casa."
  - Matched: auto

- **es-PH** → **es-ES** (hard)
  - Text: "¿Quieres que prepare algo de comer?"
  - Matched: none

- **es-BZ** → **es-MX** (medium)
  - Text: "Pasa los lentes y la papa para la cena."
  - Matched: papa

- **es-BZ** → **es-CO** (medium)
  - Text: "Vamos en bus a buscar papa y lentes."
  - Matched: papa, bus

- **es-BZ** → **es-CO** (hard)
  - Text: "¿Sabes si el carro está listo?"
  - Matched: carro

- **es-BZ** → **es-MX** (hard)
  - Text: "Voy a dejar el auto en la casa."
  - Matched: auto

- **es-BZ** → **es-ES** (hard)
  - Text: "¿Quieres que vayamos juntos?"
  - Matched: none

- **es-AD** → **es-MX** (medium)
  - Text: "Pasa los lentes y la papa para la cena."
  - Matched: papa

- **es-AD** → **es-CO** (medium)
  - Text: "Vamos en bus a buscar papa y lentes."
  - Matched: papa, bus

- **es-AD** → **es-CO** (hard)
  - Text: "¿Sabéis si el carro está listo?"
  - Matched: carro

- **es-AD** → **es-ES** (hard)
  - Text: "Voy a dejar el coche en la casa."
  - Matched: coche

- **es-AD** → **es-ES** (hard)
  - Text: "¿Queréis que vayamos juntos?"
  - Matched: none

