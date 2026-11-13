# Neuroevolution best practices compared with our setup

Researched 2026-11-13, after E4 (asked by the user: "check in the web how such trainings are best
conducted"). The M4 plan was rewritten from these findings; see [`../plans/M4-perception.md`](../plans/M4-perception.md).

**How reliable the claims are.** The researcher fetched and checked some sources and quotes others
from memory. Sources not marked were checked: Such et al. (GA settings, elite re-evaluation), World
Models (CMA-ES settings), and the abstracts of Colas et al., Heidrich-Meisner & Igel, Togelius &
Lucas and the TORCS manual. **(mem)** marks a well-known paper cited from memory; **(unsure)**
marks a detail that may be wrong.

## Our setup (as researched)

- **Game:** 2D asteroid racing with deterministic 15 ms ticks. No drag, thrust 400 u/s², maximum
  turn rate 5 rad/s.
- **Network:** fixed-topology MLP with tanh and hidden layers 10-8-6-4. 4 basic inputs plus the
  obstacle sensor `lineCheck` (2 inputs); outputs thrust and turn. About 250 weights.
- **Optimiser:** a (1+99) elitist GA. Mutation multiplies each weight with p = 0.1 by (1 ± U(0,1))
  ("relative" mutation). Switches exist for Gaussian mutation and for (μ+λ) with μ = 10. No
  crossover.
- **Fitness:** 24 episodes per generation, redrawn every generation from (seed, generation), all
  candidates on the same scenarios. Score = ∫ distance-to-target dt + 1,000 per missed target +
  3,000 per crash; crashes respawn at the episode start. A staged curriculum moves up a level at
  ≥ 80 % success 3 generations in a row.
- **Evaluation:** a fixed race exam of 17 races every 10 generations; fixed held-out scenarios for
  the winner; 10 paired seeds per arm.

## What we already do right

- **Common random numbers:** every candidate of a generation flies the same scenarios.
- **The parent is re-scored every generation**, so a lucky elite cannot stay on top for ever.
- **A staged curriculum.** Incremental evolution solves tasks that direct evolution cannot (Gomez &
  Miikkulainen 1997, mem). It is what stopped E3's passive collapse.
- **Few, task-specific, ship-relative sensors beat many raw rays at small network size.** This
  matches the racing literature (Togelius & Lucas 2005): `lineCheck` beat `whiskers`.
- **Paired comparisons on matched seeds, with a decision rule written down first** (Henderson et
  al. 2018).

## 1. Selection when fitness is noisy

**Practice**
- **Uber's Deep GA** ([Such et al. 2017](https://arxiv.org/abs/1712.06567)):
  - truncation selection keeps the top T (20 of 1,000 on Atari, 625 of 12,500 on Humanoid);
  - children come from Gaussian mutation of the whole vector, without crossover;
  - in stochastic environments the **top 10 are re-evaluated on 30 extra episodes**, and the
    elite is the one with the best mean;
  - reported results are the best elite averaged over 200 evaluations.
- **CMA-ES for RL** ([Heidrich-Meisner & Igel, GECCO 2009](https://researchr.org/publication/Heidrich-MeisnerI09-1)):
  adapts the number of episodes per evaluation to the noise; rank-based selection makes policy
  search robust to noise.
- **Survey** ([Jin & Branke 2005](https://www.cs.le.ac.uk/people/sy11/ECiDUE/JinBranke-TEVC05.pdf), mem):
  the options are explicit averaging (more samples), implicit averaging (larger populations) and
  re-evaluating survivors.

**Our setup.** Common random numbers and re-scoring the parent are right. The weak point is the
**winner's curse**: the maximum of 99 noisy children is usually a lucky one, and nothing re-checks
it before it replaces the parent. E3's passive collapse is exactly this.

## 2. Mutation and optimiser

**Practice**
- **OpenAI ES** ([Salimans et al. 2017](https://arxiv.org/abs/1703.03864), mem): additive Gaussian
  noise on all weights (σ ≈ 0.02), mirrored sampling, rank-based fitness shaping, normalised
  observations.
- **Deep GA:** additive Gaussian noise on all weights, small σ (0.002–0.005), sometimes annealed.
- **CMA-ES** ([Hansen tutorial 2016](https://arxiv.org/abs/1604.00772), mem):
  - adapts its step size and covariance itself;
  - the default population is 4 + 3·ln(n), about 20 for n = 250;
  - the separable variant (sep-CMA-ES) scales to thousands of weights.
- **World Models** ([Ha & Schmidhuber 2018](https://worldmodels.github.io)): an 867-weight
  car-racing controller trained with CMA-ES, population 64, each candidate averaged over 16
  rollouts, finalists checked on 1,024 rollouts. CMA-ES "is known to work well for solution spaces
  of up to a few thousand parameters."
- **CMA-ES for small control networks** (Igel 2003, mem): it did very well.

**Our setup.** Relative mutation is non-standard:
- it almost never flips a sign;
- its step scales with the weight, so small weights stay near 0, and since E[log(1 ± u)] < 0,
  weights drift toward 0;
- it touches only 10 % of the weights per child.

Our Gaussian arm in E4 used σ = 0.2 on 10 % of weights with starting weights in ±1: large, and not
the standard form. At about 250 weights we sit in CMA-ES's sweet spot. OpenAI ES targets very large
parallel populations and probably has no advantage here (mem).

## 3. Network size, topology and inputs

**Practice**
- **Small control tasks rarely need depth.** Linear policies trained by random search are
  competitive on standard locomotion benchmarks ([Mania et al. 2018](https://arxiv.org/abs/1803.07055), mem).
- **Normalise inputs** to zero mean and unit variance (Salimans 2017; Such 2017 for Humanoid).
- **NEAT** ([Stanley & Miikkulainen 2002](https://nn.cs.utexas.edu/downloads/papers/stanley.ec02.pdf), mem)
  grows networks from minimal ones and works well for small controllers, e.g. TORCS
  ([Cardamone et al. 2009](https://re.public.polimi.it/handle/11311/573616)). Not clearly better
  than a tuned fixed network at this size (unsure).

**Our setup.** Four narrow tanh layers (10-8-6-4) is unusually deep for about 6 inputs. A single
hidden layer, or a linear policy, is the usual reference. Encoding v2 scales inputs to about −1..1;
encoding v1 does not.

## 4. Fitness and reward design

**Practice**
- **Racing fitness is usually progress**, e.g. waypoints passed or distance raced, plus time
  ([Togelius & Lucas 2005](https://arxiv.org/abs/cs/0611006); the TORCS work).
- **Potential-based shaping**, F = γΦ(s′) − Φ(s), leaves the optimal policy unchanged
  ([Ng et al. 1999](https://people.eecs.berkeley.edu/~pabbeel/cs287-fa09/readings/NgHaradaRussell-shaping-ICML1999.pdf), mem).
- **Against deceptive fitness:**
  - novelty search ([Lehman & Stanley 2011](https://www.cs.swarthmore.edu/~meeden/DevelopmentalRobotics/lehman_ecj11.pdf), mem);
  - novelty search with ES ([Conti et al. 2018](https://arxiv.org/abs/1712.06560), mem);
  - MAP-Elites ([Mouret & Clune 2015](https://arxiv.org/abs/1504.04909));
  - NSGA-II when objectives truly conflict.

**Our setup.** ∫ distance dt is a sensible regret measure. But a hovering ship that never crashes
avoids the 3,000 penalty, which makes a strong local optimum. The curriculum fixed the symptom; a
progress or time-to-target term attacks the cause. Quality diversity is a heavier tool, only for
when deception persists after the selection fixes.

## 5. Curriculum

**Practice**
- **Incremental evolution** (Gomez & Miikkulainen 1997, mem): staged tasks of rising difficulty
  solved tasks evolution could not solve directly.
- **Automatic curricula:**
  - POET ([Wang et al. 2019](https://arxiv.org/abs/1901.01753)) creates environments that are
    neither too easy nor too hard;
  - learning-progress samplers such as ALP-GMM (Portelas et al. 2019, mem);
  - a survey ([Narvekar et al. 2020](https://arxiv.org/abs/2003.04960)).
  - Common advice: keep sampling earlier tasks to avoid forgetting, and aim for intermediate
    success rates.
- **Racing:** evolving sensor parameters helped **only after** a general controller existed;
  switched on from the start, it hindered evolution
  ([Togelius & Lucas 2006](https://web-archive.southampton.ac.uk/cogprints.org/5219/index.html)).

**Our setup.** A staged curriculum with an "80 % for 3 generations" rule. It judges success on the
same noisy draws that selection uses, and after a level-up no easier episodes are kept.

## 6. Sensors

**Practice**
- **The TORCS competition** ([Loiacono et al. 2013, manual](https://arxiv.org/abs/1304.1672)) gives
  bots configurable track rangefinders plus opponent sensors. The counts (19 rays, 200 m) are from
  memory (unsure).
- **Togelius & Lucas 2005:** only a network with egocentric inputs learned to race well, with very
  few wall rangefinders (unsure).
- **Common practice:** each ray normalised to [0, 1], e.g. closeness = 1 − d/range.

**Our setup.** "A few task-relevant egocentric inputs beat many raw rays at small network size"
matches E2: `lineCheck` won. Rich sensors may need a larger network or a curriculum stage first
(unsure).

## 7. Experimental methodology

**Practice**
- **Seeds and reporting** ([Henderson et al. 2018](https://arxiv.org/abs/1709.06560)): results swing
  with seeds. Report all runs, use identical seed sets, give confidence intervals.
- **How many seeds** ([Colas et al. 2018](https://arxiv.org/abs/1806.08295)): use a power analysis;
  Welch t-test or bootstrap CIs.
- **Aggregation** ([Agarwal et al. 2021, "rliable"](https://arxiv.org/abs/2108.13264)): the
  interquartile mean (IQM, robust to outlier seeds) with stratified-bootstrap CIs, and performance
  profiles.
- **Final evaluation on many episodes** (World Models: 1,024 rollouts; Such: 200).

**Our setup.** 10 paired seeds is reasonable. A 17-race exam is small, so per-seed exam noise
probably adds to the spread between seeds. Read "no clear difference" as "underpowered" unless
confidence intervals say otherwise.

## Prioritised changes to test

1. **Re-check the top children before they replace the parent.**
   - Score the top 5 children plus the parent on 24 extra fresh scenarios (seeded from seed and
     generation); replace only on the combined mean.
   - Benefit: tackles passive collapse at its cause. Cost: one extra evaluation round for 6 models
     per generation.
   - Sources: Such 2017; Jin & Branke 2005.
2. **A bigger exam, with IQM and bootstrap CIs.**
   - About 100 races and IQM with stratified-bootstrap CIs across seeds, plus a power check on
     today's data.
   - Benefit: tells us whether "no clear difference" results are real. Cost: evaluation compute.
   - Sources: Agarwal 2021; Colas 2018; World Models.
3. **Standard Gaussian mutation:** all weights, small σ (0.02–0.05 of the weight scale), optionally
   annealed, with μ = 5–10 truncation and item 1. Sources: Such 2017; Salimans 2017.
4. **A CMA-ES arm:** population about 50–100, the same shared scenarios, rank-based selection;
   sep-CMA-ES past 1,000 weights. Medium cost: the covariance state must go into the checkpoint.
   Sources: Hansen 2016; Ha & Schmidhuber 2018; Heidrich-Meisner & Igel 2009.
5. **Network shape:** one hidden layer (12–16) and a linear policy against 10-8-6-4, with normalised
   inputs. Small cost. Sources: Mania 2018; Salimans 2017.
6. **A progress term in fitness:** reward the drop in distance to target (potential-based) or time
   to target, so hovering stops paying. Small cost. Sources: Ng 1999; Togelius 2005.
7. **Curriculum mixing:** after a level-up keep about 25 % of episodes from earlier levels, and
   judge level-ups on re-evaluated scores. Small cost. Sources: Narvekar 2020; Gomez & Miikkulainen
   1997.
8. **Novelty search or MAP-Elites** only if hovering or other traps remain after 1–6. High cost.
   Sources: Lehman & Stanley 2011; Mouret & Clune 2015; Conti 2018.
