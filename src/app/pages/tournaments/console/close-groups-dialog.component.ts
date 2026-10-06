import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TPipe } from '../../../shared/i18n/t.pipe';
import {
  CloseGroupsDto,
  GroupView,
  ScoringType,
  StandingRowView,
} from '../../../shared/models/tournament-engine.model';
import { SS_DIALOG_CONTEXT, SsDialogContext } from '../../../shared/ui/dialog.service';

export interface CloseGroupsDialogData {
  groups: GroupView[];
  /** entrant id → display name. */
  names: Record<string, string>;
  /** Group matches without a result (closing then needs `force`). */
  pending: number;
  scoring: ScoringType;
}

/** Two rows the table cannot tell apart by what it shows. */
export function isLevel(a: StandingRowView, b: StandingRowView, scoring: ScoringType): boolean {
  if (scoring === 'points') {
    return (
      a.pointsFor === b.pointsFor &&
      a.pointsFor - a.pointsAgainst === b.pointsFor - b.pointsAgainst &&
      a.won === b.won
    );
  }
  return (
    a.won === b.won &&
    a.lost === b.lost &&
    a.setsFor - a.setsAgainst === b.setsFor - b.setsAgainst &&
    a.gamesFor - a.gamesAgainst === b.gamesFor - b.gamesAgainst &&
    a.gamesFor === b.gamesFor
  );
}

