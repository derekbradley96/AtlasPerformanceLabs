/**
 * Marketing blog post template — content inline (no CMS).
 */
import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { usePageMeta } from '@/lib/usePageMeta';
import { colors } from '@/ui/tokens';

function ArticleBody({ children }) {
  return (
    <div
      className="max-w-3xl mx-auto px-4 py-12 sm:py-16"
      style={{ color: colors.muted, fontSize: 16, lineHeight: 1.7 }}
    >
      {children}
    </div>
  );
}

function H2({ children }) {
  return (
    <h2
      className="text-xl sm:text-2xl font-bold mt-10 mb-3 first:mt-0"
      style={{ color: colors.text }}
    >
      {children}
    </h2>
  );
}

function P({ children }) {
  return <p className="mb-4" style={{ color: colors.muted }}>{children}</p>;
}

function Ul({ children }) {
  return (
    <ul className="list-disc pl-5 mb-4 space-y-2" style={{ color: colors.muted }}>
      {children}
    </ul>
  );
}

function Li({ children }) {
  return <li>{children}</li>;
}

/** ~800 words — conservative, coach-education framing (not medical advice). */
function PeakWeekArticle() {
  return (
    <ArticleBody>
      <P>
        <strong style={{ color: colors.text }}>Peak week</strong> is the final 5–7 days before a bodybuilding
        show where you manipulate training volume, carbohydrates, sodium, and fluid intake so muscles look full and
        dry on stage — without flattening out or spilling over. For a first-timer, the goal is not perfection; it is
        executing a repeatable protocol you can log, observe, and refine for the next show.
      </P>
      <H2>What peak week is (and why it matters)</H2>
      <P>
        Glycogen stored in muscle binds water. In the days before a show, coaches typically lower glycogen slightly
        (depletion), then raise it again (loading) so muscles super-compensate and look rounder under stage lights.
        Sodium and water are adjusted so subcutaneous water does not blur muscle separation. Done well, you look
        sharper; done recklessly, you cramp, flatten, or feel awful. Always work with a qualified coach and your
        federation&apos;s rules — some organisations restrict certain practices.
      </P>
      <H2>A practical day-by-day template (7 days out)</H2>
      <P>
        Treat this as a <em>template</em>, not a prescription. Individual response varies by lean mass, drugs (if any),
        division, and how you have been eating all prep.
      </P>
      <Ul>
        <Li><strong style={{ color: colors.text }}>D-7 to D-5:</strong> Normal training taper; maintain usual protein;
          begin modest carb reduction only if you already run higher carbs and need headroom to load later.</Li>
        <Li><strong style={{ color: colors.text }}>D-4 to D-3:</strong> Lower repetitive joint stress; keep a few
          short pump sessions. Many plans hold protein steady (~1 g/lb or per coach prescription) and reduce carbs
          toward the lower end of your prep range to deplete glycogen partially.</Li>
        <Li><strong style={{ color: colors.text }}>D-2:</strong> Begin carb increase in staged meals (e.g. rice,
          potatoes, oats) while monitoring look, digestion, and sleep. Add sodium strategically only if your plan
          calls for it — blind sodium dumping is a common first-timer mistake.</Li>
        <Li><strong style={{ color: colors.text }}>D-1:</strong> Fine-tune carbs based on mirror and photos;
          training is minimal (pump only). Fluids are often reduced gradually — never aggressively — with medical
          oversight if you have kidney or blood pressure concerns.</Li>
        <Li><strong style={{ color: colors.text }}>Show day:</strong> Small, familiar carb meals between
          prejudging and finals; avoid novel foods. Sip fluids; do not experiment with new diuretics or extreme cuts.</Li>
      </Ul>
      <H2>Carb depletion → loading, explained simply</H2>
      <P>
        Depletion is not about &quot;emptying&quot; the muscle; it is lowering stored glycogen enough that the
        subsequent high-carb window refills cells preferentially into muscle rather than spilling into bloating for
        most athletes. Loading is staged increases — not one giant cheat day — watching waist tightness, quad
        separation, and triceps detail. If you load too fast, you may feel puffy; too slow, you may look flat at
        prejudging. Photos at the same time of day beat mirror guesswork.
      </P>
      <H2>Water manipulation — the safe approach</H2>
      <P>
        Extreme water cuts are dangerous. Safer peak-week philosophy: small, reversible changes you can undo if
        a cramp or dizziness appears. Many natural athletes rely more on carb timing and sodium rhythm than on
        aggressive fluid restriction. If you are new, prioritise <strong style={{ color: colors.text }}>practice
        peaks</strong> weeks out with your coach so you know how your face and abdomen respond before the real week.
      </P>
      <H2>Show-day morning nutrition</H2>
      <P>
        Keep foods you have used in late prep: rice cakes, jam, banana, white fish or chicken, rice, electrolyte
        drinks your stomach tolerates. Aim for steady energy across prejudging — avoid huge fat loads that slow
        gastric emptying. Between rounds, repeat small carb hits rather than one heavy meal that could distend the
        waistline.
      </P>
      <H2>Common first-timer mistakes</H2>
      <Ul>
        <Li>Changing foods, sodium products, or supplements in the final 72 hours.</Li>
        <Li>Skipping dry runs — first peak week should never be your first time manipulating carbs and water.</Li>
        <Li>Chasing scale weight instead of visual markers (detail vs flatness).</Li>
        <Li>Copying another athlete&apos;s numbers without matching leanness, muscle mass, or timeline.</Li>
        <Li>Under-recovering from last-minute panic cardio — it flattens more than it &quot;dries&quot; you.</Li>
      </Ul>
      <H2>The day-by-day peak week template</H2>
      <P>
        This is the framework most first-time competitors use successfully. Your coach will adjust based on how you
        look at day 3 — if you&apos;re flat, carbs go up; if you&apos;re spilling over, water comes down. The goal is to
        start conservative and adjust, not to attempt the most aggressive protocol on your first show.
      </P>
      <P>
        Day 7 (Sunday before show): Train legs and back. Normal carbohydrates. Begin reducing sodium — cut processed
        foods, sauces, and anything packaged. Water intake stays high (4-5L). This keeps your baseline predictable so
        you and your coach can spot true changes from protocol adjustments rather than random meal-to-meal variation.
      </P>
      <P>
        Days 6-5 (Monday-Tuesday): Depletion training — full body, moderate weight, higher reps (15-20). The goal is
        to empty muscle glycogen stores so they fill more completely when carbs are reintroduced. Carbohydrates drop to
        100-150g/day. Water stays high. Keep digestion simple and avoid high-fibre experiments that can create abdominal
        distension right when you need clean visual feedback.
      </P>
      <P>
        Days 4-3 (Wednesday-Thursday): Begin carb loading. Carbohydrates increase to 2-3x your normal intake (for most
        athletes, 300-500g/day). Keep fat low. Protein stays high. No training or very light pump work. Watch the
        mirror — you&apos;re looking for fullness, not bloat. This is where check-in photos in consistent lighting matter
        more than bodyweight alone.
      </P>
      <P>
        Day 2 (Friday): Final sodium and water adjustments. Some athletes cut water to 1-2L; others maintain normal
        intake. This is the most individual part of peak week and why having a prep coach for your first show matters.
        Carbs taper slightly — focus on rice, cream of rice, and sweet potato. Keep meals familiar and low-residue so
        you wake up tight rather than inflamed.
      </P>
      <P>
        Show day (Saturday): Wake up and assess. Eat a moderate carb meal 2-3 hours before stage time. Have a small
        sip of water with each meal. Bring a pump-up meal backstage — rice cakes, gummy bears, and a banana are the
        classic backstage foods. Don&apos;t try anything new on show day. New supplements, sodium bombs, and last-minute
        dehydration are where first-timers usually lose their look.
      </P>
      <H2>The mistakes first-timers make</H2>
      <P>
        Cutting water completely. This is outdated advice from the 1980s. Modern prep research shows that extreme water
        cuts cause muscle flatness, not dryness. The kidneys regulate water balance regardless of intake — you cannot
        &quot;dry out&quot; by drinking less. In most cases, severe cuts just reduce plasma volume and make pumps worse.
      </P>
      <P>
        Starting peak week protocols 14 days out. Peak week is 5-7 days. Starting earlier means you&apos;re depleted and
        miserable for two weeks rather than one. Long depletion phases also reduce training quality, worsen sleep, and
        make it harder to read your true response when loading finally starts.
      </P>
      <P>
        Not practising posing. Peak week is when posing matters most, but most first-timers barely practise until the
        final week. Posing should be part of your entire prep — 15-20 minutes daily from 12 weeks out. The athlete who
        can hold positions confidently under stage stress almost always appears &quot;leaner&quot; than someone with the same
        body composition but poor stage control.
      </P>
      <H2>What Atlas does for peak week</H2>
      <P>
        Atlas includes a peak week protocol system built specifically for bodybuilding coaches and athletes. Coaches
        deploy daily instructions — carb targets, water, sodium, cardio — directly to their client&apos;s app. Clients
        see today&apos;s exact targets on their home screen. No WhatsApp messages, no spreadsheets, no confusion about
        what day they&apos;re on.
      </P>
      <P>
        For athletes running their own prep, the Atlas personal plan includes a peak week protocol template with a
        day-by-day framework. You follow the protocol, log your weight and measurements, and Atlas tracks whether
        you&apos;re on pace for your show date. That historical log becomes your personal &quot;peak week playbook&quot; for the
        next season, so each prep is less guesswork and more informed iteration.
      </P>
      <P>
        Atlas is built so coaches can programme peak-week days, log check-ins, and align nutrition targets with
        training — if you are a coach,{' '}
        <Link to="/for-coaches" className="font-medium underline-offset-2 hover:underline" style={{ color: colors.primary }}>
          see how Atlas supports prep workflows
        </Link>
        .
      </P>
    </ArticleBody>
  );
}

