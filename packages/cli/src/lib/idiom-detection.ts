import type { SpanishDialect } from "@dialectos/types";

export interface IdiomRule {
  id: string;
  englishPattern: RegExp;
  englishIdiom: string;
  literalTraps: readonly string[];
  correctEquivalents: readonly string[];
  dialectEquivalents?: Record<string, readonly string[]>;
  explanation: string;
}

export interface IdiomDetectionResult {
  matchedRules: IdiomRule[];
  guidance: string;
  forbiddenLiteralTerms: string[];
  expectedCorrectTerms: string[];
}

const IDIOM_RULES: readonly IdiomRule[] = [
  // ===== Weather & Nature =====
  {
    id: "raining-cats-dogs",
    englishPattern: /\b(raining|rain)\s+(cats and dogs|cats & dogs)\b/i,
    englishIdiom: "raining cats and dogs",
    literalTraps: ["gatos y perros"],
    correctEquivalents: ["a cántaros", "a mares"],
    dialectEquivalents: { "es-AR": ["a cántaros", "a baldes"] },
    explanation: "'Raining cats and dogs' means heavy rain. 'Gatos y perros' is nonsensical in Spanish.",
  },
  {
    id: "under-the-weather",
    englishPattern: /\bunder the weather\b/i,
    englishIdiom: "under the weather",
    literalTraps: ["debajo del clima", "bajo el clima", "debajo del tiempo"],
    correctEquivalents: ["indispuesto", "mal", "enfermo", "malhumorado"],
    explanation: "'Under the weather' means feeling ill. A literal translation about weather is nonsensical.",
  },
  {
    id: "once-in-blue-moon",
    englishPattern: /\bonce in a blue moon\b/i,
    englishIdiom: "once in a blue moon",
    literalTraps: ["luna azul", "una vez en una luna azul"],
    correctEquivalents: ["casi nunca", "rara vez", "una vez cada muerte de obispo"],
    explanation: "'Once in a blue moon' means very rarely. 'Luna azul' is not an idiom in Spanish.",
  },
  {
    id: "on-thin-ice",
    englishPattern: /\bon thin ice\b/i,
    englishIdiom: "on thin ice",
    literalTraps: ["hielo delgado", "sobre hielo delgado", "en hielo delgado"],
    correctEquivalents: ["al borde", "en el filo de la navaja", "pisando terreno peligroso"],
    explanation: "'On thin ice' means in a risky situation. 'Hielo delgado' is not understood in Spanish.",
  },
  {
    id: "out-of-the-blue",
    englishPattern: /\bout of (the )?blue\b/i,
    englishIdiom: "out of the blue",
    literalTraps: ["fuera del azul", "del azul", "fuera de lo azul"],
    correctEquivalents: ["de repente", "sin previo aviso", "por sorpresa"],
    explanation: "'Out of the blue' means unexpectedly. 'Del azul' is not a Spanish idiom.",
  },
  {
    id: "when-pigs-fly",
    englishPattern: /\bwhen pigs fly\b|\bpigs might fly\b|\bflying pigs\b/i,
    englishIdiom: "when pigs fly",
    literalTraps: ["cerdos vuelen", "cerdos volando", "cuando los cerdos vuelen"],
    correctEquivalents: ["cuando las ranas críen pelo", "ni en sueños", "nunca"],
    explanation: "'When pigs fly' means never. 'Cerdos volando' is not an established idiom.",
  },

  // ===== Body Parts =====
  {
    id: "break-a-leg",
    englishPattern: /\bbreak a leg\b/i,
    englishIdiom: "break a leg",
    literalTraps: ["romper una pierna", "rompe una pierna", "rompete una pierna"],
    correctEquivalents: ["¡mucha suerte!", "¡mucha mierda!", "¡éxito!"],
    explanation: "'Break a leg' is a theatre good-luck wish. A literal translation about breaking a leg would alarm Spanish speakers.",
  },
  {
    id: "costs-arm-leg",
    englishPattern: /\bcost(s|ing)?\s+(an? )?(arm and a leg|arm & a leg)\b/i,
    englishIdiom: "costs an arm and a leg",
    literalTraps: ["brazo y una pierna", "brazo y pierna", "un brazo y una pierna"],
    correctEquivalents: ["un ojo de la cara", "un riñón", "un dineral", "carísimo"],
    explanation: "'Costs an arm and a leg' means very expensive. 'Brazo y pierna' is not used; Spanish uses 'ojo de la cara'.",
  },
  {
    id: "chip-on-shoulder",
    englishPattern: /\bchip on (her|his|my|your|their|the) shoulder\b/i,
    englishIdiom: "chip on one's shoulder",
    literalTraps: ["ficha en el hombro", "chip en el hombro"],
    correctEquivalents: ["guardar rencor", "tener un complejo", "estar resentido"],
    explanation: "'Chip on one's shoulder' means holding a grudge. 'Ficha en el hombro' is meaningless in Spanish.",
  },
  {
    id: "pull-my-leg",
    englishPattern: /\bpull(ing)? (my|your|her|his|their) leg\b/i,
    englishIdiom: "pull someone's leg",
    literalTraps: ["tirar mi pierna", "tirar tu pierna", "tirar su pierna", "jalar mi pierna", "jalar tu pierna", "tira mi pierna", "tira tu pierna"],
    correctEquivalents: ["tomar el pelo", "vacilar", "engañar", "bromear"],
    explanation: "'Pull someone's leg' means to joke or tease. A literal translation about pulling a leg is nonsensical.",
  },
  {
    id: "keep-chin-up",
    englishPattern: /\bkeep (your |thy )?chin up\b|\bchin up\b/i,
    englishIdiom: "keep your chin up",
    literalTraps: ["barbilla arriba", "mantén la barbilla arriba", "barbilla en alto"],
    correctEquivalents: ["ánimo", "no te desanimes", "cabeza alta"],
    explanation: "'Keep your chin up' means stay positive. 'Barbilla arriba' is meaningless in Spanish.",
  },
  {
    id: "by-skin-of-teeth",
    englishPattern: /\bby the skin of (my|your|his|her|their|our) teeth\b/i,
    englishIdiom: "by the skin of one's teeth",
    literalTraps: ["piel de (?:mis|tus|sus|los) dientes", "por la piel de los dientes"],
    correctEquivalents: ["por los pelos", "por un pelo", "por poco", "de milagro"],
    explanation: "'By the skin of one's teeth' means barely. 'Piel de los dientes' is nonsensical in Spanish.",
  },
  {
    id: "turn-blind-eye",
    englishPattern: /\bturn(ing)? a blind eye\b|\bturn a blind eye\b/i,
    englishIdiom: "turn a blind eye",
    literalTraps: ["ojo ciego", "volver un ojo ciego", "girar un ojo ciego"],
    correctEquivalents: ["hacer la vista gorda", "hacerse de la vista gorda", "ignorar"],
    explanation: "'Turn a blind eye' means to ignore. 'Ojo ciego' is not a Spanish idiom.",
  },
  {
    id: "sweet-tooth",
    englishPattern: /\b(sweet tooth|have a sweet tooth)\b/i,
    englishIdiom: "sweet tooth",
    literalTraps: ["diente dulce"],
    correctEquivalents: ["ser goloso", "ser dulcero", "tener un diente dulce"],
    explanation: "'Sweet tooth' means loving sweets. While 'diente dulce' can sometimes be understood, 'ser goloso' is the natural expression.",
  },

  // ===== Objects & Actions =====
  {
    id: "piece-of-cake",
    englishPattern: /\b(piece of cake|a piece of cake)\b/i,
    englishIdiom: "piece of cake",
    literalTraps: ["pedazo de pastel", "trozo de pastel", "pedazo de tarta", "trozo de tarta"],
    correctEquivalents: ["pan comido", "muy fácil", "coser y cantar", "chupado"],
    explanation: "'Piece of cake' means very easy. 'Pedazo de pastel' is not an idiom; use 'pan comido'.",
  },
  {
    id: "spill-the-beans",
    englishPattern: /\bspill(?:ed|ing)? the beans\b/i,
    englishIdiom: "spill the beans",
    literalTraps: ["derramar los frijoles", "derramar las judías", "derramar las alubias", "tirar los frijoles", "tirar las judías"],
    correctEquivalents: ["soltar la sopa", "chivatear", "descubrir el pastel", "cantar"],
    dialectEquivalents: { "es-MX": ["soltar la sopa", "chivatear", "cantar de plano"], "es-ES": ["soltar la sopa", "cantar"] },
    explanation: "'Spill the beans' means to reveal a secret. 'Derramar frijoles' is nonsensical in Spanish.",
  },
  {
    id: "burn-midnight-oil",
    englishPattern: /\bburn(?:ing)? the midnight oil\b/i,
    englishIdiom: "burn the midnight oil",
    literalTraps: ["quemar (?:el )?aceite de medianoche", "quemando el aceite de medianoche"],
    correctEquivalents: ["trasnochar", "quemarse las pestañas", "velar"],
    explanation: "'Burn the midnight oil' means to work late. 'Aceite de medianoche' is meaningless in Spanish.",
  },
  {
    id: "cut-corners",
    englishPattern: /\bcut(?:ting)? corners\b/i,
    englishIdiom: "cut corners",
    literalTraps: ["cortar esquinas", "cortando esquinas"],
    correctEquivalents: ["hacer las cosas a medias", "ahorrar esfuerzo", "saltarse pasos", "hacer algo mal"],
    explanation: "'Cut corners' means to do something poorly to save time. 'Cortar esquinas' is not understood.",
  },
  {
    id: "bite-the-bullet",
    englishPattern: /\bbite the bullet\b|\bbite(?:ting)? the bullet\b/i,
    englishIdiom: "bite the bullet",
    literalTraps: ["morder la bala", "muerde la bala"],
    correctEquivalents: ["hacer de tripas corazón", "aguantarse", "tragar saliva", "apechugar"],
    explanation: "'Bite the bullet' means to endure something painful. 'Morder la bala' is not a Spanish idiom.",
  },
  {
    id: "hit-the-sack",
    englishPattern: /\bhit the sack\b|\bhit the hay\b/i,
    englishIdiom: "hit the sack/hay",
    literalTraps: ["golpear el saco", "golpear el heno", "pegar al saco"],
    correctEquivalents: ["ir a dormir", "acostarse", "ir a la cama", "dormir"],
    explanation: "'Hit the sack' means go to sleep. 'Golpear el saco' is nonsensical.",
  },
  {
    id: "ball-in-your-court",
    englishPattern: /\bthe ball is in (your|her|his|their|my) court\b/i,
    englishIdiom: "the ball is in your court",
    literalTraps: ["pelota en tu cancha", "pelota está en tu cancha", "balón en tu cancha"],
    correctEquivalents: ["la decisión es tuya", "te toca a ti", "es tu turno", "la pelota está en tu tejado"],
    explanation: "'The ball is in your court' means it's your decision. 'Pelota en tu cancha' is not idiomatic Spanish.",
  },
  {
    id: "steal-thunder",
    englishPattern: /\bsteal(?:ing)? (my|your|her|his|their|the) thunder\b/i,
    englishIdiom: "steal someone's thunder",
    literalTraps: ["robar (?:el )?trueno", "robar (?:mi|tu|su) trueno"],
    correctEquivalents: ["robar el protagonismo", "quitar la atención", "opacar"],
    explanation: "'Steal someone's thunder' means to take attention away. 'Robar el trueno' is meaningless.",
  },
  {
    id: "take-rain-check",
    englishPattern: /\btake a rain check\b|\brain check\b/i,
    englishIdiom: "take a rain check",
    literalTraps: ["cheque de lluvia", "cheque por lluvia", "vale de lluvia"],
    correctEquivalents: ["dejarlo para otra vez", "dejarlo para después", "lo dejamos pendiente"],
    explanation: "'Take a rain check' means to postpone. 'Cheque de lluvia' is completely meaningless in Spanish.",
  },
  {
    id: "back-to-square-one",
    englishPattern: /\bback to square one\b|\bback at square one\b/i,
    englishIdiom: "back to square one",
    literalTraps: ["casilla uno", "vuelta a la casilla uno", "de vuelta a la casilla uno"],
    correctEquivalents: ["volver a empezar", "volver a la casilla de salida", "empezar de cero"],
    explanation: "'Back to square one' means starting over. 'Casilla uno' is not the idiomatic expression.",
  },
  {
    id: "drop-the-ball",
    englishPattern: /\bdrop(?:ped|ping)? the ball\b/i,
    englishIdiom: "drop the ball",
    literalTraps: ["dejar caer la pelota", "soltar la pelota"],
    correctEquivalents: ["fallar", "meter la pata", "errar", "dejar pasar"],
    explanation: "'Drop the ball' means to make a mistake or fail. 'Dejar caer la pelota' is not idiomatic.",
  },
  {
    id: "rule-of-thumb",
    englishPattern: /\b rule of thumb\b|\bas a rule of thumb\b/i,
    englishIdiom: "rule of thumb",
    literalTraps: ["regla del pulgar", "regla de pulgar"],
    correctEquivalents: ["regla general", "como regla general", "por regla general", "por lo general"],
    explanation: "'Rule of thumb' means a general principle. 'Regla del pulgar' is not understood in Spanish.",
  },
  {
    id: "last-straw",
    englishPattern: /\b(the |that was the )?last straw\b|\bstraw that (broke|breaks) the\b/i,
    englishIdiom: "the last straw",
    literalTraps: ["última paja", "la última paja", "última pajita", "paja que rompió"],
    correctEquivalents: ["la gota que colmó el vaso", "la gota que derramó el vaso", "el colmo"],
    explanation: "'The last straw' means the final annoyance. WARNING: 'paja' has vulgar slang meanings in many Spanish dialects. The correct idiom uses 'gota que colmó el vaso'.",
  },
  {
    id: "hang-in-there",
    englishPattern: /\bhang in there\b/i,
    englishIdiom: "hang in there",
    literalTraps: ["cuelga ahí", "cuelguen ahí", "colgarse ahí"],
    correctEquivalents: ["aguanta", "no te rindas", "resiste", "sigue adelante"],
    explanation: "'Hang in there' means persevere. 'Cuelga ahí' is nonsensical in Spanish.",
  },
  {
    id: "in-a-nutshell",
    englishPattern: /\bin a (?:nutshell|nuthell)\b|\bto put it in a nutshell\b/i,
    englishIdiom: "in a nutshell",
    literalTraps: ["cáscara de nuez", "en una cáscara de nuez", "cáscara de nuez"],
    correctEquivalents: ["en resumen", "en pocas palabras", "en síntesis", "resumiendo"],
    explanation: "'In a nutshell' means briefly. 'Cáscara de nuez' is not a Spanish idiom.",
  },
  {
    id: "grain-of-salt",
    englishPattern: /\bwith a grain of salt\b|\bwith a pinch of salt\b|\btake(?:s|ing)? .+ with a grain of salt\b/i,
    englishIdiom: "take with a grain of salt",
    literalTraps: ["grano de sal", "con un grano de sal"],
    correctEquivalents: ["con pinzas", "con cautela", "no tomárselo al pie de la letra", "con reservas"],
    explanation: "'Take with a grain of salt' means don't take too seriously. 'Con un grano de sal' is not idiomatic Spanish.",
  },

  // ===== Animals =====
  {
    id: "let-cat-out-bag",
    englishPattern: /\blet the cat out of (the )?bag\b/i,
    englishIdiom: "let the cat out of the bag",
    literalTraps: ["gato de la bolsa", "sacar al gato de la bolsa", "sacó al gato de la bolsa"],
    correctEquivalents: ["descubrir el pastel", "soltar la sopa", "chivatear", "revelar el secreto"],
    explanation: "'Let the cat out of the bag' means reveal a secret. 'Gato de la bolsa' is meaningless in Spanish.",
  },
  {
    id: "barking-wrong-tree",
    englishPattern: /\bbarking up the wrong tree\b/i,
    englishIdiom: "barking up the wrong tree",
    literalTraps: ["ladrando al árbol equivocado", "ladrar al árbol equivocado"],
    correctEquivalents: ["estar equivocado", "buscar donde no es", "ir por mal camino"],
    explanation: "'Barking up the wrong tree' means pursuing a mistaken approach. The literal image is not a Spanish idiom.",
  },
  {
    id: "hold-your-horses",
    englishPattern: /\bhold (your|thy) horses\b/i,
    englishIdiom: "hold your horses",
    literalTraps: ["sujeta tus caballos", "sujetar los caballos", "detén tus caballos"],
    correctEquivalents: ["espera un momento", "tranquilo", "no te precipites", "despacio"],
    explanation: "'Hold your horses' means wait. 'Sujetar caballos' is nonsensical in Spanish.",
  },
  {
    id: "bull-china-shop",
    englishPattern: /\ba bull in a china shop\b/i,
    englishIdiom: "a bull in a china shop",
    literalTraps: ["toro en una tienda de china", "toro en una tienda de porcelana"],
    correctEquivalents: ["como un elefante en una cacharrería", "como un elefante en un bazar"],
    explanation: "'A bull in a china shop' means very clumsy. The Spanish equivalent uses 'elefante en cacharrería'.",
  },
  {
    id: "straight-horses-mouth",
    englishPattern: /\bstraight from the horse'?s mouth\b/i,
    englishIdiom: "straight from the horse's mouth",
    literalTraps: ["boca del caballo", "directo de la boca del caballo"],
    correctEquivalents: ["de primera mano", "de fuente confiable", "directamente de la fuente"],
    explanation: "'Straight from the horse's mouth' means from the original source. 'Boca del caballo' is meaningless.",
  },

  // ===== Emotions & Mental =====
  {
    id: "on-cloud-nine",
    englishPattern: /\bon cloud nine\b|\bon cloud 9\b/i,
    englishIdiom: "on cloud nine",
    literalTraps: ["nube nueve", "en la nube nueve", "nube 9"],
    correctEquivalents: ["en el séptimo cielo", "feliz", "eufórico", "contentísimo"],
    explanation: "'On cloud nine' means extremely happy. 'Nube nueve' is not a Spanish idiom; use 'séptimo cielo'.",
  },
  {
    id: "see-eye-to-eye",
    englishPattern: /\bsee eye to eye\b|\bseeing eye to eye\b/i,
    englishIdiom: "see eye to eye",
    literalTraps: ["ojo a ojo", "ver ojo a ojo"],
    correctEquivalents: ["estar de acuerdo", "pensar igual", "coincidir", "compartir la opinión"],
    explanation: "'See eye to eye' means to agree. 'Ver ojo a ojo' is not idiomatic Spanish.",
  },
  {
    id: "blessing-in-disguise",
    englishPattern: /\ba blessing in disguise\b/i,
    englishIdiom: "a blessing in disguise",
    literalTraps: ["bendición disfrazada", "bendición en disfraz"],
    correctEquivalents: ["no hay mal que por bien no venga", "un bien de un mal"],
    explanation: "'A blessing in disguise' means something good from a bad situation. 'Bendición disfrazada' is not idiomatic.",
  },
  {
    id: "elephant-in-room",
    englishPattern: /\b(the|an) elephant in the room\b/i,
    englishIdiom: "the elephant in the room",
    literalTraps: ["elefante en la habitación"],
    correctEquivalents: ["el problema evidente que nadie menciona", "el tema del elefante", "lo que todos evitan"],
    explanation: "'The elephant in the room' means an obvious problem nobody mentions. The literal translation is not established in Spanish.",
  },

  // ===== Death & Serious =====
  {
    id: "kick-the-bucket",
    englishPattern: /\bkick(?:ed|ing)? the bucket\b/i,
    englishIdiom: "kick the bucket",
    literalTraps: ["patear el cubo", "pateó el cubo", "patear el balde"],
    correctEquivalents: ["estirar la pata", "morir", "fallecer", "pasar a mejor vida"],
    explanation: "'Kick the bucket' means to die. 'Patear el cubo' is meaningless in Spanish.",
  },
  {
    id: "bite-the-dust",
    englishPattern: /\bbite the dust\b|\bbite(?:ting)? the dust\b/i,
    englishIdiom: "bite the dust",
    literalTraps: ["morder el polvo", "muerde el polvo"],
    correctEquivalents: ["morir", "caer", "fracasar", "pasar a mejor vida"],
    explanation: "'Bite the dust' means to die or fail. 'Morder el polvo' is not used idiomatically in Spanish.",
  },

  // ===== Miscellaneous =====
  {
    id: "beat-around-bush",
    englishPattern: /\bbeat(?:ing)? around the bush\b/i,
    englishIdiom: "beat around the bush",
    literalTraps: ["golpear alrededor del arbusto", "golpear el arbusto", "pegar alrededor del arbusto"],
    correctEquivalents: ["dar rodeos", "andarse con rodeos", "no ir al grano"],
    explanation: "'Beat around the bush' means to avoid the topic. 'Golpear el arbusto' is nonsensical.",
  },
  {
    id: "pay-through-nose",
    englishPattern: /\bpay(?:ing)? through the nose\b/i,
    englishIdiom: "pay through the nose",
    literalTraps: ["pagar por la nariz", "pagar por las narices"],
    correctEquivalents: ["pagar un ojo de la cara", "pagar un dineral", "pagar carísimo"],
    explanation: "'Pay through the nose' means to overpay. 'Pagar por la nariz' is meaningless in Spanish.",
  },
  {
    id: "silver-spoon",
    englishPattern: /\bborn with a silver spoon\b|\bsilver spoon in (my|your|his|her) mouth\b/i,
    englishIdiom: "born with a silver spoon",
    literalTraps: ["cuchara de plata", "cucharilla de plata", "nacido con una cuchara de plata"],
    correctEquivalents: ["nacer de pie", "tenerlo todo servido", "nacer con un pan bajo el brazo"],
    explanation: "'Born with a silver spoon' means born wealthy. 'Cuchara de plata' is not the Spanish idiom.",
  },
  {
    id: "nick-of-time",
    englishPattern: /\bin the nick of time\b/i,
    englishIdiom: "in the nick of time",
    literalTraps: ["corte del tiempo", "en el corte del tiempo"],
    correctEquivalents: ["justo a tiempo", "a tiempo", "en el último momento"],
    explanation: "'In the nick of time' means at the last possible moment. 'Corte del tiempo' is meaningless.",
  },
  {
    id: "beat-the-clock",
    englishPattern: /\bbeat(?:ing)? the clock\b/i,
    englishIdiom: "beat the clock",
    literalTraps: ["ganar al reloj", "vencer al reloj", "ganarle al reloj"],
    correctEquivalents: ["llegar a tiempo", "terminar a tiempo", "hacerlo a tiempo"],
    explanation: "'Beat the clock' means to finish before time runs out. 'Ganar al reloj' is not idiomatic.",
  },
  {
    id: "go-extra-mile",
    englishPattern: /\bgo(?:es|ing|ne)? the extra mile\b/i,
    englishIdiom: "go the extra mile",
    literalTraps: ["milla extra", "la milla extra", "ir la milla extra"],
    correctEquivalents: ["esforzarse más", "dar lo máximo", "hacer un esfuerzo extra"],
    explanation: "'Go the extra mile' means to make extra effort. 'Milla extra' is not a natural Spanish expression.",
  },
  {
    id: "throw-under-bus",
    englishPattern: /\bthrow(?:s|ing)? (me|him|her|them|you|someone|anyone) under the bus\b/i,
    englishIdiom: "throw someone under the bus",
    literalTraps: ["debajo del bus", "debajo del autobús", "tirar debajo del bus"],
    correctEquivalents: ["traicionar", "vender", "sacrificar", "echar debajo del agua"],
    explanation: "'Throw under the bus' means to betray someone. 'Debajo del bus' is not a Spanish idiom.",
  },
  {
    id: "jump-the-gun",
    englishPattern: /\bjump(?:ed|ing)? the gun\b/i,
    englishIdiom: "jump the gun",
    literalTraps: ["saltar la pistola", "saltó la pistola", "brincar la pistola"],
    correctEquivalents: ["adelantarse", "precipitarse", "actuar antes de tiempo", "anticiparse"],
    explanation: "'Jump the gun' means to act prematurely. 'Saltar la pistola' is meaningless in Spanish.",
  },
  {
    id: "cold-feet",
    englishPattern: /\bget(?:ting|s)? cold feet\b|\bcold feet\b/i,
    englishIdiom: "cold feet",
    literalTraps: ["pies fríos", "pie frío"],
    correctEquivalents: ["acobardarse", "echarse atrás", "amilanarse", "perder el valor"],
    explanation: "'Cold feet' means to lose courage. 'Pies fríos' is not used as an idiom in Spanish.",
  },
  {
    id: "hit-the-roof",
    englishPattern: /\bhit the roof\b|\bhit the ceiling\b|\bgo through the roof\b/i,
    englishIdiom: "hit the roof/ceiling",
    literalTraps: ["golpear el techo", "golpear el tejado", "dar en el techo"],
    correctEquivalents: ["ponerse furioso", "saltar por los aires", "ponerse como una fiera", "subirse por las paredes"],
    explanation: "'Hit the roof' means to become very angry. 'Golpear el techo' is not idiomatic Spanish.",
  },
  {
    id: "cry-over-spilled-milk",
    englishPattern: /\bcry(?:ing)? over spilled milk\b|\bcry(?:ing)? over spilt milk\b/i,
    englishIdiom: "cry over spilled milk",
    literalTraps: ["llorar sobre la leche derramada", "llorar por leche derramada"],
    correctEquivalents: ["lo hecho, hecho está", "no hay llanto que valga", "no sirve de nada llorar"],
    explanation: "'Cry over spilled milk' means regretting what cannot be changed. The literal is not idiomatic Spanish.",
  },
  {
    id: "give-cold-shoulder",
    englishPattern: /\bgive(?:s|ing)? (me|him|her|them|you|someone|anyone) the cold shoulder\b/i,
    englishIdiom: "give the cold shoulder",
    literalTraps: ["hombro frío", "el hombro frío", "dar el hombro frío"],
    correctEquivalents: ["ignorar", "dar calabazas", "tratar con frialdad", "dar de lado"],
    explanation: "'Give the cold shoulder' means to deliberately ignore. 'Hombro frío' is meaningless in Spanish.",
  },
  {
    id: "sit-on-fence",
    englishPattern: /\bsit(?:ting)? on the fence\b/i,
    englishIdiom: "sit on the fence",
    literalTraps: ["sentado en la cerca", "sentarse en la cerca", "sentado en la valla"],
    correctEquivalents: ["ser indeciso", "mantenerse neutral", "no mojarse", "estar entre dos fuegos"],
    explanation: "'Sit on the fence' means to be undecided. 'Sentarse en la cerca' is not idiomatic Spanish.",
  },
  {
    id: "shoot-in-foot",
    englishPattern: /\bshoot(?:ing)? (myself|yourself|himself|herself|themselves|oneself)? in the foot\b/i,
    englishIdiom: "shoot oneself in the foot",
    literalTraps: ["disparar en el pie", "dispararse en el pie", "pegarse un tiro en el pie"],
    correctEquivalents: ["sabotearse", "perjudicarse", "cometer un error", "hacerse daño a uno mismo"],
    explanation: "'Shoot oneself in the foot' means to harm oneself through own actions. The literal is too violent for the intended meaning.",
  },
];

