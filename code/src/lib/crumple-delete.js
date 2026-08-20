// Crumple & Toss satisfying-delete helper.
// GPU transforms only · easing cubic-bezier(0.22, 1, 0.36, 1) via --ease-out-expo.
// Choreography: select (glow + 1.02x) → crumple (paper ball, 300ms) → arc toss →
// land (bin squash + dust poofs). The caller handles the UNDO toast + API delete.

const DUR  = 760;   // toss duration (ms)
const BALL = 24;    // ball diameter (px)
const ARC  = 240;   // hop height (px)
const SPIN = 360;   // full rotation (deg)

export function lerp(a, b, p) { return a + (b - a) * p; }

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function center(el, size) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2 - size / 2,
           y: r.top + r.height / 2 - size / 2 };
}

// arc the crumpled ball into the bin
function toss(ballEl, from, to, t) {
  const p = t / DUR;
  const x = lerp(from.x, to.x, p);
  const y = lerp(from.y, to.y, p)
    - ARC * Math.sin(Math.PI * p); // hop

  ballEl.style.transform =
    `translate(${x}px, ${y}px)
     rotate(${SPIN * p}deg)`;
}

function fly(ballEl, from, to) {
  return new Promise((resolve) => {
    let t = 0;
    let last = 0;
    (function step(now) {
      if (!last) last = now;
      t = Math.min(t + (now - last), DUR);
      last = now;
      toss(ballEl, from, to, t);
      if (t < DUR) requestAnimationFrame(step);
      else resolve();
    })(0);
  });
}

// land - bin squashes, dust poofs
function land(binEl, x, y) {
  binEl.classList.add("dl-squash");
  setTimeout(() => binEl.classList.remove("dl-squash"), 520);
  for (let i = 0; i < 3; i++) spawnParticle(x, y, i);
}

function spawnParticle(x, y, i) {
  const p = document.createElement("div");
  p.className = "dl-particle" + (i === 1 ? " p2" : i === 2 ? " p3" : "");
  p.style.left = x + "px";
  p.style.top = y + "px";
  p.style.setProperty("--dx", (Math.random() * 40 - 20) + "px");
  p.style.setProperty("--dy", (Math.random() * -46 - 18) + "px");
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 600);
}

export async function playCrumpleToss(rowEl, binEl, ballEl) {
  const from = center(rowEl, BALL);
  const to   = center(binEl, BALL);

  // 1. select — whole row glows red/pink and scales up 1.02x
  rowEl.classList.add("dl-selecting");
  await wait(190);

  // 2. crumple — shrink into a crumpled paper ball with a subtle shake
  ballEl.style.opacity = "1";
  ballEl.style.setProperty("--sx", from.x + "px");
  ballEl.style.setProperty("--sy", from.y + "px");
  ballEl.classList.add("dl-crumpling");
  rowEl.classList.add("dl-gone");
  await wait(300);

  // 3. arc toss toward the bin
  ballEl.classList.remove("dl-crumpling");
  await fly(ballEl, from, to);

  // 4. land — bin squashes, dust poofs
  ballEl.style.opacity = "0";
  ballEl.style.transform = "translate(0px, 0px) rotate(0deg)";
  land(binEl, to.x + BALL / 2, to.y + BALL / 2);
}