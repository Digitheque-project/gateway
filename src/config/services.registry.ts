/**
 * Registre des services proxifiés par la gateway — SOURCE DE VÉRITÉ UNIQUE.
 *
 * Ajouter un nouveau service = ajouter UNE entrée ci-dessous + sa variable
 * d'environnement (cf. .env.example). Le proxy, le contrôle JWT, la page
 * d'accueil, le keep-alive, le wake-up et les logs de démarrage sont tous
 * générés automatiquement depuis ce registre : aucun autre fichier à modifier.
 *
 * Changer l'URL d'un service = modifier uniquement sa variable d'environnement.
 */

export interface ServiceEntry {
  /** Nom d'affichage (page d'accueil, wake-up, logs). */
  name: string;
  /**
   * Préfixe de route du service.
   * Par convention, la doc Swagger est exposée sur /<prefix>/api/docs.
   */
  prefix: string;
  /**
   * Nom de la variable d'environnement contenant l'URL de base du service
   * (origine uniquement, ex. https://host:port).
   */
  urlEnv: string;
  /** Préfixes des chemins API à proxifier vers ce service. */
  paths: string[];
  /**
   * true = JWT obligatoire sur ces chemins.
   * Les chemins contenant '/docs' (pages Swagger) restent publics.
   */
  requiresAuth?: boolean;
  /**
   * Chemin de la doc Swagger si différent de la convention /<prefix>/api/docs.
   * - chemin relatif ('/xxx/api/docs') → proxifié via la gateway ;
   * - URL absolue ('https://...') → simple lien externe sur la page d'accueil,
   *   NON proxifié (utile quand la doc ne peut pas suivre la convention,
   *   ex. exposée à la racine du service).
   */
  docsPath?: string;
  /** Description affichée sur la carte de la page d'accueil. */
  description?: string;
}