/** The `orders` body: only the groups whose order the organizer changed. */
export function changedOrders(
  groups: GroupView[],
  orders: Record<string, string[]>,
): Record<string, string[]> | undefined {
  const out: Record<string, string[]> = {};
  for (const group of groups) {
    const order = orders[group.key];
    const table = group.standings.map((row) => row.entrant);
    if (order && order.join('|') !== table.join('|')) out[group.key] = order;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * «ჯგუფური ეტაპის დახურვა» (docs/33 §4): fixes every table and fills the
 * bracket. Rows that are LEVEL on everything the table shows can be put in
 * order by hand (the API takes `orders` for ties it cannot break); with group
 * matches still unplayed the organizer confirms closing anyway (`force`).
 * Completes with the request body.
 */
@Component({
  selector: 'app-close-groups-dialog',
  standalone: true,
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4" data-testid="close-groups-dialog">
      @if (data.pending > 0) {
        <p class="m-0 p-3 rounded-lg text-sm georgian-text" lang="ka" style="background: var(--tui-status-warning-pale); color: var(--warning)">
          {{ 'შედეგი აკლია ჯგუფურ მატჩებს:' | t }} <b class="ss-num">{{ data.pending }}</b>.
          {{ 'დახურვის შემდეგ ცხრილი ისე დაფიქსირდება, როგორც ახლაა.' | t }}
        </p>
      }
      @if (hasTies()) {
        <p class="m-0 text-sm georgian-text" lang="ka" style="color: var(--text-muted)">
          {{ 'თანაბარი ადგილები ისრებით დაალაგეთ — ბადეში ეს რიგი წავა.' | t }}
        </p>
      } @else {
        <p class="m-0 text-sm georgian-text" lang="ka" style="color: var(--text-muted)">
          {{ 'ცხრილები დაფიქსირდება და ბადე შეივსება.' | t }}
        </p>
      }
      <div class="flex flex-col gap-3 max-h-[50vh] overflow-y-auto">
        @for (group of data.groups; track group.key) {
          <div class="rounded-lg p-2" style="border: 1px solid var(--hairline)">
            <div class="text-xs font-semibold mb-1 georgian-text" lang="ka" style="color: var(--text-muted)">
              {{ 'ჯგუფი' | t }} {{ group.key }}
            </div>
            <ol class="m-0 p-0 list-none flex flex-col gap-1">
              @for (id of orders()[group.key]; track id; let i = $index) {
                <li class="flex items-center gap-2 text-sm" [attr.data-testid]="'order-' + group.key + '-' + i">
                  <span class="ss-num w-5 text-right" style="color: var(--text-faint)">{{ i + 1 }}</span>
                  <span class="flex-1 min-w-0 truncate">{{ nameOf(id) }}</span>
                  @if (tiedAbove(group, i) || tiedBelow(group, i)) {
                    <span class="ss-badge ss-badge--warning georgian-text" lang="ka">{{ 'თანაბარი' | t }}</span>
                  }
                  <button
                    class="ss-icon-btn ss-icon-btn--s"
                    type="button"
                    [disabled]="!tiedAbove(group, i)"
                    [attr.aria-label]="'ზემოთ' | t"
                    (click)="move(group.key, i, -1)"
                  >
                    <i class="ss-ic" style="--ss-ic: url('assets/taiga-ui/icons/chevron-down.svg'); transform: rotate(180deg)"></i>
                  </button>
                  <button
                    class="ss-icon-btn ss-icon-btn--s"
                    type="button"
                    [disabled]="!tiedBelow(group, i)"
                    [attr.aria-label]="'ქვემოთ' | t"
                    (click)="move(group.key, i, 1)"
                  >
                    <i class="ss-ic" style="--ss-ic: url('assets/taiga-ui/icons/chevron-down.svg')"></i>
                  </button>
                </li>
              }
            </ol>
          </div>
        }
      </div>
      <div class="flex justify-end gap-2">
        <button class="ss-btn ss-btn--flat" type="button" (click)="cancel()">
          <span class="georgian-text" lang="ka">{{ 'გაუქმება' | t }}</span>
        </button>
        <button class="ss-btn ss-btn--primary" type="button" data-testid="close-groups-confirm" (click)="confirm()">
          <span class="georgian-text" lang="ka">{{ (data.pending > 0 ? 'დახურვა მაინც' : 'დახურვა') | t }}</span>
        </button>
      </div>
    </div>
  `,
})
export class CloseGroupsDialogComponent {
  private readonly context = inject(SS_DIALOG_CONTEXT) as SsDialogContext<
    CloseGroupsDto,
    CloseGroupsDialogData
  >;
  protected readonly data = this.context.data;

  protected readonly orders = signal<Record<string, string[]>>(
    Object.fromEntries(this.data.groups.map((g) => [g.key, g.standings.map((r) => r.entrant)])),
  );

  private readonly rowOf = new Map(
    this.data.groups.flatMap((g) => g.standings.map((row) => [row.entrant, row] as const)),
  );

  protected readonly hasTies = computed(() =>
    this.data.groups.some((g) =>
      g.standings.some((row, i) => i > 0 && isLevel(g.standings[i - 1], row, this.data.scoring)),
    ),
  );

  protected nameOf(id: string): string {
    return this.data.names[id] || '—';
  }

  private level(groupKey: string, i: number, j: number): boolean {
    const order = this.orders()[groupKey] ?? [];
    const a = this.rowOf.get(order[i]);
    const b = this.rowOf.get(order[j]);
    return !!a && !!b && isLevel(a, b, this.data.scoring);
  }

  protected tiedAbove(group: GroupView, i: number): boolean {
    return i > 0 && this.level(group.key, i - 1, i);
  }

  protected tiedBelow(group: GroupView, i: number): boolean {
    return i < (this.orders()[group.key]?.length ?? 0) - 1 && this.level(group.key, i, i + 1);
  }

  protected move(groupKey: string, i: number, delta: -1 | 1): void {
    this.orders.update((orders) => {
      const order = [...(orders[groupKey] ?? [])];
      const j = i + delta;
      if (j < 0 || j >= order.length) return orders;
      [order[i], order[j]] = [order[j], order[i]];
      return { ...orders, [groupKey]: order };
    });
  }

  /** The body: changed orders only; `force` when matches are unplayed. */
  body(): CloseGroupsDto {
    const orders = changedOrders(this.data.groups, this.orders());
    return {
      ...(orders ? { orders } : {}),
      ...(this.data.pending > 0 ? { force: true } : {}),
    };
  }

  protected confirm(): void {
    this.context.completeWith(this.body());
  }

  protected cancel(): void {
    this.context.dismiss();
  }
}
