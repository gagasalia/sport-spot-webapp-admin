import { tr } from '../../../shared/i18n/lang';

/**
 * A user-facing sentence kept RAW (Georgian key with `%s` slots + its
 * arguments) so it is translated at RENDER time — the console's pure utils
 * return these instead of strings (docs/16 v2: never bake a translation).
 */
export interface Msg {
  key: string;
  args?: MsgArg[];
}

/** A number, plain text (names, codes), or a RAW-Georgian word translated at render. */
export type MsgArg = number | string | { t: string };

/** The message in the live language: `%s` slots filled left to right. */
export function renderMsg(msg: Msg | null | undefined): string {
  if (!msg) return '';
  const args = msg.args ?? [];
  let i = 0;
  return tr(msg.key).replace(/%s/g, () => {
    const arg = args[i++];
    if (arg === undefined) return '';
    if (typeof arg === 'number') return String(arg);
    if (typeof arg === 'string') return arg;
    return tr(arg.t);
  });
}
