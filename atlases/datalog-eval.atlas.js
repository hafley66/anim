// Datalog evaluation, as a relation-dependency graph.
// The program modeled (complete, runnable in spirit):
//
//   func("main"). func("parse"). func("lex"). func("dead").
//   calls("main","parse"). calls("parse","lex").
//   reachable("main").
//   reachable(Y) <- reachable(X), calls(X,Y).        -- recursive
//   dead(F)      <- func(F), !reachable(F).           -- negation
//
// Edge a -> b means "a is derived using b" (a depends on b).
// The renderer's own features map onto the theory:
//   folders/tiers = strata,  the self-loop = recursion (SCC),
//   the red edge  = negation (what forces the stratum split).
export default {
  d2: `
given: Given facts -- stratum 0 {
  func
  calls
}

s1: Phase 1 reachable -- stratum 1 {
  reachable
}

s2: Phase 2 dead -- stratum 2 {
  dead
}

s1.reachable -> given.calls
s1.reachable -> s1.reachable
s2.dead -> given.func
s2.dead -> s1.reachable

# @ given.func : GIVEN fact, not computed. func("main"), func("parse"), func("lex"), func("dead"). Handed to you.
# @ given.calls : GIVEN fact. calls(X,Y) means X calls Y. calls("main","parse"), calls("parse","lex"). The call-graph edges.
# @ s1.reachable : DERIVED by a rule. Base case reachable("main"); recursive rule reachable(Y) <- reachable(X), calls(X,Y). Left of <- is the HEAD, right is the BODY. X,Y are blanks.
# @ s2.dead : DERIVED. dead(F) <- func(F), !reachable(F). The ! is negation, a NOT question: which funcs are absent from reachable.

# @ s1.reachable -> given.calls : the body reads calls. Fill blanks: calls(main,parse) gives X=main, Y=parse, so derive reachable(parse). One firing per consistent fill.
# @ s1.reachable -> s1.reachable : RECURSION. reachable's body reads reachable. This self-loop IS the round loop: round 1 finds reachable(parse), round 2 uses it to find reachable(lex), repeat until a round adds nothing. The renderer flags it as a cycle / SCC.
# @ s2.dead -> given.func : the body reads func to list the candidates to test.
# @ s2.dead -> s1.reachable : NEGATION (!reachable). You cannot answer "not reachable" until reachable is FINAL, so dead must wait for phase 1 to freeze. This single edge is what pushes dead one stratum up.

# tag given.func : base, given
# tag given.calls : base, given
# tag s1.reachable : derived, recursive, monotone
# tag s2.dead : derived, negation, stratified

# diff add given.func
# diff add given.calls
# diff mod s1.reachable -> s1.reachable
# diff del s2.dead -> s1.reachable

# src s1.reachable = ~/projects/sprefa/v5/examples/glean.dl:1
# src s2.dead = ~/projects/sprefa/v5/src/engine.rs:379
`,
  tours: {
    "1 · facts vs rules": [
      { focus: "given.func", isolate: false, note: "GIVEN fact. You are handed func(\"main\"), func(\"parse\")... You never compute these." },
      { focus: "given.calls", isolate: false, note: "GIVEN fact. calls(X,Y) = X calls Y. The edges of the call graph." },
      { focus: "s1.reachable", isolate: false, note: "DERIVED. A RULE makes these: reachable(Y) <- reachable(X), calls(X,Y). Head on the left of <-, body (the conditions) on the right." },
      { focus: "s2.dead", isolate: false, note: "DERIVED. dead(F) <- func(F), !reachable(F). The ! is a NOT. Hold that thought." }
    ],
    "2 · fill the blanks": [
      { path: ["s1.reachable", "given.calls"], isolate: true, note: "reachable's body reads calls. The blanks X,Y get filled from each calls fact. calls(main,parse) gives X=main, Y=parse, so you conclude reachable(parse). A rule fires once for every consistent way to fill its blanks." }
    ],
    "3 · the round loop = recursion": [
      { focus: "s1.reachable", isolate: true, note: "See the self-loop. reachable's body reads reachable itself. Round 1 derives reachable(parse) from main; round 2 uses parse to derive reachable(lex); keep going until a round adds nothing. That self-edge is the loop. Toggle CYCLES in the toolbar to watch the renderer mark it as an SCC." }
    ],
    "4 · why dead waits = a stratum": [
      { path: ["s2.dead", "s1.reachable"], isolate: true, note: "The red edge is negation: !reachable. You cannot name who did NOT vote until the polls close. So dead cannot run until reachable is FINISHED and frozen. That wait is the only reason dead sits in its own later phase, one tier up. That is a stratum boundary." }
    ],
    "5 · the whole shape": [
      { focus: "s2.dead", isolate: false, note: "Step back. The three folders are the three strata: given facts (0), reachable (1), dead (2). The amber self-edge is recursion (the inner round loop). The red edge is negation (it forces the outer phase split). Read the tiers bottom-up: that is evaluation order, finish the bottom before the top." }
    ]
  }
};
