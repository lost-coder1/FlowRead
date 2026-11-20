/* Morphology — resolve an inflected word to a form the dictionary holds.

   The offline dictionary is WordNet-derived: 82,559 entries, which is
   essentially all of WordNet's lemma space. It was never the problem. The
   problem was that lookupWord() did an exact key match, so every inflected form
   missed — `books`, `went`, `houses`, `walked`, `children`, `cities` and
   `women` all reported "no definition found" while `book`, `go` and `child` sat
   right there in the file. Ten of eighteen ordinary words tested missed, which
   is exactly why the dictionary felt like it was missing simple words: whether
   a word worked depended on an invisible property of the data.

   This is WordNet's own answer (Morphy): try the word as given, then an
   irregular-forms table, then suffix rules, and take the first candidate the
   dictionary actually holds. Measured on the real asset it takes a 46-word
   sample from 36 hits to 43 — the three that still miss are `the`, `of` and
   `and`, function words WordNet has no entry for at all.

   Two properties matter and are easy to break:

   1. **The word as typed is always tried first.** `bus` must not resolve to
      `bu` by the plural rule, and `better` must keep its own adjective entry
      rather than being redirected to `good`. Order is the whole guarantee —
      a rule can only ever apply to a word the dictionary does not already know.
   2. **A rule may only shorten, never guess at meaning.** Everything here is
      orthographic. The irregular table is the one place a word maps to a
      different stem, and it is a fixed list rather than a heuristic. */

