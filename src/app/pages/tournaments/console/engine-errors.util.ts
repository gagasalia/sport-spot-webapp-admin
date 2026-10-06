/**
 * Engine errors → an inline sentence where the action happened (docs/33 §5:
 * `400 / 409 { message: '<code>: <text>' }`). The code picks a RAW-Georgian
 * sentence (translated at render); the API's own text after the code rides
 * along as the detail.
 */
import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from '../../../services/http-services/ranking.service';
import {
  ERR_DOWNSTREAM_RESULT,
  ERR_DRAW_EXISTS,
  ERR_DRAW_HAS_RESULTS,
  ERR_GROUPS_CLOSED,
  ERR_GROUPS_NOT_CLOSED,
  ERR_GROUPS_PENDING,
  ERR_INVALID_RESULT,
  ERR_INVALID_STRUCTURE,
  ERR_MATCH_NOT_READY,
  ERR_NOT_ENOUGH_ENTRANTS,
  ERR_NO_DRAW,
  ERR_NO_STRUCTURE,
  ERR_ROUND_PENDING,
  ERR_SWAP_NOT_ALLOWED,
} from '../../../shared/models/tournament-engine.model';

export interface EngineError {
  /** RAW Georgian — render with `| t`. */
  message: string;
  /** The API's own words (English), or ''. */
  detail: string;
}

export const ENGINE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [ERR_NO_STRUCTURE]: 'ჯერ ფორმატის პარამეტრები შეინახეთ',
  [ERR_DRAW_EXISTS]: 'კენჭისყრა უკვე ჩატარებულია — შესაცვლელად ჯერ გააუქმეთ კენჭისყრა',
  [ERR_NO_DRAW]: 'ჯერ კენჭისყრა ჩაატარეთ',
  [ERR_DRAW_HAS_RESULTS]: 'შედეგები უკვე შეყვანილია',
  [ERR_NOT_ENOUGH_ENTRANTS]: 'მონაწილეები არ ჰყოფნის ამ ფორმატს',
  [ERR_MATCH_NOT_READY]: 'მატჩის ორივე მხარე ჯერ არ არის ცნობილი',
  [ERR_DOWNSTREAM_RESULT]: 'შემდეგ მატჩს უკვე აქვს შედეგი — ჯერ ის წაშალეთ',
  [ERR_GROUPS_CLOSED]: 'ჯგუფური ეტაპი დახურულია — შედეგის შესაცვლელად ხელახლა გახსენით',
  [ERR_GROUPS_PENDING]: 'ჯგუფურ მატჩებს შედეგი აკლია',
  [ERR_GROUPS_NOT_CLOSED]: 'ჯგუფური ეტაპი არ არის დახურული',
  [ERR_ROUND_PENDING]: 'ჯერ მიმდინარე რაუნდის ყველა შედეგი შეიყვანეთ',
  [ERR_INVALID_RESULT]: 'შედეგი არასწორია',
  [ERR_INVALID_STRUCTURE]: 'ფორმატის პარამეტრები არასწორია',
  [ERR_SWAP_NOT_ALLOWED]: 'გაცვლა შეუძლებელია',
};

/** Plain (code-less) API messages the console can meet. */
const PLAIN_MESSAGES: readonly [RegExp, string][] = [
  [/tournament is full/i, 'ადგილები შევსებულია — გაზარდეთ ტურნირის ადგილები'],
  [/already registered/i, 'ეს მოთამაშე უკვე დარეგისტრირებულია'],
  [/read-only/i, 'დასრულებული ან გაუქმებული ტურნირი აღარ იცვლება'],
  [/external tournament/i, 'გარე ტურნირს აქ კენჭისყრა არ აქვს'],
  [/no slot fits/i, 'სესიებში ერთი მატჩიც ვერ ეტევა — შეამოწმეთ დრო და ხანგრძლივობა'],
  [/at most \d+ categories/i, 'ღონისძიებაში მაქსიმუმ 12 კატეგორიაა'],
];

export function describeEngineError(err: unknown): EngineError {
  const raw = apiErrorMessage(err).trim();
  const status = err instanceof HttpErrorResponse ? err.status : 0;
  const match = /^([a-z_]+)(?::\s*(.*))?$/s.exec(raw);
  if (match && ENGINE_ERROR_MESSAGES[match[1]]) {
    return { message: ENGINE_ERROR_MESSAGES[match[1]], detail: (match[2] ?? '').trim() };
  }
  for (const [pattern, message] of PLAIN_MESSAGES) {
    if (pattern.test(raw)) return { message, detail: '' };
  }
  if (status === 403) return { message: 'ამ ტურნირზე წვდომა არ გაქვთ', detail: '' };
  if (status === 404) return { message: 'ვერ მოიძებნა — განაახლეთ გვერდი', detail: raw };
  if (status === 400 || status === 409) {
    return { message: 'შეამოწმე ველები — მოთხოვნა ვერ დამუშავდა', detail: raw };
  }
  return { message: 'მოქმედება ვერ შესრულდა, სცადეთ თავიდან', detail: '' };
}
