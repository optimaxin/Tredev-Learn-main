const kebab = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const MAJOR = [
  ["The Fool", ["new beginnings", "spontaneity", "faith"], ["recklessness", "naivety", "hesitation"], "A leap of faith opens the door to new beginnings and spontaneous adventure.", "Recklessness or naive hesitation clouds a leap that still needs to be taken with care."],
  ["The Magician", ["manifestation", "resourcefulness", "inspired action"], ["manipulation", "untapped potential", "poor planning"], "You have every tool at hand to manifest your intention through inspired action.", "Manipulation or poor planning waste a potential that remains untapped."],
  ["The High Priestess", ["intuition", "mystery", "inner knowing"], ["secrets", "disconnection", "repressed intuition"], "A quiet inner knowing speaks beneath the surface of things; trust its mystery.", "Secrets or a disconnection from self silence an intuition trying to be heard."],
  ["The Empress", ["abundance", "nurturing", "fertility"], ["creative block", "dependence", "neglect"], "Abundance flows freely through nurturing care and creative fertility.", "A creative block or quiet neglect leaves growth stalled and dependent."],
  ["The Emperor", ["authority", "structure", "stability"], ["rigidity", "domination", "lack of discipline"], "Firm structure and steady authority bring order and lasting stability.", "Rigidity or domination reveal a discipline that has curdled into control."],
  ["The Hierophant", ["tradition", "convention", "shared belief"], ["rebellion", "unconventionality", "breaking with tradition"], "Shared tradition and established belief offer guidance worth following.", "A rebellious break from convention questions what tradition has always assumed."],
  ["The Lovers", ["love", "harmony", "aligned values"], ["disharmony", "imbalance", "misaligned values"], "A deep harmony forms where love and shared values genuinely align.", "Disharmony surfaces where values quietly fail to align."],
  ["The Chariot", ["willpower", "determination", "victory"], ["lack of direction", "aggression", "loss of control"], "Focused willpower drives you to victory through sheer determination.", "A lack of direction or unchecked aggression signals a loss of control."],
  ["Strength", ["courage", "compassion", "inner strength"], ["self-doubt", "weakness", "insecurity"], "Gentle courage and compassion prove stronger than any show of force.", "Self-doubt and insecurity mask a strength you have not yet claimed."],
  ["The Hermit", ["introspection", "solitude", "inner guidance"], ["isolation", "loneliness", "withdrawal"], "A period of solitude offers space for introspection and inner guidance.", "Isolation curdles into loneliness when withdrawal goes on too long."],
  ["Wheel of Fortune", ["cycles", "fate", "turning point"], ["bad luck", "resistance to change", "broken cycles"], "A turning point arrives, carried by cycles larger than any single choice.", "Resistance to change, or a run of bad luck, stalls a cycle that wants to turn."],
  ["Justice", ["fairness", "truth", "cause and effect"], ["unfairness", "dishonesty", "lack of accountability"], "Clear-eyed fairness weighs cause and effect in the search for truth.", "Unfairness or dishonesty avoid the accountability the moment demands."],
  ["The Hanged Man", ["surrender", "new perspective", "letting go"], ["stalling", "resistance", "needless sacrifice"], "Surrendering control opens a new perspective you could not see before.", "Stalling resistance turns a needed pause into a needless sacrifice."],
  ["Death", ["endings", "transformation", "release"], ["resistance to change", "stagnation", "fear of endings"], "A necessary ending clears the way for real transformation.", "Fear of endings breeds stagnation where transformation is overdue."],
  ["Temperance", ["balance", "moderation", "purpose"], ["imbalance", "excess", "lack of long-term vision"], "Patient moderation blends opposites into a balanced sense of purpose.", "Excess and imbalance crowd out any long-term vision."],
  ["The Devil", ["bondage", "materialism", "shadow self"], ["breaking free", "reclaiming power", "releasing attachment"], "Bondage to materialism or the shadow self keeps you tethered to old patterns.", "You break free of an old attachment, reclaiming power you had given away."],
  ["The Tower", ["sudden upheaval", "revelation", "awakening"], ["avoided disaster", "delayed change", "fear of change"], "A sudden upheaval strips away illusion and forces a stark awakening.", "A disaster is narrowly avoided, though fear still delays a change that is coming."],
  ["The Star", ["hope", "faith", "renewal"], ["despair", "discouragement", "disconnection"], "Quiet hope and renewed faith restore light after a long darkness.", "Despair and discouragement disconnect you from a hope still within reach."],
  ["The Moon", ["illusion", "intuition", "uncertainty"], ["releasing fear", "emerging clarity", "fading confusion"], "Illusion and uncertainty blur the path; intuition is your only steady guide.", "Fear begins to release as clarity slowly emerges from the confusion."],
  ["The Sun", ["joy", "success", "vitality"], ["temporary sadness", "delayed success", "clouded clarity"], "Radiant joy and vitality shine on genuine, well-earned success.", "A temporary sadness or delay clouds a success that is still coming."],
  ["Judgement", ["reflection", "awakening", "renewal"], ["self-doubt", "harsh judgment", "avoiding accountability"], "A moment of reckoning invites honest reflection and genuine renewal.", "Self-doubt or harsh judgment make it hard to answer an honest call to account."],
  ["The World", ["completion", "fulfillment", "accomplishment"], ["incompletion", "delay", "lack of closure"], "A long journey reaches its fulfillment, whole and complete.", "Incompletion or delay withhold the closure this chapter is due."],
];