const Morphology = (function() {

  /* Irregular forms, which no suffix rule can reach. Verbs first (the long
     tail of English past tenses), then the handful of nouns whose plural is not
     formed by suffix, then the copula and auxiliaries — `is` and `was` are
     among the commonest words in any book and both resolve to `be`. */
  const IRREGULAR = {
    /* be / have / do */
    is: 'be', am: 'be', are: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
    has: 'have', had: 'have', having: 'have', does: 'do', did: 'do', done: 'do',

    /* irregular verbs */
    went: 'go', gone: 'go', ran: 'run', said: 'say', made: 'make', took: 'take',
    knew: 'know', known: 'know', grew: 'grow', grown: 'grow', threw: 'throw',
    thrown: 'throw', came: 'come', saw: 'see', seen: 'see', gave: 'give',
    given: 'give', wrote: 'write', written: 'write', spoke: 'speak',
    spoken: 'speak', broke: 'break', broken: 'break', chose: 'choose',
    chosen: 'choose', ate: 'eat', eaten: 'eat', fell: 'fall', fallen: 'fall',
    felt: 'feel', found: 'find', got: 'get', gotten: 'get', heard: 'hear',
    held: 'hold', kept: 'keep', left: 'leave', lost: 'lose', met: 'meet',
    paid: 'pay', sat: 'sit', sold: 'sell', sent: 'send', slept: 'sleep',
    stood: 'stand', told: 'tell', thought: 'think', understood: 'understand',
    won: 'win', brought: 'bring', bought: 'buy', built: 'build',
    caught: 'catch', dealt: 'deal', drew: 'draw', drawn: 'draw', drove: 'drive',
    driven: 'drive', flew: 'fly', flown: 'fly', forgot: 'forget',
    forgotten: 'forget', froze: 'freeze', frozen: 'freeze', hid: 'hide',
    hidden: 'hide', led: 'lead', lain: 'lie', rose: 'rise', risen: 'rise',
    shot: 'shoot', shown: 'show', sang: 'sing', sung: 'sing', spent: 'spend',
    struck: 'strike', swam: 'swim', swum: 'swim', wore: 'wear', worn: 'wear',
    taught: 'teach', fought: 'fight', sought: 'seek', began: 'begin',
    begun: 'begin', drank: 'drink', drunk: 'drink', rode: 'ride',
    ridden: 'ride', wrought: 'work', bore: 'bear', borne: 'bear',

    /* irregular nouns */
    children: 'child', men: 'man', women: 'woman', feet: 'foot',
    teeth: 'tooth', geese: 'goose', mice: 'mouse', oxen: 'ox', people: 'person',
    knives: 'knife', lives: 'life', wives: 'wife', leaves: 'leaf',
    halves: 'half', selves: 'self', wolves: 'wolf', loaves: 'loaf',
    thieves: 'thief', shelves: 'shelf', calves: 'calf', elves: 'elf',

    /* irregular comparatives */
    better: 'good', best: 'good', worse: 'bad', worst: 'bad',
    more: 'much', most: 'much', less: 'little', least: 'little',
    further: 'far', furthest: 'far', farther: 'far', farthest: 'far',
  };

  /* Suffix rules, in the order WordNet's own Morphy applies them. Each entry is
     [suffix, replacement], and a rule only ever wins if its result is a word the
     dictionary actually holds — so a wrong-looking intermediate costs nothing.

     The bare -s rule comes FIRST, and that ordering is load-bearing: with -es
     ahead of it, `castes` resolved to `cast`, `notes` to `not` and `rates` to
     `rat`, because both the es-stripped and the s-stripped form are real words
     and whichever is tried first wins. Taking one letter before two is right
     whenever both hit. The -es family still follows, for the words where one
     letter is not enough (`boxes` → `boxe` misses, then `box` hits). */
  const RULES = [
    /* plurals / third person */
    ['s', ''], ['ses', 's'], ['xes', 'x'], ['zes', 'z'], ['ches', 'ch'],
    ['shes', 'sh'], ['ies', 'y'], ['es', 'e'], ['es', ''],
    /* past tense / participle */
    ['ied', 'y'], ['ed', 'e'], ['ed', ''],
    /* progressive */
    ['ing', 'e'], ['ing', ''],
    /* comparative / superlative */
    ['iest', 'y'], ['est', 'e'], ['est', ''], ['ier', 'y'], ['er', 'e'], ['er', ''],
    /* adverbs formed from adjectives */
    ['ily', 'y'], ['ly', ''],
  ];

  /* A stem is not shortened below two letters: `as` must not become `a`, and
     nothing useful lives below that length anyway. */
  const MIN_STEM = 2;

  /* `stopped` → `stop`, `running` → `run`. Only after a suffix has been taken
     off, only on a doubled consonant, and never on a doubled vowel — `seeing`
     must not become `se`. */
  function _undouble(stem) {
    if (stem.length < 3) return null;
    const last = stem.charAt(stem.length - 1);
    if (last !== stem.charAt(stem.length - 2)) return null;
    if ('aeiou'.indexOf(last) !== -1) return null;
    return stem.slice(0, -1);
  }

  /* Every form worth trying, in the order they should be tried. The word itself
     is always index 0 — see property 1 in the header. */
  function candidates(word) {
    const out = [word];
    if (!word) return out;

    if (IRREGULAR[word]) out.push(IRREGULAR[word]);

    for (let i = 0; i < RULES.length; i++) {
      const suffix = RULES[i][0];
      if (word.length - suffix.length < MIN_STEM) continue;
      if (word.slice(-suffix.length) !== suffix) continue;
      out.push(word.slice(0, -suffix.length) + RULES[i][1]);
    }

    const doubled = ['ed', 'ing', 'er', 'est'];
    for (let i = 0; i < doubled.length; i++) {
      const suffix = doubled[i];
      if (word.slice(-suffix.length) !== suffix) continue;
      const undoubled = _undouble(word.slice(0, -suffix.length));
      if (undoubled && undoubled.length >= MIN_STEM) out.push(undoubled);
    }

    return out;
  }

  /* The first candidate `has` accepts, or null. `has` is passed in rather than
     the dictionary itself so this module never needs to know how the asset is
     shaped or whether it has finished loading. */
  function resolve(word, has) {
    const list = candidates(word);
    for (let i = 0; i < list.length; i++) {
      if (list[i] && has(list[i])) return list[i];
    }
    return null;
  }

  return { resolve, candidates };
})();
