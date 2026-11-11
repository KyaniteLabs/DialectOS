// Only the parts of @dialectos/types the substitution engine needs, so the
// bundle does not pull in zod or the rest of the package.
export { DICTIONARY } from "../../packages/types/src/dialectal-dictionary.js";
export { getVocabularyForDialect } from "../../packages/types/src/dialectal-vocabulary.js";
export { resolveNounGender } from "../../packages/types/src/noun-gender.js";
