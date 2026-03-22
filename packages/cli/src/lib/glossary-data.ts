/**
 * Built-in glossary data for technical terms
 * Common programming and technical translations
 */

import type { GlossaryEntry } from "@espanol/types";

/**
 * Built-in glossary entries organized by category
 */
export const GLOSSARY_DATA: GlossaryEntry[] = [
  // Programming category
  { term: "algorithm", translation: "algoritmo", category: "programming" },
  { term: "array", translation: "arreglo", category: "programming" },
  { term: "array", translation: "matriz", category: "programming" },
  { term: "bug", translation: "error", category: "programming" },
  { term: "bug", translation: "bicho", category: "programming" },
  { term: "class", translation: "clase", category: "programming" },
  { term: "code", translation: "código", category: "programming" },
  { term: "compile", translation: "compilar", category: "programming" },
  { term: "compiler", translation: "compilador", category: "programming" },
  { term: "constant", translation: "constante", category: "programming" },
  { term: "debug", translation: "depurar", category: "programming" },
  { term: "debugger", translation: "depurador", category: "programming" },
  { term: "deployment", translation: "despliegue", category: "programming" },
  { term: "error", translation: "error", category: "programming" },
  { term: "exception", translation: "excepción", category: "programming" },
  { term: "function", translation: "función", category: "programming" },
  { term: "interface", translation: "interfaz", category: "programming" },
  { term: "library", translation: "biblioteca", category: "programming" },
  { term: "library", translation: "librería", category: "programming" },
  { term: "loop", translation: "bucle", category: "programming" },
  { term: "method", translation: "método", category: "programming" },
  { term: "object", translation: "objeto", category: "programming" },
  { term: "parameter", translation: "parámetro", category: "programming" },
  { term: "pointer", translation: "puntero", category: "programming" },
  { term: "program", translation: "programa", category: "programming" },
  { term: "programming", translation: "programación", category: "programming" },
  { term: "runtime", translation: "tiempo de ejecución", category: "programming" },
  { term: "software", translation: "software", category: "programming" },
  { term: "statement", translation: "sentencia", category: "programming" },
  { term: "string", translation: "cadena", category: "programming" },
  { term: "string", translation: "hilera", category: "programming" },
  { term: "syntax", translation: "sintaxis", category: "programming" },
  { term: "variable", translation: "variable", category: "programming" },

  // Technical category
  { term: "API", translation: "API", category: "technical" },
  { term: "application", translation: "aplicación", category: "technical" },
  { term: "bandwidth", translation: "ancho de banda", category: "technical" },
  { term: "browser", translation: "navegador", category: "technical" },
  { term: "cache", translation: "caché", category: "technical" },
  { term: "cloud", translation: "nube", category: "technical" },
  { term: "computer", translation: "computador", category: "technical" },
  { term: "computer", translation: "ordenador", category: "technical" },
  { term: "data", translation: "datos", category: "technical" },
  { term: "database", translation: "base de datos", category: "technical" },
  { term: "debugging", translation: "depuración", category: "technical" },
  { term: "development", translation: "desarrollo", category: "technical" },
  { term: "device", translation: "dispositivo", category: "technical" },
  { term: "directory", translation: "directorio", category: "technical" },
  { term: "directory", translation: "carpeta", category: "technical" },
  { term: "domain", translation: "dominio", category: "technical" },
  { term: "email", translation: "correo electrónico", category: "technical" },
  { term: "endpoint", translation: "punto de conexión", category: "technical" },
  { term: "file", translation: "archivo", category: "technical" },
  { term: "file", translation: "fichero", category: "technical" },
  { term: "filesystem", translation: "sistema de archivos", category: "technical" },
  { term: "framework", translation: "marco de trabajo", category: "technical" },
  { term: "hardware", translation: "hardware", category: "technical" },
  { term: "host", translation: "anfitrión", category: "technical" },
  { term: "host", translation: "servidor", category: "technical" },
  { term: "HTTP", translation: "HTTP", category: "technical" },
  { term: "HTTPS", translation: "HTTPS", category: "technical" },
  { term: "interface", translation: "interfaz", category: "technical" },
  { term: "IP address", translation: "dirección IP", category: "technical" },
  { term: "keyboard", translation: "teclado", category: "technical" },
  { term: "latency", translation: "latencia", category: "technical" },
  { term: "memory", translation: "memoria", category: "technical" },
  { term: "monitor", translation: "monitor", category: "technical" },
  { term: "mouse", translation: "ratón", category: "technical" },
  { term: "mouse", translation: "mouse", category: "technical" },
  { term: "network", translation: "red", category: "technical" },
  { term: "operating system", translation: "sistema operativo", category: "technical" },
  { term: "password", translation: "contraseña", category: "technical" },
  { term: "path", translation: "ruta", category: "technical" },
  { term: "path", translation: "camino", category: "technical" },
  { term: "processor", translation: "procesador", category: "technical" },
  { term: "protocol", translation: "protocolo", category: "technical" },
  { term: "repository", translation: "repositorio", category: "technical" },
  { term: "response time", translation: "tiempo de respuesta", category: "technical" },
  { term: "screen", translation: "pantalla", category: "technical" },
  { term: "server", translation: "servidor", category: "technical" },
  { term: "software", translation: "software", category: "technical" },
  { term: "URL", translation: "URL", category: "technical" },
  { term: "username", translation: "nombre de usuario", category: "technical" },
  { term: "web", translation: "web", category: "technical" },
  { term: "website", translation: "sitio web", category: "technical" },
  { term: "WiFi", translation: "WiFi", category: "technical" },

  // Business category
  { term: "account", translation: "cuenta", category: "business" },
  { term: "budget", translation: "presupuesto", category: "business" },
  { term: "business", translation: "negocio", category: "business" },
  { term: "client", translation: "cliente", category: "business" },
  { term: "company", translation: "empresa", category: "business" },
  { term: "contract", translation: "contrato", category: "business" },
  { term: "cost", translation: "costo", category: "business" },
  { term: "customer", translation: "cliente", category: "business" },
  { term: "deadline", translation: "fecha límite", category: "business" },
  { term: "discount", translation: "descuento", category: "business" },
  { term: "employee", translation: "empleado", category: "business" },
  { term: "employer", translation: "empleador", category: "business" },
  { term: "expense", translation: "gasto", category: "business" },
  { term: "income", translation: "ingreso", category: "business" },
  { term: "invoice", translation: "factura", category: "business" },
  { term: "manager", translation: "gerente", category: "business" },
  { term: "meeting", translation: "reunión", category: "business" },
  { term: "offer", translation: "oferta", category: "business" },
  { term: "payment", translation: "pago", category: "business" },
  { term: "price", translation: "precio", category: "business" },
  { term: "profit", translation: "ganancia", category: "business" },
  { term: "profit", translation: "beneficio", category: "business" },
  { term: "project", translation: "proyecto", category: "business" },
  { term: "receipt", translation: "recibo", category: "business" },
  { term: "report", translation: "informe", category: "business" },
  { term: "revenue", translation: "ingreso", category: "business" },
  { term: "salary", translation: "salario", category: "business" },
  { term: "sales", translation: "ventas", category: "business" },
  { term: "service", translation: "servicio", category: "business" },
  { term: "stakeholder", translation: "interesado", category: "business" },
  { term: "supplier", translation: "proveedor", category: "business" },
  { term: "team", translation: "equipo", category: "business" },
  { term: "user", translation: "usuario", category: "business" },

  // General category
  { term: "access", translation: "acceso", category: "general" },
  { term: "action", translation: "acción", category: "general" },
  { term: "change", translation: "cambio", category: "general" },
  { term: "click", translation: "clic", category: "general" },
  { term: "configuration", translation: "configuración", category: "general" },
  { term: "content", translation: "contenido", category: "general" },
  { term: "date", translation: "fecha", category: "general" },
  { term: "description", translation: "descripción", category: "general" },
  { term: "download", translation: "descargar", category: "general" },
  { term: "error", translation: "error", category: "general" },
  { term: "feature", translation: "característica", category: "general" },
  { term: "feature", translation: "funcionalidad", category: "general" },
  { term: "help", translation: "ayuda", category: "general" },
  { term: "language", translation: "idioma", category: "general" },
  { term: "language", translation: "lenguaje", category: "general" },
  { term: "link", translation: "enlace", category: "general" },
  { term: "login", translation: "iniciar sesión", category: "general" },
  { term: "logout", translation: "cerrar sesión", category: "general" },
  { term: "message", translation: "mensaje", category: "general" },
  { term: "name", translation: "nombre", category: "general" },
  { term: "option", translation: "opción", category: "general" },
  { term: "page", translation: "página", category: "general" },
  { term: "password", translation: "contraseña", category: "general" },
  { term: "search", translation: "búsqueda", category: "general" },
  { term: "search", translation: "buscar", category: "general" },
  { term: "setting", translation: "configuración", category: "general" },
  { term: "setting", translation: "ajuste", category: "general" },
  { term: "status", translation: "estado", category: "general" },
  { term: "status", translation: "estatus", category: "general" },
  { term: "success", translation: "éxito", category: "general" },
  { term: "support", translation: "soporte", category: "general" },
  { term: "text", translation: "texto", category: "general" },
  { term: "title", translation: "título", category: "general" },
  { term: "update", translation: "actualización", category: "general" },
  { term: "update", translation: "actualizar", category: "general" },
  { term: "user", translation: "usuario", category: "general" },
  { term: "value", translation: "valor", category: "general" },
  { term: "version", translation: "versión", category: "general" },
  { term: "view", translation: "vista", category: "general" },
  { term: "view", translation: "ver", category: "general" },
  { term: "warning", translation: "advertencia", category: "general" },
];

