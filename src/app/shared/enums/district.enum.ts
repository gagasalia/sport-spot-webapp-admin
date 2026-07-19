// Canonical Tbilisi district (უბანი) list. The latin `id` is the stored value
// (identical across admin + webapp + api); `name` is the Georgian label.
export const DISTRICT_OPTIONS: { id: string; name: string }[] = [
  { id: 'Vake', name: 'ვაკე' },
  { id: 'Saburtalo', name: 'საბურთალო' },
  { id: 'Vera', name: 'ვერა' },
  { id: 'Mtatsminda', name: 'მთაწმინდა' },
  { id: 'OldTbilisi', name: 'ძველი თბილისი' },
  { id: 'Chughureti', name: 'ჩუღურეთი' },
  { id: 'Didube', name: 'დიდუბე' },
  { id: 'Nadzaladevi', name: 'ნაძალადევი' },
  { id: 'Gldani', name: 'გლდანი' },
  { id: 'Isani', name: 'ისანი' },
  { id: 'Samgori', name: 'სამგორი' },
  { id: 'Krtsanisi', name: 'კრწანისი' },
  { id: 'Dighomi', name: 'დიღომი' },
  { id: 'Varketili', name: 'ვარკეთილი' },
  { id: 'Ortachala', name: 'ორთაჭალა' },
];

export const DISTRICT_LABELS: Record<string, string> = DISTRICT_OPTIONS.reduce(
  (acc, { id, name }) => {
    acc[id] = name;
    return acc;
  },
  {} as Record<string, string>,
);
