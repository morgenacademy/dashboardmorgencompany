// Gedeeld door de acquisitie-sync en de Analyse-tab, zodat er één afleiding is.
// service_label kent 5 waarden: inspire, build, train, implement, other.
// LET OP: 'training' -> 'train' is de meerderheid, maar keynotes/inspiratie zitten
// óók onder product_type 'training' en horen 'inspire'. De sync zet daarom
// label_reviewed=false op afgeleide labels, zodat 'train' langs de wizard komt.
export const PRODUCT_TYPE_TO_LABEL = {
  automatisering: 'build',
  abonnement: 'build',
  training: 'train',
  strategie: 'implement',
  programma: 'implement',
  samenwerking: 'other',
  other: 'other',
};

export function deriveServiceLabel(productType) {
  return PRODUCT_TYPE_TO_LABEL[productType] || 'other';
}

export function deriveChannel(text) {
  return /michielpro/i.test(String(text || '')) ? 'michielpro' : 'direct';
}