export const SERVICES: ServiceEntry[] = [
  // ------------------------------------------------------------------
  // Services internes (socle)
  // ------------------------------------------------------------------
  {
    name: 'Auth',
    prefix: 'auth',
    urlEnv: 'AUTH_SERVICE_URL',
    paths: ['/auth', '/roles', '/permissions'],
    description: 'Authentification, rôles, permissions',
  },
  {
    name: 'Users',
    prefix: 'users',
    urlEnv: 'USER_SERVICE_URL',
    paths: ['/users', '/user-service-roles'],
    description: 'Gestion des utilisateurs',
  },
  {
    name: 'Services',
    prefix: 'services',
    urlEnv: 'SERVICE_SERVICE_URL',
    paths: ['/services'],
    description: 'Gestion des services hospitaliers',
  },
  {
    name: 'CHU',
    prefix: 'chu',
    urlEnv: 'CHU_SERVICE_URL',
    paths: ['/chu', '/prise-en-charge'],
    description: 'Gestion des établissements CHU',
  },

  // ------------------------------------------------------------------
  // Services cliniques / externes (JWT exigé à la gateway)
  // ------------------------------------------------------------------
  {
    name: 'Clinique',
    prefix: 'clinique',
    urlEnv: 'CLINIQUE_SERVICE_URL',
    paths: ['/clinique'],
    requiresAuth: true,
    description: 'Hospitalisation (épisodes, avis, rapports)',
  },
  {
    name: 'Dossier Patient',
    prefix: 'dossier-patient',
    urlEnv: 'DOSSIER_PATIENT_SERVICE_URL',
    paths: ['/dossier-patient'],
    requiresAuth: true,
    description: 'Dossiers médicaux des patients',
  },
  {
    name: 'Accueil',
    prefix: 'accueil',
    urlEnv: 'ACCUEIL_SERVICE_URL',
    paths: ['/accueil'],
    requiresAuth: true,
    description: 'Accueil et admissions des patients',
  },
  {
    name: 'Notification',
    prefix: 'notification',
    urlEnv: 'NOTIFICATION_SERVICE_URL',
    paths: ['/notifications'],
    requiresAuth: true,
    description: 'Notifications temps réel',
  },
  {
    name: 'Upload',
    prefix: 'upload',
    urlEnv: 'UPLOAD_SERVICE_URL',
    paths: ['/files', '/upload'],
    requiresAuth: true,
    description: 'Upload et stockage de fichiers',
  },
  {
    name: 'Endoscopie',
    prefix: 'endoscopie',
    urlEnv: 'ENDOSCOPIE_SERVICE_URL',
    paths: ['/endoscopie'],
    requiresAuth: true,
    description: "Gestion des services d'endoscopie",
  },
  {
    name: 'Prescription',
    prefix: 'prescriptions',
    urlEnv: 'PRESCRIPTION_SERVICE_URL',
    paths: ['/prescriptions'],
    requiresAuth: true,
    description: 'Gestion des prescriptions médicales',
  },
  {
    name: 'EEG',
    prefix: 'eeg',
    urlEnv: 'EEG_SERVICE_URL',
    paths: ['/eeg'],
    requiresAuth: true,
    description: "Gestion des services d'EEG",
  },
  {
    name: 'Stomato',
    prefix: 'stomato',
    urlEnv: 'STOMATO_SERVICE_URL',
    paths: ['/stomato'],
    requiresAuth: true,
    description: 'Gestion de la stomatologie',
  },
  {
    name: 'Anesthésie-Réanimation',
    prefix: 'bloc',
    urlEnv: 'ANESTHESIE_REANIMATION_SERVICE_URL',
    paths: ['/bloc'],
    requiresAuth: true,
    description: "Gestion de l'anesthésie-réanimation (bloc opératoire)",
  },
  {
    name: 'Pharmacie',
    prefix: 'pharmacie',
    urlEnv: 'PHARMACIE_SERVICE_URL',
    // '/pharmacie' seul ne correspond à AUCUNE route réelle du service (ses
    // routes sont à la racine : /articles, /stock, /dispensations...) — ce
    // qui rendait tout le service inaccessible via la gateway (404
    // systématique). Ajout de '/articles', le seul sous-chemin actuellement
    // consommé par un autre service du CHU, sans collision avec un autre
    // service du registre (vérifié).
    paths: ['/pharmacie', '/articles'],
    requiresAuth: true,
    description: 'Gestion de la pharmacie',
  },
  {
    name: 'Consultation',
    prefix: 'consultation',
    urlEnv: 'CONSULTATION_SERVICE_URL',
    paths: ['/consultation'],
    requiresAuth: true,
    description: 'Consultations externes',
  },
  {
    name: 'ORL',
    prefix: 'orl',
    urlEnv: 'ORL_SERVICE_URL',
    paths: ['/orl'],
    requiresAuth: true,
    description: "Gestion des services d'ORL",
  },
  {
    name: 'Imagerie',
    prefix: 'imagerie',
    urlEnv: 'IMAGERIE_SERVICE_URL',
    paths: ['/imagerie'],
    requiresAuth: true,
    description: 'Gestion des services imagerie',
  },
  {
    name: 'Laboratoire',
    prefix: 'laboratoire',
    urlEnv: 'LABORATOIRE_SERVICE_URL',
    paths: ['/laboratoire'],
    requiresAuth: true,
    description: 'Gestion des services laboratoire',
  },
  {
    name: 'Anapath',
    prefix: 'anapath',
    urlEnv: 'ANAPATH_SERVICE_URL',
    paths: ['/anapath'],
    requiresAuth: true,
    description: "Gestion des services d'anatomopathologie",
  },
  {
    name: 'Banque de sang',
    prefix: 'banque-sang',
    urlEnv: 'BANQUE_DE_SANG_SERVICE_URL',
    paths: ['/banque-sang'],
    requiresAuth: true,
    description: "Gestion des services de banque de sang",
  },
  {
    name: 'kinésithérapie',
    prefix: 'kine',
    urlEnv: 'KINESITHERAPIE_SERVICE_URL',
    paths: ['/kine'],
    requiresAuth: true,
    description: "Gestion des services de kinésithérapie",
  },
];

/**
 * Chemin (ou URL absolue) de la doc Swagger d'un service :
 * convention /<prefix>/api/docs, sauf si docsPath est défini.
 */
export function docsPathOf(service: ServiceEntry): string {
  return service.docsPath ?? `/${service.prefix}/api/docs`;
}

/**
 * Chemins surveillés par le proxy pour un service :
 * ses chemins API + le chemin de sa doc Swagger, UNIQUEMENT s'il est relatif.
 * Une doc déclarée en URL absolue (https://...) n'est pas proxifiée :
 * c'est un simple lien externe sur la page d'accueil.
 */
export function watchPathsOf(service: ServiceEntry): string[] {
  const docsPath = docsPathOf(service);
  return docsPath.startsWith('/')
    ? [...service.paths, docsPath]
    : [...service.paths];
}
