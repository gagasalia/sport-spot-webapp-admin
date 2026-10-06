import { switchLang } from '../../shared/i18n/lang';
import { Tournament } from '../../shared/models/tournament.model';
import { categoryLabel, groupTournaments } from './tournament-labels';

function t(id: string, patch: Partial<Tournament> = {}): Tournament {
  return {
    _id: id,
    name: `T ${id}`,
    sportType: 'padel',
    type: 'doubles',
    format: 'knockout',
    level: 'any',
    category: 'mixed',
    startDate: '2026-10-18',
    startTime: '10:00',
    entryFeeTetri: 0,
    currency: 'GEL',
    maxParticipants: 16,
    registeredCount: 0,
    status: 'draft',
    ...patch,
  };
}

/** docs/33 §2.5: the categories of one event render as ONE block. */
describe('tournament-labels', () => {
  beforeEach(() => switchLang('ka'));

  it('groups siblings by event.id, keeps the list order, sorts categories by event.order', () => {
    const list = [
      t('a'),
      t('w', { event: { id: 'ev1', label: 'ქალები', order: 1 } }),
      t('m', { event: { id: 'ev1', label: 'კაცები', order: 0 } }),
      t('b'),
      t('x', { event: { id: 'ev2', order: 0 } }),
    ];
    const blocks = groupTournaments(list);
    expect(blocks.map((b) => b.kind)).toEqual(['single', 'event', 'single', 'event']);
    const event = blocks[1];
    if (event.kind !== 'event') throw new Error('expected an event');
    expect(event.categories.map((c) => c._id)).toEqual(['m', 'w']);
    // the head is the first category (it names the event)
    expect(event.head._id).toBe('m');
    expect(blocks[3].kind === 'event' && blocks[3].categories.length).toBe(1);
  });

  it('a category is named by its label (English in an English session), else category · level', () => {
    const men = t('m', {
      category: 'men',
      level: 'intermediate',
      event: { id: 'ev', label: 'კაცები A', labelEn: 'Men A', order: 0 },
    });
    expect(categoryLabel(men)).toBe('კაცები A');
    switchLang('en');
    expect(categoryLabel(men)).toBe('Men A');
    switchLang('ka');

    const unnamed = t('w', { category: 'women', level: 'beginner', event: { id: 'ev', order: 1 } });
    expect(categoryLabel(unnamed)).toBe('ქალები · დამწყები');
    expect(categoryLabel(t('x', { category: 'mixed', level: 'any', event: { id: 'ev', order: 2 } }))).toBe(
      'შერეული',
    );
  });
});