function SoftwareComparisonArticle() {
  return (
    <ArticleBody>
      <P>
        If you coach bodybuilding or classic physique, your software has to survive <strong style={{ color: colors.text }}>peak week</strong>,{' '}
        <strong style={{ color: colors.text }}>check-ins with photos</strong>,{' '}
        <strong style={{ color: colors.text }}>macro adherence</strong>, and{' '}
        <strong style={{ color: colors.text }}>posing feedback</strong> — not just &quot;track a workout.&quot;
        Here is how common platforms compare in 2026 for <em>competition prep coaching</em> specifically.
      </P>
      <H2>Trainerize</H2>
      <P>
        Strong for general personal training: programmes, habit reminders, and client messaging. For long prep arcs,
        coaches often bolt on spreadsheets for peak-week carb tables, sodium notes, and show-day timelines. Macro
        coaching exists, but interpreted guidance (why a client missed protein on a leg day) is still mostly manual.
      </P>
      <H2>TrueCoach</H2>
      <P>
        Popular for video-based form feedback and simple programme delivery. Nutrition is typically higher-level
        targets rather than a full food-diary + barcode workflow tied to adherence analytics. Competition prep teams
        that need structured peak-week day plans and check-in review queues may outgrow the surface area.
      </P>
      <H2>PT Distinction</H2>
      <P>
        Broad feature set for online coaching brands. Bodybuilding-specific workflows (pose check queues, peak-week
        day protocols, federation-aware prep notes) depend on how you configure automations. Good fit if you invest
        time in templates; less opinionated out of the box for stage sport.
      </P>
      <H2>Atlas Performance Labs</H2>
      <P>
        Atlas is designed around <strong style={{ color: colors.text }}>prep execution</strong>: programs, nutrition
        targets, check-ins, messaging, and competition tooling in one place — including barcode logging for clients who
        need speed without losing accuracy. Coaches who live in spreadsheets for peak week usually want fewer
        context switches; that is the problem Atlas targets.
      </P>
      <H2>How to choose</H2>
      <Ul>
        <Li>If you only need exercise videos + basic programmes, lighter tools can work.</Li>
        <Li>If you run structured prep, peak-week nuance, and high-touch check-ins, prioritise check-in review,
          nutrition depth, and programme versioning in one system.</Li>
        <Li>Trial with one athlete through a mock peak before you commit your whole roster.</Li>
      </Ul>
      <H2>What actually separates prep software from generic PT tools</H2>
      <P>
        Most coaching platforms were built for general personal training — booking sessions, sending workout plans,
        tracking attendance. None of that is wrong, but it misses the specific requirements of contest prep coaching:
        show date management, peak week protocols, weekly conditioning check-ins with photo comparisons, posing
        practice tracking, and division-specific judging criteria.
      </P>
      <P>
        When a coach is managing 8 athletes in prep simultaneously — three in the final 6 weeks, two in mid-prep,
        three in off-season maintenance — they need software that surfaces the right information at the right time.
        Generic PT platforms show you all clients identically. Prep software separates your prep athletes from your
        lifestyle clients and shows you who needs adjusting today.
      </P>
      <H2>The comparison (updated April 2026)</H2>
      <P>
        Trainerize is the most widely used coaching platform in the UK. It handles programme delivery and check-ins
        well. It has no competition prep tools, no posing library, no peak week management, and no RIR tracking. It
        starts at £19/month with no free tier for new coaches.
      </P>
      <P>
        TrueCoach has a clean interface and good video coaching features. It is not built for bodybuilding in any
        meaningful way. No nutrition tracking, no comp prep, no barcode scanner. $19/month minimum.
      </P>
      <P>
        PT Distinction has the broadest feature set of the established platforms. Nutrition coaching, habit tracking,
        automations. But the interface feels dated, setup is complex, and there is still nothing specific to
        competition prep. $19/month.
      </P>
      <P>
        Atlas was built from the ground up for bodybuilding coaches and athletes. Per-set RIR tracking, peak week
        protocol deployment, pose check submission and review, division judging criteria, show day checklists, and a
        barcode scanner that is free forever. Coaches start free on a commission model — no monthly fee until revenue
        justifies it.
      </P>
      <H2>Our recommendation</H2>
      <P>
        If you coach general fitness clients exclusively and your athletes never step on stage, Trainerize is a
        reasonable choice with a large user base and solid integrations. If any part of your coaching involves
        bodybuilding, physique sport, or competition prep — or if you want to start free and prove revenue before
        paying a monthly subscription — Atlas is the clear choice.
      </P>
      <P>
        The practical way to decide is to run a 30-day pilot: move one prep athlete and one lifestyle client into the
        new system, measure response times, check-in turnaround, and adherence. The best platform is the one that
        reduces coach admin while improving athlete execution week after week.
      </P>
      <P>
        <Link to="/pricing" className="font-medium underline-offset-2 hover:underline" style={{ color: colors.primary }}>
          Compare Atlas pricing
        </Link>
        {' '}or{' '}
        <Link to="/why-switch" style={{ color: colors.primary }} className="font-medium underline-offset-2 hover:underline">
          read the platform comparison
        </Link>
        .
      </P>
    </ArticleBody>
  );
}