export function detectIdioms(sourceText: string): IdiomRule[] {
  return IDIOM_RULES.filter((rule) => rule.englishPattern.test(sourceText));
}

export function buildIdiomGuidance(
  sourceText: string,
  dialect: SpanishDialect
): string | undefined {
  const matched = detectIdioms(sourceText);
  if (matched.length === 0) return undefined;

  const parts = matched.map((rule) => {
    const dialectEquivs = rule.dialectEquivalents?.[dialect];
    const allCorrect = dialectEquivs
      ? [...new Set([...dialectEquivs, ...rule.correctEquivalents])]
      : rule.correctEquivalents;

    return (
      `English idiom "${rule.englishIdiom}" detected. ${rule.explanation} ` +
      `Do NOT translate literally (avoid: ${rule.literalTraps.join(", ")}). ` +
      `Use idiomatic Spanish instead (e.g.: ${allCorrect.slice(0, 3).join(", ")}).`
    );
  });

  return `Idiom detection: ${parts.join(" ")}`;
}

export function buildIdiomExpectations(
  sourceText: string,
  dialect: SpanishDialect
): { forbiddenLiteralTerms: string[]; expectedCorrectTerms: string[] } {
  const matched = detectIdioms(sourceText);
  if (matched.length === 0) return { forbiddenLiteralTerms: [], expectedCorrectTerms: [] };

  const forbidden: string[] = [];
  const expected: string[] = [];

  for (const rule of matched) {
    forbidden.push(...rule.literalTraps);
    const dialectEquivs = rule.dialectEquivalents?.[dialect];
    const correct = dialectEquivs
      ? [...new Set([...dialectEquivs, ...rule.correctEquivalents])]
      : rule.correctEquivalents;
    expected.push(...correct);
  }

  return {
    forbiddenLiteralTerms: [...new Set(forbidden)],
    expectedCorrectTerms: [...new Set(expected)],
  };
}

export function checkIdiomCompliance(
  translated: string,
  sourceText: string,
  dialect: SpanishDialect
): { passed: boolean; literalTraps: string[] } {
  const { forbiddenLiteralTerms } = buildIdiomExpectations(sourceText, dialect);
  const lower = translated.toLowerCase();

  const traps = forbiddenLiteralTerms.filter((term) =>
    lower.includes(term.toLowerCase())
  );

  return { passed: traps.length === 0, literalTraps: traps };
}
