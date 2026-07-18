import humanizeDuration from 'humanize-duration';

const shortEnglishHumanizer = humanizeDuration.humanizer({
  language: 'shortEn',
  languages: {
    shortEn: {
      y: () => 'y',
      mo: () => 'mo',
      w: () => 'w',
      d: () => 'd',
      h: () => 'h',
      m: () => 'm',
      s: () => 's',
      ms: () => 'ms',
    },
  },
  units: ['y', 'mo', 'd', 'h', 'm', 's'],
  largest: 4,
  round: true,
  spacer: '',
  conjunction: ' and ',
});

// Kept as formatDuration(ms) so ping.js and up.js need no changes at all.
function formatDuration(ms) {
  return shortEnglishHumanizer(ms);
}

export { formatDuration };