/**
 * Available categories in the glossary
 */
export const GLOSSARY_CATEGORIES = [
  "programming",
  "technical",
  "business",
  "general"
] as const;

/**
 * Search glossary for matching terms
 * Returns entries where the term contains the search query (case-insensitive)
 */
export function searchGlossary(query: string): GlossaryEntry[] {
  if (!query || query.trim() === "") {
    return [];
  }

  const lowerQuery = query.toLowerCase();

  return GLOSSARY_DATA.filter(entry =>
    entry.term.toLowerCase().includes(lowerQuery) ||
    entry.translation.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get glossary entries by category
 */
export function getGlossaryByCategory(category?: string): GlossaryEntry[] {
  if (!category) {
    // Return all entries if no category specified
    return GLOSSARY_DATA;
  }

  const lowerCategory = category.toLowerCase();

  return GLOSSARY_DATA.filter(entry =>
    entry.category?.toLowerCase() === lowerCategory
  );
}

/**
 * Format glossary results for display
 */
export function formatGlossaryResults(
  entries: GlossaryEntry[],
  format: "text" | "json"
): string {
  if (entries.length === 0) {
    return format === "json"
      ? JSON.stringify([], null, 2)
      : "No results found.";
  }

  if (format === "json") {
    return JSON.stringify(entries, null, 2);
  }

  // Text format
  const lines: string[] = [];

  // Group by category
  const grouped = entries.reduce((acc, entry) => {
    const category = entry.category || "uncategorized";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(entry);
    return acc;
  }, {} as Record<string, GlossaryEntry[]>);

  // Display by category
  for (const [category, categoryEntries] of Object.entries(grouped)) {
    lines.push(`\n${category.toUpperCase()}`);
    lines.push("=".repeat(category.length));

    for (const entry of categoryEntries) {
      lines.push(`  ${entry.term} → ${entry.translation}`);
    }
  }

  return lines.join("\n").trim();
}