const RANKS = ["Ace", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Page", "Knight", "Queen", "King"];

const SUITS = [
  { key: "wands", label: "Wands" },
  { key: "cups", label: "Cups" },
  { key: "swords", label: "Swords" },
  { key: "pentacles", label: "Pentacles" },
];

const MINOR_DATA = {
  wands: [
    [["new opportunity", "inspiration", "growth"], ["delays", "lack of motivation", "false start"], "A spark of inspiration invites you toward new growth and creative potential.", "Delays and flagging motivation stall a promising idea before it can catch fire."],
    [["planning", "discovery", "personal power"], ["fear of the unknown", "second-guessing", "lack of planning"], "You weigh your options and claim the personal power to choose your own path.", "Fear of the unknown and second-guessing keep you from committing to a direction."],
    [["expansion", "foresight", "progress"], ["delays", "obstacles", "lack of foresight"], "Early efforts bear fruit as your vision expands beyond its original horizon.", "Obstacles and short-sightedness slow progress you expected to come easily."],
    [["celebration", "harmony", "homecoming"], ["instability", "conflict at home", "lack of support"], "A joyful homecoming or celebration marks a season of harmony and belonging.", "Instability at home or a lack of support undercuts a moment that should feel settled."],
    [["conflict", "competition", "tension"], ["avoiding conflict", "resolution", "exhaustion from strife"], "Competing voices and mounting tension test your resolve through open conflict.", "You avoid a necessary confrontation, or find welcome relief as the strife finally settles."],
    [["victory", "recognition", "success"], ["ego", "lack of recognition", "a fall from grace"], "Public recognition crowns a hard-won victory and validates your effort.", "Unchecked ego or a lack of due recognition threatens to undo recent success."],
    [["perseverance", "defensiveness", "standing your ground"], ["overwhelm", "giving up", "feeling attacked"], "You hold your ground and defend what you have built against every challenge.", "Feeling overwhelmed and outnumbered, you are tempted to give up the fight."],
    [["swift action", "momentum", "alignment"], ["delays", "frustration", "forced slowdown"], "Events move quickly now, momentum and alignment carrying plans swiftly forward.", "Frustrating delays force an unwelcome slowdown just as things were gaining speed."],
    [["resilience", "persistence", "boundaries"], ["burnout", "paranoia", "defensiveness"], "Battle-worn but resilient, you draw one more boundary and hold your line.", "Burnout and a wary, defensive paranoia make it hard to trust the fight is over."],
    [["burden", "responsibility", "hard work"], ["overwhelm", "need to delegate", "releasing burdens"], "You shoulder a heavy load of responsibility earned through hard work.", "Overwhelmed by the weight you carry, it is time to delegate or release a burden."],
    [["exploration", "enthusiasm", "free spirit"], ["lack of direction", "hastiness", "delays"], "A free-spirited enthusiasm draws you to explore a bold new idea.", "Hasty, undirected energy scatters your enthusiasm before it can take shape."],
    [["bold action", "adventure", "impulsive energy"], ["recklessness", "impatience", "scattered energy"], "Restless and adventurous, you charge toward a goal with bold energy.", "Recklessness and impatience scatter your energy before the goal is reached."],
    [["confidence", "courage", "vibrant determination"], ["self-doubt", "jealousy", "insecurity"], "Confident and warm, you lead with courage and a vibrant, determined spirit.", "Self-doubt and jealousy undermine a confidence that usually comes naturally."],
    [["bold leadership", "vision", "entrepreneurship"], ["impulsiveness", "ruthlessness", "high expectations"], "A bold, visionary leader, you inspire others to act on ambitious plans.", "Impulsive or ruthless leadership sets expectations that others struggle to meet."],
  ],
  cups: [
    [["new love", "emotional beginnings", "compassion"], ["emotional loss", "blocked feelings", "emptiness"], "An overflowing cup signals new love and an open, compassionate heart.", "Blocked feelings or an emotional loss leave the heart feeling empty."],
    [["partnership", "mutual attraction", "union"], ["disconnection", "imbalance", "tension in relationship"], "A mutual attraction deepens into partnership and heartfelt union.", "Disconnection or imbalance strains a bond that once felt effortless."],
    [["celebration", "friendship", "community"], ["overindulgence", "gossip", "isolation"], "Friends gather in celebration, community and joy carrying the moment.", "Overindulgence or gossip sours a celebration, leaving you feeling isolated."],
    [["contemplation", "apathy", "missed opportunity"], ["renewed interest", "motivation", "awareness"], "Wrapped in contemplation, you overlook an opportunity offered right in front of you.", "A renewed interest breaks through the apathy, and awareness returns."],
    [["loss", "regret", "disappointment"], ["acceptance", "moving on", "finding peace"], "Grief and regret over a loss overshadow what remains still standing.", "Acceptance settles in as you find peace and finally move on."],
    [["nostalgia", "childhood memories", "reunion"], ["stuck in the past", "naivety", "unrealistic expectations"], "A warm nostalgia returns through childhood memories or a happy reunion.", "Staying stuck in the past feeds a naive, unrealistic longing for what was."],
    [["choices", "fantasy", "wishful thinking"], ["clarity", "focus", "poor choices made real"], "A dazzling array of choices tempts you into fantasy and wishful thinking.", "Clarity cuts through illusion, or a poor choice finally becomes real."],
    [["walking away", "seeking deeper meaning", "disillusionment"], ["avoidance", "fear of change", "stagnation"], "You walk away from what no longer satisfies, seeking something deeper.", "Fear of change keeps you stagnant, avoiding a departure you know is due."],
    [["satisfaction", "contentment", "wish fulfilled"], ["greed", "dissatisfaction", "overindulgence"], "A wish fulfilled brings deep satisfaction and quiet contentment.", "Greed or overindulgence turns satisfaction into a nagging dissatisfaction."],
    [["harmony", "emotional fulfillment", "family happiness"], ["broken home", "disharmony", "unrealistic expectations"], "Emotional fulfillment radiates through a home filled with harmony.", "Disharmony or unrealistic expectations fracture a once-happy home."],
    [["creative opportunity", "curiosity", "emotional message"], ["emotional immaturity", "insecurity", "disappointing news"], "A curious, creative opportunity or tender message arrives unexpectedly.", "Emotional immaturity or insecurity colors a disappointing piece of news."],
    [["romance", "charm", "following the heart"], ["moodiness", "unrealistic expectations", "jealousy"], "A romantic gesture follows the heart, charming and idealistic.", "Moodiness and jealousy reveal unrealistic expectations behind the charm."],
    [["compassion", "emotional security", "intuitive care"], ["emotional insecurity", "moodiness", "dependency"], "Deeply compassionate, you offer emotional security and intuitive care.", "Emotional insecurity and dependency unsettle a usually steady heart."],
    [["emotional balance", "diplomacy", "wisdom"], ["moodiness", "manipulation", "volatility"], "Calm diplomacy and emotional wisdom guide you through troubled waters.", "Moodiness or quiet manipulation reveal a volatility beneath the calm."],
  ],
  swords: [
    [["clarity", "breakthrough", "truth"], ["confusion", "chaos", "miscommunication"], "A breakthrough moment cuts through confusion and delivers hard clarity.", "Confusion and miscommunication cloud a truth that should be obvious."],
    [["difficult choice", "stalemate", "avoidance"], ["indecision paralysis", "information overload", "release of tension"], "Blindfolded between two paths, you stall rather than face a difficult choice.", "Paralyzed by indecision and overload, you finally release the built-up tension."],
    [["heartbreak", "sorrow", "painful truth"], ["healing", "forgiveness", "moving past pain"], "A painful truth pierces the heart, leaving sorrow in its wake.", "Healing and forgiveness slowly mend a wound once thought unbearable."],
    [["rest", "recovery", "stillness"], ["restlessness", "burnout", "forced pause"], "A deliberate stillness allows rest and recovery after a long strain.", "Restlessness resists a pause your burnt-out body and mind still need."],
    [["conflict", "tension", "defeat"], ["reconciliation", "resentment", "moving past conflict"], "A hollow victory in conflict leaves tension and defeat in its wake.", "Reconciliation is possible, though resentment lingers from the fight."],
    [["transition", "moving on", "gradual progress"], ["resistance to change", "unresolved issues", "stuck patterns"], "A quiet transition carries you toward calmer waters and gradual progress.", "Resistance to change leaves old, unresolved issues trailing behind."],
    [["deception", "strategy", "getting away with something"], ["coming clean", "guilt", "self-deceit"], "A shrewd strategy, or a quiet deception, lets you slip past unnoticed.", "Guilt catches up as you come clean, or as your own self-deceit unravels."],
    [["restriction", "self-imposed limits", "victim mentality"], ["self-liberation", "new perspective", "releasing fear"], "Bound by self-imposed limits, you feel trapped with no way out.", "A new perspective releases old fears, opening the way to self-liberation."],
    [["anxiety", "worry", "nightmares"], ["hope", "releasing worry", "turmoil easing"], "Anxiety and worry keep you awake, haunted by imagined worst cases.", "Hope returns as the worry loosens its grip and inner turmoil eases."],
    [["painful ending", "betrayal", "rock bottom"], ["recovery", "resisting an inevitable end", "slow healing"], "A painful ending, sharpened by betrayal, brings you to rock bottom.", "Recovery begins, even as some part of you resists an ending that is inevitable."],
    [["curiosity", "vigilance", "new ideas"], ["haste", "scattered thoughts", "gossip"], "A restless curiosity keeps you alert to new ideas and information.", "Hasty, scattered thoughts spill into gossip before they are fully formed."],
    [["ambition", "fast thinking", "assertiveness"], ["recklessness", "impulsiveness", "burnout"], "Driven and assertive, you charge ahead with fast, ambitious thinking.", "Reckless impulsiveness burns through energy faster than it can be replaced."],
    [["independence", "clear judgment", "direct communication"], ["coldness", "bitterness", "harsh judgment"], "Independent and clear-eyed, you speak direct, unclouded truth.", "A guarded coldness or bitterness hardens once-fair judgment."],
    [["intellectual authority", "truth", "discipline"], ["manipulation", "cruelty", "abuse of power"], "Disciplined intellect and a commitment to truth command quiet authority.", "Manipulation or cruelty reveal an authority turned toward abuse of power."],
  ],
  pentacles: [
    [["new opportunity", "prosperity", "manifestation"], ["missed opportunity", "lack of planning", "scarcity"], "A tangible new opportunity for prosperity takes root and begins to grow.", "Poor planning lets a promising opportunity slip away into scarcity."],
    [["balance", "adaptability", "time management"], ["imbalance", "overwhelm", "disorganization"], "You juggle competing demands with balance and easy adaptability.", "Disorganization tips the balance, leaving you overwhelmed by competing demands."],
    [["teamwork", "collaboration", "craftsmanship"], ["lack of teamwork", "misalignment", "poor quality"], "Skilled collaboration and craftsmanship build something meant to last.", "Misalignment and poor teamwork let the quality of the work slip."],
    [["security", "control", "saving"], ["greed", "materialism", "insecurity"], "A tight grip on security and savings keeps you feeling protected.", "Greed or materialism reveal an insecurity hiding behind the need for control."],
    [["hardship", "financial loss", "isolation"], ["recovery", "improving circumstances", "seeking help"], "Hardship and financial loss leave you out in the cold, feeling isolated.", "Circumstances begin to improve as you finally seek the help you need."],
    [["generosity", "charity", "sharing"], ["debt", "selfishness", "strings attached"], "Generosity flows freely as giving and receiving find their balance.", "Debt or selfish strings attached complicate an act that should be freely given."],
    [["patience", "long-term investment", "assessment"], ["impatience", "lack of reward", "poor investment"], "Patient investment pays off as you pause to assess long-term growth.", "Impatience frustrates a return that has not yet come, or never will."],
    [["diligence", "mastery", "dedication"], ["mediocrity", "lack of ambition", "perfectionism"], "Diligent practice sharpens skill on the steady road to mastery.", "A lack of ambition, or crippling perfectionism, stalls real progress."],
    [["abundance", "luxury", "self-sufficiency"], ["overinvestment in work", "superficiality", "isolation"], "Self-sufficient and comfortable, you enjoy the fruits of your own labor.", "Overinvestment in work or surface appearances leaves little else to enjoy."],
    [["legacy", "wealth", "long-term success"], ["financial loss", "family disputes", "instability"], "A lasting legacy of wealth and family security spans generations.", "Financial loss or family disputes threaten a foundation built over years."],
    [["ambition", "diligence", "new venture"], ["lack of commitment", "unrealistic goals", "procrastination"], "A diligent, ambitious start promises real progress on a new venture.", "Procrastination or unrealistic goals undercut a commitment not yet made."],
    [["hard work", "routine", "reliability"], ["laziness", "stagnation", "boredom"], "Steady, reliable hard work grinds forward one dependable step at a time.", "Laziness or boredom let routine slide into stagnation."],
    [["practicality", "nurturing", "resourcefulness"], ["imbalance", "neglect", "overwork"], "Grounded and resourceful, you nurture what is real and practical.", "Overwork or neglect tip a usually well-balanced, nurturing life off course."],
    [["abundance", "security", "disciplined ambition"], ["greed", "materialism", "poor financial decisions"], "Disciplined ambition secures a life of lasting abundance and comfort.", "Greed or materialism lead to financial decisions that undercut real security."],
  ],
};

const majorCards = MAJOR.map(([name, keywordsUpright, keywordsReversed, meaningUpright, meaningReversed], i) => ({
  id: kebab(name),
  name,
  arcana: "major",
  suit: null,
  number: i,
  keywordsUpright,
  keywordsReversed,
  meaningUpright,
  meaningReversed,
}));

const minorCards = SUITS.flatMap(({ key, label }) =>
  MINOR_DATA[key].map(([keywordsUpright, keywordsReversed, meaningUpright, meaningReversed], i) => {
    const name = `${RANKS[i]} of ${label}`;
    return {
      id: kebab(name),
      name,
      arcana: "minor",
      suit: key,
      number: i + 1,
      keywordsUpright,
      keywordsReversed,
      meaningUpright,
      meaningReversed,
    };
  })
);

export const TAROT_DECK = [...majorCards, ...minorCards];

export function drawThreeCards() {
  const shuffled = [...TAROT_DECK];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const positions = ["Past", "Present", "Future"];
  return shuffled.slice(0, 3).map((card, i) => ({
    ...card,
    position: positions[i],
    reversed: Math.random() < 0.25,
  }));
}

export function synthesizeReading(spread) {
  const [past, present, future] = spread;
  const kw = (card) => (card.reversed ? card.keywordsReversed : card.keywordsUpright)[0];
  const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const presentMeaning = present.reversed ? present.meaningReversed : present.meaningUpright;
  return `Your past carries the weight of ${kw(past)}. In the present, ${lower(presentMeaning)} The road ahead points toward ${kw(future)}, a thread still waiting to be drawn taut.`;
}

if (process.env.NODE_ENV !== "production") {
  console.assert(TAROT_DECK.length === 78, `expected 78 cards, got ${TAROT_DECK.length}`);
  console.assert(new Set(TAROT_DECK.map((c) => c.id)).size === 78, "card ids must be unique");
  const spread = drawThreeCards();
  console.assert(new Set(spread.map((c) => c.id)).size === 3, "drawThreeCards must not repeat cards");
}
