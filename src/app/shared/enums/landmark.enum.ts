import { liveLabels, tr } from '../i18n/lang';

// RAW Georgian labels — never read directly, see LANDMARK_OPTIONS/_LABELS.
const LANDMARK_OPTIONS_KA: readonly { id: string; name: string }[] = [
  { id: 'kus-tba', name: 'კუს ტბა' },
  { id: 'lisi', name: 'ლისის ტბა' },
  { id: 'expo-park', name: 'ექსპო ჯორჯია' },
  { id: 'mtatsmindis-parki', name: 'მთაწმინდის პარკი' },
];

/**
 * Known Tbilisi landmarks a court can sit at (docs/26 §WP-1: players search
 * «პადელი კუს ტბაზე», not only by district). Shared by the facility form and
 * the venues directory. The latin `id` is the stored value AND the landing
 * page slug (`/padelis-kortebi/<id>`) — sent to the API verbatim, never
 * translated; `name` is a live getter, so the label follows the language
 * toggle on every read.
 */
export const LANDMARK_OPTIONS: readonly { id: string; name: string }[] = LANDMARK_OPTIONS_KA.map(
  ({ id, name }) => ({
    id,
    get name(): string {
      return tr(name);
    },
  }),
);

export const LANDMARK_LABELS: Record<string, string> = liveLabels(
  LANDMARK_OPTIONS_KA.reduce(
    (acc, { id, name }) => {
      acc[id] = name;
      return acc;
    },
    {} as Record<string, string>,
  ),
);
