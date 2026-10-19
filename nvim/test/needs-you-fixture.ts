// Shared literal visibility cases for the hub rule and recorded-frame screens.
export const cases = [
  { name: 'defaults with events', config: '', count: 3, layers: ['now', 'now', 'now'] },
  {
    name: 'events raised to Now',
    config: 'inbox.other = "now"\ninbox.clear = "now"\ninbox.not_clear = "now"\ninbox.death = "now"\n',
    count: 3, layers: ['now', 'now', 'now'],
  },
  {
    name: 'responses in Watch, Background and Archive with Now events',
    config: 'inbox.ask = "watch"\ninbox.approval = "background"\ninbox.waiting = "archive"\ninbox.other = "now"\ninbox.clear = "now"\n',
    count: 0, layers: ['watch', 'background', 'archive'],
  },
];

