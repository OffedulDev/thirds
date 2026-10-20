const lowerThird = document.querySelector('#lower-third');
const details = document.querySelector('#list-details');
const candidateView = document.querySelector('#candidate-view');
const candidateList = document.querySelector('#candidate-list');
const noCandidates = document.querySelector('#no-candidates');
const logo = document.querySelector('#list-logo');
const fallback = document.querySelector('#logo-fallback');
let lastEntranceSequence = null;
let entranceAnimations = [];
let entranceTimer;
let candidateScrollFrame;
let candidateScrollTime = 0;
let candidateScrollOffset = 0;
let candidateScrollDirection = 1;
let candidateScrollPauseUntil = 0;

function stopCandidateScroll() {
  cancelAnimationFrame(candidateScrollFrame);
  candidateScrollFrame = null;
  candidateScrollTime = 0;
}

function startCandidateScroll() {
  stopCandidateScroll();
  if (candidateList.scrollHeight <= candidateList.clientHeight + 2) return;
  candidateScrollDirection = 1;
  candidateScrollOffset = candidateList.scrollTop;
  candidateScrollPauseUntil = performance.now() + 700;
  const tick = now => {
    if (candidateView.getAttribute('aria-hidden') === 'true') return stopCandidateScroll();
    if (!candidateScrollTime) candidateScrollTime = now;
    const elapsed = Math.min(50, now - candidateScrollTime);
    candidateScrollTime = now;
    if (now >= candidateScrollPauseUntil) {
      const end = candidateList.scrollHeight - candidateList.clientHeight;
      candidateScrollOffset = Math.max(0, Math.min(end, candidateScrollOffset + candidateScrollDirection * elapsed * .04));
      candidateList.scrollTop = Math.round(candidateScrollOffset);
      if (candidateScrollOffset >= end) {
        candidateScrollOffset = end;
        candidateList.scrollTop = end;
        candidateScrollDirection = -1;
        candidateScrollPauseUntil = now + 700;
      } else if (candidateScrollOffset <= 0 && candidateScrollDirection < 0) {
        candidateScrollOffset = 0;
        candidateList.scrollTop = 0;
        candidateScrollDirection = 1;
        candidateScrollPauseUntil = now + 700;
      }
    }
    candidateScrollFrame = requestAnimationFrame(tick);
  };
  candidateScrollFrame = requestAnimationFrame(tick);
}

function clearAnimations() {
  const animations = entranceAnimations;
  entranceAnimations = [];
  for (const animation of animations) animation.cancel();
}

function stopEntrance() {
  clearTimeout(entranceTimer);
  entranceTimer = null;
  stopCandidateScroll();
  clearAnimations();
  lowerThird.classList.remove('is-entering', 'is-descending');
  details.classList.remove('is-faded');
  candidateView.classList.remove('is-visible', 'is-shown');
  candidateView.setAttribute('aria-hidden', 'true');
  lowerThird.style.backgroundColor = '';
  lowerThird.style.borderColor = '';
  lowerThird.style.boxShadow = '';
  lowerThird.style.top = '';
  lowerThird.style.bottom = '';
  lowerThird.style.translate = '';
}

function animate(element, frames, duration, easing) {
  const animation = element.animate(frames, { duration, easing, fill: 'both' });
  entranceAnimations.push(animation);
  return animation;
}

function crossfadeToCandidates() {
  entranceTimer = null;
  candidateView.classList.add('is-visible');
  candidateView.setAttribute('aria-hidden', 'false');
  animate(details, [{ opacity: 1 }, { opacity: 0 }], 480, 'ease-in-out');
  animate(candidateView, [{ opacity: 0 }, { opacity: 1 }], 480, 'ease-in-out');
  entranceTimer = setTimeout(() => {
    details.classList.add('is-faded');
    candidateView.classList.add('is-shown');
    clearAnimations();
    startCandidateScroll();
    const scrollDistance = Math.max(0, candidateList.scrollHeight - candidateList.clientHeight);
    const candidateHold = Math.max(3000, 1800 + scrollDistance / 24 * 1000);
    entranceTimer = setTimeout(crossfadeToDetails, candidateHold);
  }, 480);
}

function crossfadeToDetails() {
  entranceTimer = null;
  stopCandidateScroll();
  animate(candidateView, [{ opacity: 1 }, { opacity: 0 }], 480, 'ease-in-out');
  animate(details, [{ opacity: 0 }, { opacity: 1 }], 480, 'ease-in-out');
  entranceTimer = setTimeout(() => {
    details.classList.remove('is-faded');
    candidateView.classList.remove('is-visible', 'is-shown');
    candidateView.setAttribute('aria-hidden', 'true');
    clearAnimations();
    moveToLowerThird();
  }, 480);
}

function computed(element) {
  const style = getComputedStyle(element);
  return { width: style.width, height: style.height, flexBasis: style.flexBasis, fontSize: style.fontSize };
}