function MacroTrackingArticle() {
  return (
    <ArticleBody>
      <P>
        <strong style={{ color: colors.text }}>Macro tracking</strong> for bodybuilding is not only hitting a calorie
        number — it is aligning protein, carbohydrates, and fats with training volume, recovery, and whether you are
        growing, cutting, or peaking. The same calories with different macro splits produce different performance and
        look outcomes.
      </P>
      <H2>Protein: anchor macro</H2>
      <P>
        Most natural athletes do well with roughly <strong style={{ color: colors.text }}>0.8–1.1 g protein per lb
        bodyweight</strong> on a cut (toward the higher end when calories are low), and slightly lower on a surplus if
        carbs are high enough to spare oxidation. Distribute protein across meals so muscle protein synthesis is
        stimulated repeatedly — especially breakfast and peri-workout when adherence tends to slip.
      </P>
      <H2>Carbohydrates: fuel and fullness</H2>
      <P>
        Carbs fuel hard hypertrophy sessions and help muscle feel full during prep. On training days, bias carbs
        around the session; on rest days, pull starches slightly and keep fibre-rich carbs for satiety. For long cuts,
        periodic refeeds (planned high-carb days) can support leptin, sleep, and training quality — schedule them, do
        not &quot;earn&quot; them emotionally.
      </P>
      <H2>Fats: hormones and sanity</H2>
      <P>
        Dropping fat too low for too long can hurt mood, hormones, and joint comfort. A practical floor for many
        dieters is roughly <strong style={{ color: colors.text }}>0.25–0.35 g fat per lb</strong> unless a coach has a
        shorter, supervised phase. Prioritise essential sources (fish, eggs, olive oil, nuts in measured amounts).
      </P>
      <H2>Setting targets by phase</H2>
      <Ul>
        <Li><strong style={{ color: colors.text }}>Off-season / muscle gain:</strong> moderate surplus, protein
          anchored, carbs high enough to progress loads, fats adequate.</Li>
        <Li><strong style={{ color: colors.text }}>Cut:</strong> higher protein, carbs periodised to training, fats
          on the lower end but not zero.</Li>
        <Li><strong style={{ color: colors.text }}>Prep (12+ weeks out):</strong> smaller adjustments weekly based on
          scale trend, strength, photos, and biofeedback — not daily panic changes.</Li>
      </Ul>
      <H2>Adherence beats perfection</H2>
      <P>
        A plan you can hit 90% for 16 weeks beats a &quot;perfect&quot; macro sheet abandoned in week four. Use a
        food scale for education, then transition to portion templates for maintenance. Barcode scanning speeds logging
        so clients actually comply — that is why Atlas includes it free on relevant tiers.
      </P>
      <H2>Setting your starting numbers</H2>
      <P>
        The most common macro-setting mistake in bodybuilding is starting with calories that are too aggressive —
        either too low in a cut (sacrificing muscle) or too high in a bulk (adding unnecessary fat). The starting
        point that works for most natural athletes: multiply your bodyweight in kg by 28-32 for maintenance calories,
        then adjust based on goal.
      </P>
      <P>
        For fat loss: a 300-500 kcal daily deficit from maintenance. Expect 0.3-0.7kg per week of loss. Faster than
        1% of bodyweight per week and you&apos;re losing muscle. For muscle building: a 200-400 kcal daily surplus.
        Expect 0.15-0.3kg per week of gain. Faster means more fat accumulation. Your weekly average scale trend is
        more important than any single morning weigh-in.
      </P>
      <P>
        Protein is the non-negotiable: 1.6-2.2g per kg of bodyweight, every day, regardless of training status. If
        you&apos;re in a deficit, go higher (2.2-2.5g/kg) to protect muscle. If you&apos;re in a surplus, the lower end
        (1.8-2.0g/kg) is sufficient. The remaining calories split between carbohydrates and fats — typically favour
        carbohydrates around training and fats away from it.
      </P>
      <H2>Tracking without obsessing</H2>
      <P>
        Tracking macros precisely for 12-16 weeks in a cut is appropriate for competition prep. For off-season or
        lifestyle coaching, precision matters less than consistency. Research consistently shows that hitting protein
        targets 80-90% of days produces nearly identical results to hitting them every single day — obsessive tracking
        is not a competitive advantage beyond the prep context.
      </P>
      <P>
        The tools matter. A barcode scanner that covers UK supermarket products removes 80% of the friction in daily
        tracking. Apps that show your protein remaining as an interpreted number (&quot;77g to go — try chicken or a
        shake&quot;) rather than a percentage produce better adherence because they tell you what to do, not just where
        you are.
      </P>
      <H2>Using Atlas for macro tracking</H2>
      <P>
        Atlas includes a barcode scanner that is free to use forever — no paywall, no subscription required for
        scanning. The nutrition ring on the home screen shows calories and protein remaining in real terms. If your
        coach has set targets, your actual intake is compared against those targets — not against a generic TDEE
        calculator. Food diary data is visible to your coach in real time, which means macro adjustments happen based
        on actual eating patterns, not estimates.
      </P>
      <P>
        For self-coached athletes, the same workflow gives you objective trend data. You can review seven-day averages,
        compare intake against scale and performance changes, and make calmer weekly adjustments instead of daily swings
        based on emotion.
      </P>
      <P>
        Coaches:{' '}
        <Link to="/for-coaches" className="font-medium underline-offset-2 hover:underline" style={{ color: colors.primary }}>
          run nutrition targets beside training
        </Link>
        . Athletes:{' '}
        <Link to="/for-clients" className="font-medium underline-offset-2 hover:underline" style={{ color: colors.primary }}>
          see the client experience
        </Link>
        .
      </P>
    </ArticleBody>
  );
}