function moveToLowerThird() {
  entranceTimer = null;
  const title = document.querySelector('.overlay-copy h1');
  const motto = document.querySelector('.overlay-copy p');
  const logoElement = document.querySelector('.overlay-logo');
  const titleTransition = title.style.transition;
  const mottoTransition = motto.style.transition;
  const logoTransition = logoElement.style.transition;
  title.style.transition = 'none';
  motto.style.transition = 'none';
  logoElement.style.transition = 'none';
  lowerThird.classList.remove('is-entering');
  lowerThird.offsetWidth;
  const finalStyle = getComputedStyle(lowerThird);
  const final = {
    width: finalStyle.width,
    height: finalStyle.height,
    padding: finalStyle.padding,
    gap: finalStyle.gap,
    backgroundColor: finalStyle.backgroundColor,
    borderColor: finalStyle.borderTopColor,
    boxShadow: finalStyle.boxShadow
  };
  const finalPosition = lowerThird.getBoundingClientRect();
  const finalLogo = computed(logoElement);

  lowerThird.classList.add('is-entering');
  lowerThird.offsetWidth;
  const startStyle = getComputedStyle(lowerThird);
  const start = {
    width: startStyle.width,
    padding: startStyle.padding,
    gap: startStyle.gap,
    top: startStyle.top
  };
  const startLogo = computed(logoElement);
  title.style.transition = titleTransition;
  motto.style.transition = mottoTransition;
  logoElement.style.transition = logoTransition;
  lowerThird.classList.add('is-descending');
  lowerThird.offsetWidth;
  const targetTop = `${finalPosition.top}px`;
  const duration = 1050;
  const easing = 'cubic-bezier(.2,.85,.25,1)';

  const cardAnimation = animate(lowerThird, [
    { top: start.top, translate: '0 -50%', width: start.width, padding: start.padding, gap: start.gap },
    { top: targetTop, translate: '0 0', width: final.width, padding: final.padding, gap: final.gap }
  ], duration, easing);
  animate(logoElement, [
    { width: startLogo.width, height: startLogo.height, flexBasis: startLogo.flexBasis, fontSize: startLogo.fontSize },
    { width: finalLogo.width, height: finalLogo.height, flexBasis: finalLogo.flexBasis, fontSize: finalLogo.fontSize }
  ], duration, easing);
  cardAnimation.onfinish = () => {
    lowerThird.style.top = targetTop;
    lowerThird.style.bottom = 'auto';
    lowerThird.style.translate = '0 0';
    lowerThird.classList.remove('is-entering', 'is-descending');
    lowerThird.style.backgroundColor = 'rgba(255,255,255,0)';
    lowerThird.style.borderColor = 'rgba(232,237,245,0)';
    lowerThird.style.boxShadow = '0 2px 8px rgba(16,35,74,0)';
    const panel = animate(lowerThird, [
      { backgroundColor: 'rgba(255,255,255,0)', borderColor: 'rgba(232,237,245,0)', boxShadow: '0 2px 8px rgba(16,35,74,0)' },
      { backgroundColor: final.backgroundColor, borderColor: final.borderColor, boxShadow: final.boxShadow }
    ], 180, 'ease-out');
    panel.onfinish = stopEntrance;
  };
}

function playEntrance() {
  stopEntrance();
  lowerThird.classList.add('is-visible', 'is-entering');
  lowerThird.offsetWidth;
  const pop = animate(lowerThird, [
    { opacity: 0, scale: .82 },
    { opacity: 1, scale: 1 }
  ], 520, 'cubic-bezier(.18,.8,.25,1)');
  pop.onfinish = () => {
    if (entranceAnimations[0] !== pop) return;
    clearAnimations();
    entranceTimer = setTimeout(crossfadeToCandidates, 2600);
  };
}

function render(state) {
  const workflow = state.workflows.find(item => item.id === state.activeId);
  const visible = Boolean(workflow) && state.overlayEnabled !== false;
  lowerThird.setAttribute('aria-hidden', String(!visible));
  const sequence = Number(state.entranceSequence) || 0;
  const shouldPlayEntrance = visible && Boolean(state.entranceEnabled)
    && (lastEntranceSequence === null || sequence !== lastEntranceSequence);
  lastEntranceSequence = sequence;

  if (!workflow) {
    stopEntrance();
    lowerThird.classList.remove('is-visible');
    return;
  }

  document.querySelector('#list-name').textContent = workflow.name;
  document.querySelector('#motto').textContent = workflow.motto || '';
  document.querySelector('#motto').hidden = !workflow.motto;
  fallback.textContent = workflow.name.slice(0, 2).toUpperCase();
  fallback.hidden = Boolean(workflow.logo);
  logo.hidden = !workflow.logo;
  logo.onerror = () => { logo.hidden = true; fallback.hidden = false; };
  logo.onload = () => { logo.hidden = false; fallback.hidden = true; };
  if (workflow.logo && logo.src !== new URL(workflow.logo, location.href).href) logo.src = workflow.logo;
  if (!workflow.logo) logo.removeAttribute('src');

  const candidates = Array.isArray(workflow.candidates) ? workflow.candidates : [];
  candidateList.replaceChildren();
  for (const [index, candidate] of candidates.entries()) {
    const item = document.createElement('li');
    item.textContent = candidate;
    item.style.setProperty('--candidate-index', index);
    candidateList.append(item);
  }
  stopCandidateScroll();
  candidateList.scrollTop = 0;
  noCandidates.hidden = candidates.length > 0;

  if (shouldPlayEntrance) playEntrance();
  else if (!entranceAnimations.length && !entranceTimer) {
    if (!visible) stopEntrance();
    lowerThird.classList.remove('is-entering');
    lowerThird.classList.toggle('is-visible', visible);
  } else if (!visible) {
    stopEntrance();
    lowerThird.classList.remove('is-visible');
  }
}

fetch('/api/state').then(response => response.json()).then(render);
const events = new EventSource('/api/events');
events.onmessage = event => render(JSON.parse(event.data));