const ARTICLES = {
  'how-to-run-peak-week-first-time': {
    title: 'How to run peak week for your first competition',
    description:
      'A complete guide to peak week carb manipulation, water cutting, and show day nutrition for first-time bodybuilding competitors.',
    content: <PeakWeekArticle />,
  },
  'best-competition-prep-coaching-software': {
    title: 'The best competition prep coaching software in 2026',
    description:
      'How Trainerize, TrueCoach, PT Distinction, and Atlas compare for bodybuilding coaches who run real competition prep.',
    content: <SoftwareComparisonArticle />,
  },
  'macro-tracking-bodybuilding-complete-guide': {
    title: 'Macro tracking for bodybuilding — the complete guide',
    description:
      'Set protein, carbs, and fats for muscle building, cutting, and contest prep — with adherence-first coaching tips.',
    content: <MacroTrackingArticle />,
  },
};

export default function BlogPostPage() {
  const { slug } = useParams();
  const article = slug ? ARTICLES[slug] : null;

  usePageMeta(
    article
      ? {
          title: article.title,
          description: article.description,
          canonical: `https://atlasperformancelabs.co.uk/blog/${slug}`,
        }
      : {},
  );

  if (!article) {
    return <Navigate to="/blog" replace />;
  }

  return (
    <div style={{ background: colors.bg }}>
      <div className="max-w-3xl mx-auto px-4 pt-10 pb-4">
        <Link
          to="/blog"
          className="text-sm font-medium hover:underline"
          style={{ color: colors.primary }}
        >
          ← All posts
        </Link>
        <h1
          className="text-2xl sm:text-3xl font-bold tracking-tight mt-4"
          style={{ color: colors.text }}
        >
          {article.title}
        </h1>
      </div>
      {article.content}
    </div>
  );
}
